from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from app.models.security_models import User, Role, RoleName, Department, SecurityLog, AuthorizedZone, Device, SecurityAlert, ExitRequest
# from app.services.security_service import SecurityService
from app.middleware.rbac import super_admin_required
from app.database import db

admin_bp = Blueprint("admin", __name__)

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
    data = request.json
    username = data.get("username")
    email = data.get("email")
    password = data.get("password")
    dept_id = data.get("dept_id")
    
    dept = Department.query.get(dept_id)
    if not dept:
        return jsonify({"message": "Département non trouvé"}), 404
        
    role = Role.query.filter_by(name=RoleName.DEPT_ADMIN).first()
    
    user = User(
        username=username,
        email=email,
        password_hash=SecurityService.hash_password(password),
        role_id=role.id,
        department_id=dept.id
    )
    db.session.add(user)
    db.session.commit()
    
    return jsonify({"message": "Admin de département créé", "id": user.id}), 201

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
            security_alerts = SecurityAlert.query.count()
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

@admin_bp.route("/geofencing", methods=["POST"])
@jwt_required()
@super_admin_required
def configure_geofencing():
    data = request.json
    name = data.get("name")
    lat = data.get("lat")
    lng = data.get("lng")
    radius = data.get("radius")
    dept_id = data.get("dept_id") # Optinnel
    
    zone = AuthorizedZone(
        name=name,
        center_lat=lat,
        center_lng=lng,
        radius_meters=radius,
        department_id=dept_id
    )
    db.session.add(zone)
    db.session.commit()
    
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
    """Retourne la liste de tous les administrateurs de département"""
    try:
        # Récupérer tous les utilisateurs avec rôle DEPT_ADMIN
        dept_admin_role = Role.query.filter_by(name=RoleName.DEPT_ADMIN).first()
        
        admins = User.query.filter_by(role_id=dept_admin_role.id).all()
        
        result = []
        for admin in admins:
            result.append({
                "id": admin.id,
                "name": admin.username,
                "email": admin.email,
                "department": admin.department.name if admin.department else "Non assigné",
                "department_id": admin.department_id,
                "role": admin.role.name,
                "status": "inactive" if admin.is_blocked else "active",
                "lastLogin": admin.created_at.isoformat() if admin.created_at else None
            })
        
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@admin_bp.route("/departments/<admin_id>/status", methods=["PUT"])
@jwt_required()
@super_admin_required
def update_admin_status(admin_id):
    """Met à jour le statut (active/inactive) d'un administrateur de département"""
    from app.services.security_service import SecurityService
    try:
        data = request.json
        new_status = data.get("status")
        
        if new_status not in ["active", "inactive"]:
            return jsonify({"error": "Statut invalide. Doit être 'active' ou 'inactive'"}), 400
        
        admin = User.query.get(admin_id)
        if not admin:
            return jsonify({"error": "Administrateur non trouvé"}), 404
        
        # Vérifier que c'est bien un DEPT_ADMIN
        if admin.role.name != RoleName.DEPT_ADMIN:
            return jsonify({"error": "Utilisateur n'est pas un administrateur de département"}), 400
        
        # Mettre à jour le statut (is_blocked = True pour inactive, False pour active)
        admin.is_blocked = (new_status == "inactive")
        db.session.commit()
        
        # Enregistrer l'action
        current_user_id = get_jwt_identity()
        SecurityService.log_event(
            current_user_id, 
            "ADMIN_STATUS_CHANGE",
            f"Statut de {admin.email} changé à {new_status}",
            request.remote_addr,
            request.headers.get("User-Agent"),
            status="SUCCESS"
        )
        
        return jsonify({
            "message": f"Statut de l'administrateur mis à jour à {new_status}",
            "id": admin.id,
            "status": new_status
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
    """Met à jour le rôle d'un utilisateur"""
    from app.services.security_service import SecurityService
    try:
        data = request.json
        new_role_name = data.get("role")
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "Utilisateur non trouvé"}), 404
        
        role = Role.query.filter_by(name=new_role_name).first()
        if not role:
            return jsonify({"error": f"Rôle '{new_role_name}' non trouvé"}), 400
        
        user.role_id = role.id
        db.session.commit()
        
        # Enregistrer l'action
        current_user_id = get_jwt_identity()
        SecurityService.log_event(
            current_user_id,
            "ROLE_CHANGED",
            f"Rôle de {user.email} changé à {new_role_name}",
            request.remote_addr,
            request.headers.get("User-Agent"),
            status="SUCCESS"
        )
        
        return jsonify({
            "message": f"Rôle de l'utilisateur mis à jour à {new_role_name}",
            "id": user.id,
            "role": new_role_name
        }), 200
    except Exception as e:
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
