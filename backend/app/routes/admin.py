from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from datetime import datetime
import json
from app.models.security_models import User, Role, RoleName, Department, SecurityLog, AuthorizedZone, Device, SecurityAlert, ExitRequest, SecurityIncident, Notification
# from app.services.security_service import SecurityService
from app.middleware.rbac import super_admin_required
from app.database import db

admin_bp = Blueprint("admin", __name__)


def _list_unassigned_dept_admins():
    dept_admin_role = Role.query.filter_by(name=RoleName.DEPT_ADMIN).first()
    if not dept_admin_role:
        return []
    admins = (
        User.query.filter(
            User.role_id == dept_admin_role.id,
            User.department_id.is_(None),
        )
        .order_by(User.username.asc())
        .all()
    )
    return [{"id": admin.id, "name": admin.username, "email": admin.email} for admin in admins]

@admin_bp.route("/departments", methods=["POST"])
@jwt_required()
@super_admin_required
def create_department():
    data = request.json
    name = data.get("name")
    
    if Department.query.filter_by(name=name).first():
        return jsonify({"message": "Département existe déjà"}), 400
        
    dept = Department(name=name)
    db.session.add(dept)
    db.session.commit()
    
    return jsonify({"message": "Département créé", "id": dept.id}), 201

@admin_bp.route("/admins", methods=["POST"])
@jwt_required()
@super_admin_required
def create_dept_admin():
    from app.services.security_service import SecurityService
    data = request.json or {}
    admin_id = data.get("admin_id") or data.get("adminId")
    dept_id = data.get("dept_id") or data.get("departmentId")

    if admin_id and dept_id:
        dept = Department.query.get(dept_id)
        if not dept:
            return jsonify({"message": "Département non trouvé"}), 404

        dept_admin_role = Role.query.filter_by(name=RoleName.DEPT_ADMIN).first()
        existing = User.query.filter_by(department_id=dept.id, role_id=dept_admin_role.id).first()
        if existing:
            return jsonify({"message": "Ce département a déjà un administrateur"}), 409

        admin = User.query.get(admin_id)
        if not admin or not admin.role or admin.role.name != RoleName.DEPT_ADMIN:
            return jsonify({"message": "Administrateur de département introuvable"}), 404
        if admin.department_id:
            return jsonify({"message": "Cet administrateur est déjà rattaché à un département"}), 409

        admin.department_id = dept.id
        admin.is_blocked = True
        db.session.commit()

        SecurityService.log_event(
            get_jwt_identity(),
            "ADMIN_ASSIGN",
            f"Administrateur {admin.email} assigné au département {dept.name}",
            request.remote_addr,
            request.headers.get("User-Agent", ""),
            status="SUCCESS",
            department_id=dept.id,
        )

        return jsonify({
            "message": "Administrateur assigné — activez le nœud pour autoriser l'accès",
            "id": admin.id,
            "status": "inactive",
        }), 200

    username = data.get("username")
    email = data.get("email")
    password = data.get("password")

    if dept_id:
        dept = Department.query.get(dept_id)
        if not dept:
            return jsonify({"message": "Département non trouvé"}), 404
    else:
        dept = None

    role = Role.query.filter_by(name=RoleName.DEPT_ADMIN).first()
    if not role:
        return jsonify({"message": "Rôle administrateur département introuvable"}), 500

    user = User(
        username=username,
        email=email,
        password_hash=SecurityService.hash_password(password),
        role_id=role.id,
        department_id=dept.id if dept else None,
        is_blocked=True if not dept else False,
    )
    db.session.add(user)
    db.session.commit()

    return jsonify({
        "message": "Admin de département créé" + ("" if dept else " (sans département — à assigner)"),
        "id": user.id,
    }), 201

