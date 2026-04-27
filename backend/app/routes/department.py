from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from app.models.security_models import User, Role, RoleName, Device, ExitRequest, SecurityLog, Department
from app.services.security_service import SecurityService
from app.middleware.rbac import dept_admin_required
from app.database import get_db_connection, db
from sqlalchemy import inspect
from datetime import datetime, timedelta
import json
import os
import traceback

dept_bp = Blueprint("dept", __name__)

@dept_bp.route("/health", methods=["GET"])
def health_check():
    """Endpoint de diagnostic pour vérifier la connexion à la base de données"""
    try:
        from app.database import db
        
        # Vérifier le type de base de données
        db_dialect = db.engine.dialect.name
        
        # Essayer une simple requête
        connection = db.engine.raw_connection()
        cursor = connection.cursor()
        
        if db_dialect == 'sqlite':
            cursor.execute("SELECT 1")
        elif db_dialect == 'postgresql':
            cursor.execute("SELECT 1")
        else:  # MySQL
            cursor.execute("SELECT 1")
        
        cursor.close()
        connection.close()
        
        # Compter les tables
        inspector = db.inspect(db.engine)
        tables = inspector.get_table_names()
        
        return jsonify({
            "status": "healthy",
            "database": db_dialect,
            "tables_count": len(tables),
            "tables": tables[:10]  # Afficher les 10 premières tables
        }), 200
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "error": str(e),
            "message": "Database connection failed"
        }), 500

@dept_bp.route("/all", methods=["GET"])
def get_all_departments():
    """Récupère tous les départements"""
    try:
        # Utiliser SQLAlchemy ORM pour une meilleure compatibilité multi-base
        departments = Department.query.order_by(Department.name).all()
        
        return jsonify([
            {
                "id": str(dept.id),
                "name": dept.name,
                "admin_count": 0,
                "equipment_count": 0,
                "active_users": 0
            }
            for dept in departments
        ]), 200
    except Exception as e:
        error_msg = str(e)
        traceback_str = traceback.format_exc()
        print(f"Error in get_all_departments: {error_msg}")
        print(f"Traceback: {traceback_str}")
        return jsonify({
            "message": f"Database error: {error_msg}",
            "debug": traceback_str if os.getenv("FLASK_ENV") == "development" else None
        }), 500

@dept_bp.route("/stats", methods=["GET"])
def get_dept_stats_alias():
    """Récupère les statistiques des départements"""
    try:
        from sqlalchemy import func
        
        # Utiliser SQLAlchemy pour compter les données
        total_departments = Department.query.count()
        total_users = User.query.count()
        total_equipment = Device.query.count()
        security_alerts = 0  # À implémenter si une table d'alertes existe
        
        return jsonify({
            "data": {
                "total_departments": total_departments,
                "total_users": total_users,
                "total_equipment": total_equipment,
                "security_alerts": security_alerts
            }
        }), 200
    except Exception as e:
        print(f"Error in get_dept_stats_alias: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            "data": {
                "total_departments": 0,
                "total_users": 0,
                "total_equipment": 0,
                "security_alerts": 0
            }
        }), 200

