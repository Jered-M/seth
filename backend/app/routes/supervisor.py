import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.database import db
from app.middleware.rbac import supervisor_required
from app.models.security_models import User, Role, RoleName, Device, SecurityLog
from app.services.security_service import SecurityService


supervisor_bp = Blueprint("supervisor", __name__)


@supervisor_bp.route("/users", methods=["GET"])
@jwt_required()
@supervisor_required
def list_department_users():
    """Liste les utilisateurs du département du superviseur."""
    supervisor = User.query.get(get_jwt_identity())
    if not supervisor or not supervisor.department_id:
        return jsonify({"message": "Département superviseur introuvable"}), 400

    user_role = Role.query.filter_by(name=RoleName.USER).first()
    if not user_role:
        return jsonify({"message": "Rôle utilisateur introuvable"}), 500

    users = User.query.filter_by(
        department_id=supervisor.department_id,
        role_id=user_role.id
    ).all()

    result = []
    for user in users:
        assigned_device = Device.query.filter_by(user_id=user.id).first()
        result.append({
            "id": user.id,
            "name": user.username,
            "email": user.email,
            "department": user.department.name if user.department else None,
            "status": "inactive" if user.is_blocked else "active",
            "assigned_device": {
                "id": assigned_device.id,
                "name": assigned_device.name,
                "serial": assigned_device.serial_number,
            } if assigned_device else None,
            "createdAt": user.created_at.isoformat() if user.created_at else None,
        })

    return jsonify(result), 200


@supervisor_bp.route("/users", methods=["POST"])
@jwt_required()
@supervisor_required
def create_department_user():
    """Crée un utilisateur dans le département du superviseur."""
    data = request.json or {}
    username = data.get("name") or data.get("username")
    email = data.get("email")
    password = data.get("password")

    if not username or not email or not password:
        return jsonify({"message": "name, email et password sont requis"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"message": "Cet email existe déjà"}), 409

    if User.query.filter_by(username=username).first():
        return jsonify({"message": "Ce nom d'utilisateur existe déjà"}), 409

    supervisor = User.query.get(get_jwt_identity())
    if not supervisor or not supervisor.department_id:
        return jsonify({"message": "Département superviseur introuvable"}), 400

    role = Role.query.filter_by(name=RoleName.USER).first()
    if not role:
        return jsonify({"message": "Rôle utilisateur introuvable"}), 500

    user = User(
        username=username,
        email=email,
        password_hash=SecurityService.hash_password(password),
        role_id=role.id,
        department_id=supervisor.department_id,
        mfa_enabled=False,
    )
    db.session.add(user)
    db.session.commit()

    SecurityService.log_event(
        supervisor.id,
        "SUPERVISOR_USER_CREATED",
        f"Utilisateur {email} créé par superviseur",
        request.remote_addr,
        request.headers.get("User-Agent"),
    )

    return jsonify({"message": "Utilisateur créé", "id": user.id}), 201


@supervisor_bp.route("/devices", methods=["GET"])
@jwt_required()
@supervisor_required
def list_department_devices():
    """Liste les matériels du département du superviseur."""
    supervisor = User.query.get(get_jwt_identity())
    if not supervisor or not supervisor.department_id:
        return jsonify({"message": "Département superviseur introuvable"}), 400

    devices = Device.query.filter_by(department_id=supervisor.department_id).all()
    return jsonify([
        {
            "id": d.id,
            "name": d.name,
            "serial": d.serial_number,
            "status": d.status,
            "assigned_to": d.user.username if d.user else None,
        }
        for d in devices
    ]), 200


@supervisor_bp.route("/users/<user_id>/assign-device", methods=["POST"])
@jwt_required()
@supervisor_required
def assign_device_to_user(user_id):
    """Assigne un matériel de son département à un utilisateur du même département."""
    data = request.json or {}
    device_id = data.get("device_id")
    if not device_id:
        return jsonify({"message": "device_id requis"}), 400

    supervisor = User.query.get(get_jwt_identity())
    if not supervisor or not supervisor.department_id:
        return jsonify({"message": "Département superviseur introuvable"}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"message": "Utilisateur introuvable"}), 404

    if user.department_id != supervisor.department_id:
        return jsonify({"message": "Utilisateur hors de votre département"}), 403

    device = Device.query.get(device_id)
    if not device:
        return jsonify({"message": "Matériel introuvable"}), 404

    if device.department_id != supervisor.department_id:
        return jsonify({"message": "Matériel hors de votre département"}), 403

    device.user_id = user.id
    device.status = "ASSIGNED"
    db.session.commit()

    SecurityService.log_event(
        supervisor.id,
        "SUPERVISOR_DEVICE_ASSIGNED",
        f"Matériel {device.serial_number} assigné à {user.email}",
        request.remote_addr,
        request.headers.get("User-Agent"),
    )

    return jsonify({"message": "Matériel assigné", "device_id": device.id, "user_id": user.id}), 200


@supervisor_bp.route("/users/locations", methods=["GET"])
@jwt_required()
@supervisor_required
def list_user_last_locations():
    """Retourne la dernière localisation connue à la connexion pour les utilisateurs du département."""
    supervisor = User.query.get(get_jwt_identity())
    if not supervisor or not supervisor.department_id:
        return jsonify({"message": "Département superviseur introuvable"}), 400

    user_role = Role.query.filter_by(name=RoleName.USER).first()
    if not user_role:
        return jsonify({"message": "Rôle utilisateur introuvable"}), 500

    users = User.query.filter_by(
        department_id=supervisor.department_id,
        role_id=user_role.id
    ).all()

    result = []
    for user in users:
        last_login = SecurityLog.query.filter_by(
            user_id=user.id,
            action="LOGIN",
            status="SUCCESS"
        ).order_by(SecurityLog.created_at.desc()).first()

        location = None
        if last_login and last_login.details:
            try:
                parsed = json.loads(last_login.details)
                location = parsed.get("location")
            except (TypeError, json.JSONDecodeError):
                location = None

        result.append({
            "user_id": user.id,
            "name": user.username,
            "email": user.email,
            "last_login": last_login.created_at.isoformat() if last_login else None,
            "ip": last_login.ip_address if last_login else None,
            "location": location,
        })

    return jsonify(result), 200