@admin_bp.route("/system-stats", methods=["GET"])
@jwt_required()
@super_admin_required
def get_system_stats():
    """Retourne les statistiques globales du système"""
    try:
        total_departments = Department.query.count()
        total_users = User.query.count()
        
        # Try to get equipment and alerts counts, default to 0 if tables don't exist
        total_equipment = 0
        security_alerts = 0
        
        try:
            total_equipment = Device.query.count()
        except:
            total_equipment = 0
            
        try:
            security_alerts = SecurityAlert.query.filter_by(is_resolved=False).count()
        except:
            security_alerts = 0
        
        return jsonify({
            "total_departments": total_departments,
            "total_users": total_users,
            "total_equipment": total_equipment,
            "security_alerts": security_alerts
        }), 200
    except Exception as e:
        # Return basic stats even if there's an error
        return jsonify({
            "total_departments": 0,
            "total_users": 0,
            "total_equipment": 0,
            "security_alerts": 0
        }), 200

@admin_bp.route("/logs", methods=["GET"])
@jwt_required()
@super_admin_required
def get_all_logs():
    logs = SecurityLog.query.order_by(SecurityLog.created_at.desc()).limit(100).all()
    return jsonify([{
        "id": l.id,
        "user_id": l.user_id,
        "action": l.action,
        "details": l.details,
        "ip": l.ip_address,
        "risk_level": l.risk_level,
        "status": l.status,
        "date": l.created_at.isoformat()
    } for l in logs]), 200

@admin_bp.route("/geofencing", methods=["GET"])
@jwt_required()
@super_admin_required
def get_geofencing_zones():
    """Retourne toutes les zones de geofencing configurées."""
    zones = AuthorizedZone.query.all()
    result = []
    for z in zones:
        result.append({
            "id": z.id,
            "name": z.name,
            "center_lat": z.center_lat,
            "center_lng": z.center_lng,
            "radius_meters": z.radius_meters,
            "polygon_points": z.polygon_points,
            "ip_subnets": z.ip_subnets,
            "department_id": z.department_id,
        })
    return jsonify(result), 200

@admin_bp.route("/geofencing", methods=["POST"])
@jwt_required()
@super_admin_required
def configure_geofencing():
    data = request.json
    name = data.get("name")
    lat = data.get("lat")
    lng = data.get("lng")
    radius = data.get("radius")
    dept_id = data.get("dept_id") # Optionnel
    polygon_points = data.get("polygon_points") # Liste JSON en string
    ip_subnets = data.get("ip_subnets") # Liste JSON en string
    
    zone = AuthorizedZone(
        name=name,
        center_lat=lat,
        center_lng=lng,
        radius_meters=radius,
        department_id=dept_id,
        polygon_points=polygon_points,
        ip_subnets=ip_subnets
    )
    db.session.add(zone)
    db.session.commit()
    
    return jsonify({"message": "Zone de sécurité créée", "id": zone.id}), 201