@dept_bp.route("/create", methods=["POST"])
def create_department():
    """Créer un nouveau département"""
    try:
        data = request.get_json()
        name = data.get("name") if data else None
        
        if not name or not str(name).strip():
            return jsonify({"message": "Le nom du département est requis"}), 400
        
        name = str(name).strip()
        
        # Vérifier que le département n'existe pas déjà
        existing = Department.query.filter_by(name=name).first()
        if existing:
            return jsonify({"message": "Un département avec ce nom existe déjà"}), 409
        
        # Créer le département
        dept = Department(name=name)
        db.session.add(dept)
        db.session.commit()
        
        return jsonify({
            "id": str(dept.id),
            "name": dept.name,
            "message": "Département créé avec succès"
        }), 201
    
    except Exception as e:
        db.session.rollback()
        print(f"Error creating department: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({"message": f"Erreur lors de la création: {str(e)}"}), 500


@dept_bp.route("/users", methods=["GET"])
@jwt_required()
@dept_admin_required
def get_dept_users():
    claims = get_jwt()
    dept_id = claims["dept"]

    users = User.query.filter_by(department_id=dept_id).all()
    return jsonify([
        {
            "id": u.id,
            "name": u.username,
            "email": u.email,
            "role": u.role.name if u.role else None,
            "department": u.department.name if u.department else None,
            "department_id": u.department_id,
            "status": "inactive" if u.is_blocked else "active",
            "createdAt": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]), 200

@dept_bp.route("/users", methods=["POST"])
@jwt_required()
@dept_admin_required
def create_dept_user():
    data = request.json or {}
    username = data.get("username") or data.get("name")
    email = data.get("email")
    password = data.get("password")

    if not username or not email or not password:
        return jsonify({"message": "name/username, email et password sont requis"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"message": "Cet email existe déjà"}), 409

    if User.query.filter_by(username=username).first():
        return jsonify({"message": "Ce nom d'utilisateur existe déjà"}), 409
    
    claims = get_jwt()
    dept_id = claims.get("dept")
    
    # Vérifier que le département existe
    if not dept_id:
        return jsonify({"message": "Département manquant dans le token"}), 400
    
    dept = Department.query.get(dept_id)
    if not dept:
        return jsonify({"message": f"Département {dept_id} introuvable"}), 404
    
    role = Role.query.filter_by(name=RoleName.USER).first()
    if not role:
        return jsonify({"message": "Rôle USER introuvable"}), 500

    creator_id = get_jwt_identity()
    creator = User.query.get(creator_id)
    creator_role = creator.role.name if creator and creator.role else None
    requires_super_admin_approval = creator_role == RoleName.DEPT_ADMIN
    
    try:
        user = User(
            username=username,
            email=email,
            password_hash=SecurityService.hash_password(password),
            role_id=role.id,
            department_id=dept_id,
            is_blocked=requires_super_admin_approval
        )
        db.session.add(user)
        db.session.commit()

        if requires_super_admin_approval:
            SecurityService.log_event(
                creator_id,
                "USER_CREATED_BY_DEPT_ADMIN",
                f"Utilisateur {user.id} ({email}) créé en attente d'activation super admin",
                request.remote_addr,
                request.headers.get("User-Agent"),
                status="PENDING_APPROVAL"
            )

            return jsonify({
                "message": "Utilisateur créé. En attente d'activation par le super admin.",
                "id": user.id,
                "status": "pending_super_admin_approval"
            }), 201
        
        return jsonify({"message": "Utilisateur créé dans le département", "id": user.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Erreur lors de la création: {str(e)}"}), 500

@dept_bp.route("/devices", methods=["GET"])
@jwt_required()
@dept_admin_required
def get_dept_devices():
    claims = get_jwt()
    dept_id = claims["dept"]
    
    devices = Device.query.filter_by(department_id=dept_id).all()
    return jsonify([{
        "id": d.id,
        "name": d.name,
        "serial": d.serial_number,
        "status": d.status,
        "user": d.user.username if d.user else "Non assigné"
    } for d in devices]), 200

@dept_bp.route("/exits/validate", methods=["POST"])
@jwt_required()
@dept_admin_required
def validate_exit():
    data = request.json
    request_id = data.get("request_id")
    action = data.get("action") # APPROVED, REJECTED
    
    exit_req = ExitRequest.query.get(request_id)
    if not exit_req:
        return jsonify({"message": "Demande non trouvée"}), 404
        
    claims = get_jwt()
    if exit_req.user.department_id != claims["dept"]:
        return jsonify({"message": "Accès non autorisé à ce département"}), 403
        
    exit_req.status = action
    exit_req.approved_by = get_jwt_identity()
    
    # Mettre à jour le statut de l'équipement
    if action == "APPROVED":
        exit_req.device.status = "EXIT_AUTHORIZED"
    else:
        exit_req.device.status = "AVAILABLE"
        
    db.session.commit()
    return jsonify({"message": f"Demande {action}"}), 200

@dept_bp.route("/logs", methods=["GET"])
@jwt_required()
@dept_admin_required
def get_dept_logs():
    claims = get_jwt()
    dept_id = claims["dept"]
    
    logs = SecurityLog.query.filter_by(department_id=dept_id).order_by(SecurityLog.created_at.desc()).limit(100).all()
    return jsonify([{
        "id": log.id,
        "action": log.action,
        "details": log.details,
        "created_at": log.created_at.isoformat() if log.created_at else None,
        "status": log.status
    } for log in logs]), 200

@dept_bp.route("/dashboard/stats", methods=["GET"])
@jwt_required()
@dept_admin_required
def get_dept_stats():
    claims = get_jwt()
    dept_id = claims["dept"]
    from app.models.security_models import Device, SecurityAlert, ExitRequest
    
    devices_count = Device.query.filter_by(department_id=dept_id).count()
    alerts_count = SecurityAlert.query.filter_by(department_id=dept_id, is_resolved=False).count()
    pending_exits = ExitRequest.query.join(User, ExitRequest.user_id == User.id).filter(User.department_id == dept_id, ExitRequest.status == "PENDING").count()
    
    return jsonify({
        "devices": devices_count,
        "active_alerts": alerts_count,
        "pending_exits": pending_exits
    }), 200


@dept_bp.route("/connected-users/locations", methods=["GET"])
@jwt_required()
@dept_admin_required
def get_connected_users_locations():
    """Retourne les utilisateurs du département récemment connectés avec position connue."""
    claims = get_jwt()
    dept_id = claims["dept"]
    online_since = datetime.utcnow() - timedelta(hours=8)

    users = User.query.filter_by(department_id=dept_id, is_blocked=False).all()
    payload = []

    for user in users:
        last_login = SecurityLog.query.filter_by(
            user_id=user.id,
            action="LOGIN",
            status="SUCCESS"
        ).order_by(SecurityLog.created_at.desc()).first()

        if not last_login or last_login.created_at < online_since:
            continue

        lat = None
        lng = None
        source = "unavailable"

        try:
            details = json.loads(last_login.details or "{}")
            if isinstance(details, dict):
                location = details.get("location")
                if isinstance(location, dict):
                    lat = location.get("lat")
                    lng = location.get("lng")
                    if lat is not None and lng is not None:
                        source = "login"
        except Exception:
            pass

        if lat is None or lng is None:
            device = Device.query.filter(
                Device.user_id == user.id,
                Device.last_known_lat.isnot(None),
                Device.last_known_lng.isnot(None)
            ).first()
            if device:
                lat = device.last_known_lat
                lng = device.last_known_lng
                source = "device"

        payload.append({
            "id": user.id,
            "name": user.username,
            "email": user.email,
            "role": user.role.name if user.role else None,
            "department": user.department.name if user.department else None,
            "lat": lat,
            "lng": lng,
            "has_location": lat is not None and lng is not None,
            "location_source": source,
            "last_login": last_login.created_at.isoformat(),
            "status": "ONLINE",
        })

    return jsonify(payload), 200