@admin_bp.route("/geofencing/zones", methods=["GET"])
@jwt_required()
def get_all_geofencing_zones():
    """Retourne toutes les zones (accessible à tout rôle de tracking)."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.role:
        return jsonify({"message": "Accès refusé"}), 403

    allowed = {RoleName.SUPER_ADMIN, "ADMIN_GENERAL", RoleName.DEPT_ADMIN, "ADMIN_DEPT",
               RoleName.SUPERVISOR, RoleName.SECURITY_AGENT}
    if user.role.name not in allowed:
        return jsonify({"message": "Accès refusé"}), 403

    zones = AuthorizedZone.query.all()
    result = []
    for z in zones:
        result.append({
            "id": z.id,
            "name": z.name,
            "center_lat": z.center_lat,
            "center_lng": z.center_lng,
            "radius_meters": z.radius_meters,
            "polygon_points": z.polygon_points,
            "department_id": z.department_id,
        })
    return jsonify(result), 200


@admin_bp.route("/alerts/location", methods=["GET"])
@jwt_required()
def get_location_alerts():
    """Retourne les alertes GPS non résolues (GPS_DISABLED, UNAUTHORIZED_EXIT)."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.role:
        return jsonify({"message": "Accès refusé"}), 403

    allowed = {RoleName.SUPER_ADMIN, "ADMIN_GENERAL", RoleName.DEPT_ADMIN, "ADMIN_DEPT"}
    if user.role.name not in allowed:
        return jsonify({"message": "Accès refusé"}), 403

    query = SecurityAlert.query.filter(
        SecurityAlert.type.in_(["GPS_DISABLED", "UNAUTHORIZED_EXIT"]),
        SecurityAlert.is_resolved == False
    )
    if user.role.name in {RoleName.DEPT_ADMIN, "ADMIN_DEPT"}:
        query = query.filter_by(department_id=user.department_id)

    alerts = query.order_by(SecurityAlert.created_at.desc()).all()
    result = []
    for a in alerts:
        # Find related device info
        device_info = None
        if "EQ-SIM" in (a.message or ""):
            # Extract serial from message
            for token in (a.message or "").split():
                if token.startswith("EQ-SIM"):
                    dev = Device.query.filter_by(serial_number=token).first()
                    if dev:
                        device_info = {"id": dev.id, "name": dev.name, "serial": dev.serial_number,
                                       "lat": dev.last_known_lat, "lng": dev.last_known_lng}
                    break
        result.append({
            "id": a.id,
            "type": a.type,
            "message": a.message,
            "department": a.department.name if a.department else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "is_resolved": a.is_resolved,
            "device": device_info,
        })
    return jsonify(result), 200


@admin_bp.route("/alerts/<alert_id>/resolve", methods=["POST"])
@jwt_required()
@super_admin_required
def resolve_location_alert(alert_id):
    """Résout une alerte GPS (seul l'admin général peut résoudre)."""
    from app.services.security_service import SecurityService

    alert = SecurityAlert.query.get(alert_id)
    if not alert:
        return jsonify({"message": "Alerte introuvable"}), 404

    alert.is_resolved = True
    
    # Resolve related incidents
    incidents = SecurityIncident.query.filter_by(alert_id=alert.id, status="OPEN").all()
    for inc in incidents:
        inc.status = "RESOLVED"
        inc.resolution_note = "Résolu par l'administrateur général"
        inc.resolved_at = datetime.utcnow()

    SecurityService.log_event(
        get_jwt_identity(),
        "ALERT_RESOLVED",
        f"Alerte {alert.type} résolue: {alert.message}",
        request.remote_addr,
        request.headers.get("User-Agent", ""),
        status="SUCCESS",
    )

    db.session.commit()
    return jsonify({"message": "Alerte résolue", "id": alert.id}), 200
@admin_bp.route("/dashboard/stats", methods=["GET"])
@jwt_required()
@super_admin_required
def get_global_stats():
    devices_count = Device.query.count()
    alerts_count = SecurityAlert.query.filter_by(is_resolved=False).count()
    pending_exits = ExitRequest.query.filter_by(status="PENDING").count()
    
    # Stats par département
    dept_stats = db.session.query(
        Department.name, 
        func.count(Device.id)
    ).join(Device, Department.id == Device.department_id).group_by(Department.name).all()
    
    return jsonify({
        "total_devices": devices_count,
        "active_alerts": alerts_count,
        "pending_exits": pending_exits,
        "department_distribution": [{"name": ds[0], "count": ds[1]} for ds in dept_stats]
    }), 200

@admin_bp.route("/departments", methods=["GET"])
@jwt_required()
@super_admin_required
def get_department_admins():
    """Retourne la liste de toutes les unités (départements) avec leurs admins respectifs"""
    try:
        # Récupérer tous les départements
        departments = Department.query.all()
        
        # Récupérer le rôle DEPT_ADMIN pour filtrer les admins
        dept_admin_role = Role.query.filter_by(name=RoleName.DEPT_ADMIN).first()
        
        result = []
        for dept in departments:
            # Trouver l'admin principal du département (le premier trouvé avec le rôle DEPT_ADMIN)
            admin = User.query.filter_by(department_id=dept.id, role_id=dept_admin_role.id).first()
            
            result.append({
                "id": admin.id if admin else f"dept-{dept.id}",
                "dept_id": dept.id,
                "name": admin.username if admin else "Aucun Administrateur",
                "email": admin.email if admin else "N/A",
                "department": dept.name,
                "role": "DEPT_ADMIN",
                "status": ("inactive" if admin.is_blocked else "active") if admin else "inactive",
                "lastLogin": admin.created_at.isoformat() if admin and admin.created_at else None,
                "is_empty": admin is None
            })

        return jsonify({
            "departments": result,
            "unassignedAdmins": _list_unassigned_dept_admins(),
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@admin_bp.route("/departments/<admin_id>/status", methods=["PUT"])
@jwt_required()
@super_admin_required
def update_admin_status(admin_id):
    """Met à jour le statut (active/inactive) d'un administrateur de département"""
    from app.services.security_service import SecurityService
    try:
        data = request.json or {}
        new_status = data.get("status")

        if new_status not in ["active", "inactive"]:
            return jsonify({"error": "Statut invalide. Doit être 'active' ou 'inactive'"}), 400

        admin = User.query.get(admin_id)
        if not admin:
            return jsonify({"error": "Administrateur non trouvé"}), 404

        if not admin.role or admin.role.name != RoleName.DEPT_ADMIN:
            return jsonify({"error": "Utilisateur n'est pas un administrateur de département"}), 400

        admin.is_blocked = (new_status == "inactive")
        db.session.commit()

        current_user_id = get_jwt_identity()
        SecurityService.log_event(
            current_user_id,
            "ADMIN_STATUS_CHANGE",
            f"Statut de {admin.email} changé à {new_status} (NODE_{'ACTIVE' if new_status == 'active' else 'LOCKED'})",
            request.remote_addr,
            request.headers.get("User-Agent", ""),
            status="SUCCESS",
            department_id=admin.department_id,
        )

        return jsonify({
            "message": f"Statut de l'administrateur mis à jour à {new_status}",
            "id": admin.id,
            "status": new_status,
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/departments/<admin_id>", methods=["PUT"])
@jwt_required()
@super_admin_required
def update_department_admin(admin_id):
    """Met à jour les informations d'un administrateur de département."""
    from app.services.security_service import SecurityService

    admin = User.query.get(admin_id)
    if not admin or not admin.role or admin.role.name != RoleName.DEPT_ADMIN:
        return jsonify({"error": "Administrateur de département introuvable"}), 404

    data = request.json or {}
    username = (data.get("username") or data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")

    if username:
        existing = User.query.filter(User.username == username, User.id != admin.id).first()
        if existing:
            return jsonify({"error": "Ce nom d'utilisateur existe déjà"}), 409
        admin.username = username

    if email:
        existing = User.query.filter(User.email == email, User.id != admin.id).first()
        if existing:
            return jsonify({"error": "Cet email existe déjà"}), 409
        admin.email = email

    if password:
        admin.password_hash = SecurityService.hash_password(password)

    db.session.commit()

    SecurityService.log_event(
        get_jwt_identity(),
        "ADMIN_UPDATE",
        f"Mise à jour administrateur {admin.email}",
        request.remote_addr,
        request.headers.get("User-Agent", ""),
        status="SUCCESS",
        department_id=admin.department_id,
    )

    return jsonify({
        "message": "Administrateur mis à jour",
        "id": admin.id,
        "name": admin.username,
        "email": admin.email,
    }), 200


@admin_bp.route("/dept-admins/unassigned", methods=["GET"])
@jwt_required()
@super_admin_required
def list_unassigned_dept_admins():
    """Chefs de département sans unité assignée."""
    return jsonify(_list_unassigned_dept_admins()), 200


@admin_bp.route("/departments/<dept_id>/admin", methods=["POST"])
@jwt_required()
@super_admin_required
def assign_department_admin(dept_id):
    """Assigne un administrateur existant ou crée un nouveau compte pour le département."""
    from app.services.security_service import SecurityService

    dept = Department.query.get(dept_id)
    if not dept:
        return jsonify({"error": "Département introuvable"}), 404

    dept_admin_role = Role.query.filter_by(name=RoleName.DEPT_ADMIN).first()
    if not dept_admin_role:
        return jsonify({"error": "Rôle administrateur département introuvable"}), 500

    existing_admin = User.query.filter_by(department_id=dept.id, role_id=dept_admin_role.id).first()
    if existing_admin:
        return jsonify({"error": "Ce département a déjà un administrateur"}), 409

    data = request.json or {}
    admin_id = data.get("adminId") or data.get("admin_id")

    if admin_id:
        admin = User.query.get(admin_id)
        if not admin or not admin.role or admin.role.name != RoleName.DEPT_ADMIN:
            return jsonify({"error": "Administrateur de département introuvable"}), 404
        if admin.department_id:
            return jsonify({"error": "Cet administrateur est déjà rattaché à un département"}), 409

        admin.department_id = dept.id
        admin.is_blocked = True
        db.session.commit()

        SecurityService.log_event(
            get_jwt_identity(),
            "ADMIN_ASSIGN",
            f"Administrateur {admin.email} assigné au département {dept.name}",
            request.remote_addr,
            request.headers.get("User-Agent", ""),
            status="SUCCESS",
            department_id=dept.id,
        )

        return jsonify({
            "message": "Administrateur assigné — activez le nœud pour autoriser l'accès",
            "id": admin.id,
            "name": admin.username,
            "email": admin.email,
            "status": "inactive",
        }), 200

    username = (data.get("username") or data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or "SetPassword123!"

    if not username or not email:
        return jsonify({"error": "Sélectionnez un administrateur ou fournissez nom et email"}), 400

    if User.query.filter((User.email == email) | (User.username == username)).first():
        return jsonify({"error": "Email ou nom d'utilisateur déjà utilisé"}), 409

    admin = User(
        username=username,
        email=email,
        password_hash=SecurityService.hash_password(password),
        role_id=dept_admin_role.id,
        department_id=dept.id,
        is_blocked=True,
    )
    db.session.add(admin)
    db.session.commit()

    SecurityService.log_event(
        get_jwt_identity(),
        "ADMIN_ASSIGN",
        f"Administrateur {email} assigné au département {dept.name}",
        request.remote_addr,
        request.headers.get("User-Agent", ""),
        status="SUCCESS",
        department_id=dept.id,
    )

    return jsonify({
        "message": "Administrateur assigné — activez le nœud pour autoriser l'accès",
        "id": admin.id,
        "status": "inactive",
    }), 201


@admin_bp.route("/departments/<dept_id>", methods=["DELETE"])
@jwt_required()
@super_admin_required
def delete_department(dept_id):
    """Supprime un département vide (sans utilisateurs ni équipements)."""
    from app.services.security_service import SecurityService

    dept = Department.query.get(dept_id)
    if not dept:
        return jsonify({"error": "Département introuvable"}), 404

    user_count = User.query.filter_by(department_id=dept.id).count()
    device_count = Device.query.filter_by(department_id=dept.id).count()

    if user_count > 0 or device_count > 0:
        return jsonify({
            "error": "Impossible de supprimer : des utilisateurs ou équipements sont encore rattachés",
            "users": user_count,
            "devices": device_count,
        }), 409

    dept_name = dept.name
    db.session.delete(dept)
    db.session.commit()

    SecurityService.log_event(
        get_jwt_identity(),
        "DEPARTMENT_DELETE",
        f"Suppression du département {dept_name}",
        request.remote_addr,
        request.headers.get("User-Agent", ""),
        status="SUCCESS",
    )

    return jsonify({"message": f"Département {dept_name} supprimé"}), 200

@admin_bp.route("/users", methods=["GET"])
@jwt_required()
@super_admin_required
def get_all_users():
    """Retourne la liste de tous les utilisateurs du système"""
    try:
        users = User.query.all()
        
        result = []
        for user in users:
            result.append({
                "id": user.id,
                "name": user.username,
                "email": user.email,
                "role": user.role.name,
                "department": user.department.name if user.department else None,
                "department_id": user.department_id,
                "status": "inactive" if user.is_blocked else "active",
                "createdAt": user.created_at.isoformat() if user.created_at else None,
                "lastSeen": user.created_at.isoformat() if user.created_at else None
            })
        
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@admin_bp.route("/users", methods=["POST"])
@jwt_required()
@super_admin_required
def create_user():
    """Crée un nouvel utilisateur"""
    from app.services.security_service import SecurityService
    try:
        data = request.json
        username = data.get("name")
        email = data.get("email")
        password = data.get("password")
        role_name = data.get("role", "USER")
        department_id = data.get("department_id")
        
        # Vérifier que l'email n'existe pas déjà
        if User.query.filter_by(email=email).first():
            return jsonify({"error": "Cet email existe déjà"}), 400
        
        # Récupérer le rôle
        role = Role.query.filter_by(name=role_name).first()
        if not role:
            return jsonify({"error": f"Rôle '{role_name}' non trouvé"}), 400
        
        # Vérifier le département si fourni
        if department_id:
            dept = Department.query.get(department_id)
            if not dept:
                return jsonify({"error": "Département non trouvé"}), 404
        
        # Créer l'utilisateur
        user = User(
            username=username,
            email=email,
            password_hash=SecurityService.hash_password(password),
            role_id=role.id,
            department_id=department_id if department_id else None,
            mfa_enabled=False
        )
        
        db.session.add(user)
        db.session.commit()
        
        # Enregistrer l'action
        current_user_id = get_jwt_identity()
        SecurityService.log_event(
            current_user_id,
            "USER_CREATED",
            f"Nouvel utilisateur créé: {email} ({role_name})",
            request.remote_addr,
            request.headers.get("User-Agent"),
            status="SUCCESS"
        )
        
        return jsonify({
            "message": "Utilisateur créé avec succès",
            "id": user.id
        }), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@admin_bp.route("/users/<user_id>/role", methods=["PUT"])
@jwt_required()
@super_admin_required
def update_user_role(user_id):
    """Met à jour le rôle et/ou le département d'un utilisateur."""
    from app.services.security_service import SecurityService
    try:
        data = request.json or {}
        new_role_name = data.get("role")
        department_id = data.get("department_id")

        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "Utilisateur non trouvé"}), 404

        if new_role_name:
            role = Role.query.filter_by(name=new_role_name).first()
            if not role:
                return jsonify({"error": f"Rôle '{new_role_name}' non trouvé"}), 400
            user.role_id = role.id

        if department_id is not None:
            dept = Department.query.get(department_id)
            if not dept:
                return jsonify({"error": "Département non trouvé"}), 404

            dept_admin_role = Role.query.filter_by(name=RoleName.DEPT_ADMIN).first()
            if dept_admin_role:
                existing = User.query.filter(
                    User.department_id == dept.id,
                    User.role_id == dept_admin_role.id,
                    User.id != user.id,
                ).first()
                if existing:
                    return jsonify({"error": "Ce département a déjà un administrateur"}), 409

            user.department_id = department_id
            user.is_blocked = True

        if not new_role_name and department_id is None:
            return jsonify({"error": "Rôle ou department_id requis"}), 400

        db.session.commit()

        current_user_id = get_jwt_identity()
        SecurityService.log_event(
            current_user_id,
            "ADMIN_ASSIGN" if department_id else "ROLE_CHANGED",
            f"Utilisateur {user.email} — rôle={new_role_name or user.role.name}, dept={department_id or user.department_id}",
            request.remote_addr,
            request.headers.get("User-Agent", ""),
            status="SUCCESS",
            department_id=department_id or user.department_id,
        )

        return jsonify({
            "message": "Utilisateur mis à jour",
            "id": user.id,
            "role": user.role.name if user.role else None,
            "department_id": user.department_id,
            "status": "inactive" if user.is_blocked else "active",
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/users/<user_id>/activation", methods=["PUT"])
@jwt_required()
@super_admin_required
def update_user_activation(user_id):
    """Active ou désactive un compte utilisateur (validation super admin)."""
    from app.services.security_service import SecurityService
    try:
        data = request.json or {}
        active = data.get("active")

        if active is None:
            return jsonify({"error": "Le champ 'active' est requis"}), 400

        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "Utilisateur non trouvé"}), 404

        if user.role.name == RoleName.SUPER_ADMIN:
            return jsonify({"error": "Impossible de modifier l'activation du super admin"}), 400

        user.is_blocked = (not bool(active))
        db.session.commit()

        current_user_id = get_jwt_identity()
        SecurityService.log_event(
            current_user_id,
            "USER_ACTIVATION_UPDATED",
            f"Activation utilisateur {user.email} => {'active' if active else 'inactive'}",
            request.remote_addr,
            request.headers.get("User-Agent"),
            status="SUCCESS"
        )

        return jsonify({
            "message": "Activation mise à jour",
            "id": user.id,
            "status": "active" if active else "inactive"
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@admin_bp.route("/users/<user_id>", methods=["DELETE"])
@jwt_required()
@super_admin_required
def delete_user(user_id):
    """Supprime un utilisateur du système"""
    from app.services.security_service import SecurityService
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "Utilisateur non trouvé"}), 404
        
        # Empêcher la suppression du super admin
        if user.role.name == RoleName.SUPER_ADMIN:
            return jsonify({"error": "Impossible de supprimer un Super Administrateur"}), 400
        
        email = user.email
        db.session.delete(user)
        db.session.commit()
        
        # Enregistrer l'action
        current_user_id = get_jwt_identity()
        SecurityService.log_event(
            current_user_id,
            "USER_DELETED",
            f"Utilisateur supprimé: {email}",
            request.remote_addr,
            request.headers.get("User-Agent"),
            status="SUCCESS"
        )
        
        return jsonify({
            "message": f"Utilisateur {email} supprimé avec succès"
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/devices/<device_id>/restore", methods=["POST"])
@jwt_required()
@super_admin_required
def restore_seized_device(device_id):
    """Restitue un matériel saisi / sorti."""
    from app.services.security_service import SecurityService

    device = Device.query.get(device_id)
    if not device:
        return jsonify({"message": "Matériel introuvable"}), 404

    data = request.json or {}
    device.status = data.get("status", "ASSIGNED" if device.user_id else "AVAILABLE")

    SecurityService.log_event(
        get_jwt_identity(),
        "DEVICE_RESTORED",
        json.dumps({
            "message": data.get("note", "Matériel restitué par admin général"),
            "device_id": device.id,
            "new_status": device.status,
        }),
        request.remote_addr,
        request.headers.get("User-Agent") or "",
        department_id=device.department_id,
    )
    return jsonify({"message": "Matériel restitué", "device_id": device.id, "status": device.status}), 200


@admin_bp.route("/incidents/<incident_id>/resolve", methods=["POST"])
@jwt_required()
@super_admin_required
def resolve_incident(incident_id):
    """Tranche un incident de sécurité."""
    incident = SecurityIncident.query.get(incident_id)
    if not incident:
        return jsonify({"message": "Incident introuvable"}), 404

    data = request.json or {}
    incident.status = "RESOLVED"
    incident.resolution_note = data.get("note", "Résolu par admin général")
    incident.resolved_at = datetime.utcnow()

    if incident.alert_id:
        alert = SecurityAlert.query.get(incident.alert_id)
        if alert:
            alert.is_resolved = True

    db.session.commit()
    return jsonify({"message": "Incident résolu", "id": incident.id}), 200
