from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.security_models import Device, ExitRequest, SecurityLog, User, RoleName
from app.services.security_service import SecurityService
from app.database import db
from datetime import datetime, timedelta
import json

user_bp = Blueprint("user", __name__)

@user_bp.route("/devices/register", methods=["POST"])
@jwt_required()
def register_device():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    data = request.json
    name = data.get("name")
    serial = data.get("serial")
    
    if Device.query.filter_by(serial_number=serial).first():
        return jsonify({"message": "Numéro de série déjà enregistré"}), 400
        
    device = Device(
        name=name,
        serial_number=serial,
        user_id=user_id,
        department_id=user.department_id
    )
    db.session.add(device)
    db.session.commit()
    
    return jsonify({"message": "Équipement enregistré", "id": device.id}), 201

@user_bp.route("/exits/request", methods=["POST"])
@jwt_required()
def request_exit():
    user_id = get_jwt_identity()
    data = request.json
    device_id = data.get("device_id")
    reason = data.get("reason")
    
    device = Device.query.get(device_id)
    if not device or device.user_id != user_id:
        return jsonify({"message": "Équipement non trouvé ou ne vous appartient pas"}), 403
        
    req = ExitRequest(
        device_id=device_id,
        user_id=user_id,
        reason=reason,
        status="PENDING"
    )
    device.status = "EXIT_REQUESTED"
    db.session.add(req)
    db.session.commit()
    
    return jsonify({"message": "Demande de sortie envoyée", "id": req.id}), 201

@user_bp.route("/activities", methods=["GET"])
@jwt_required()
def get_own_activity():
    user_id = get_jwt_identity()
    
    logs = SecurityLog.query.filter_by(user_id=user_id).order_by(SecurityLog.created_at.desc()).limit(50).all()
    return jsonify([{
        "id": l.id,
        "action": l.action,
        "details": l.details,
        "status": l.status,
        "date": l.created_at.isoformat()
    } for l in logs]), 200

@user_bp.route("/devices/position", methods=["POST"])
@jwt_required()
def update_position():
    """Simule la mise à jour GPS d'un équipement"""
    user_id = get_jwt_identity()
    data = request.json
    device_id = data.get("device_id")
    lat = data.get("lat")
    lng = data.get("lng")
    
    device = Device.query.get(device_id)
    if not device or device.user_id != user_id:
        return jsonify({"message": "Équipement non autorisé"}), 403
        
    device.last_known_lat = lat
    device.last_known_lng = lng
    
    # Vérification géofencing
    is_safe = SecurityService.check_geofencing(device_id)
    
    if not is_safe:
        device.status = "OUT_OF_ZONES"
        SecurityService.create_alert(user_id, "UNAUTHORIZED_EXIT", f"Sortie non autorisée: {device.name} hors zone.")
        SecurityService.log_event(user_id, "GEOFENCE_BREACH", f"Sortie non autorisée détectée pour {device.name}", request.remote_addr, request.headers.get("User-Agent"), status="ALERT", risk_score=80)
        db.session.commit()
        return jsonify({"message": "ALERTE: Hors zone autorisée", "status": "ALERT"}), 200
    
    db.session.commit()
    return jsonify({"message": "Position mise à jour"}), 200

@user_bp.route("/devices/with-location", methods=["GET"])
@jwt_required()
def get_devices_with_location():
    """Récupère tous les matériels de l'utilisateur avec leur localisation"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    devices = Device.query.filter_by(user_id=user_id).all()
    
    result = []
    for device in devices:
        result.append({
            "id": device.id,
            "name": device.name,
            "serial_number": device.serial_number,
            "status": device.status,
            "latitude": device.last_known_lat,
            "longitude": device.last_known_lng,
            "department": device.department.name if device.department else None,
            "assigned_to": user.username if device.user_id else None
        })
    
    return jsonify(result), 200

@user_bp.route("/department/devices-map", methods=["GET"])
@jwt_required()
def get_department_devices_map():
    """Récupère tous les matériels du département avec localisation (pour admins)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    # Vérifier que c'est un admin de département
    if user.role.name != RoleName.DEPT_ADMIN:
        return jsonify({"message": "Accès refusé"}), 403
    
    devices = Device.query.filter_by(department_id=user.department_id).all()
    
    result = []
    for device in devices:
        result.append({
            "id": device.id,
            "name": device.name,
            "serial_number": device.serial_number,
            "status": device.status,
            "latitude": device.last_known_lat,
            "longitude": device.last_known_lng,
            "department": device.department.name if device.department else None,
            "assigned_to": device.user.username if device.user else "Non assigné"
        })
    
    return jsonify(result), 200


@user_bp.route("/connected-users/with-location", methods=["GET"])
@jwt_required()
def get_connected_users_with_location():
    """Retourne les utilisateurs récemment connectés avec leur dernière position connue."""
    current_user_id = get_jwt_identity()
    requester = User.query.get(current_user_id)

    if not requester:
        return jsonify({"message": "Utilisateur connecté introuvable"}), 404

    allowed_roles = {
        RoleName.SUPER_ADMIN,
        RoleName.DEPT_ADMIN,
        RoleName.SUPERVISOR,
        RoleName.SECURITY_AGENT,
    }
    if not requester.role or requester.role.name not in allowed_roles:
        return jsonify({"message": "Accès refusé"}), 403

    online_since = datetime.utcnow() - timedelta(hours=8)

    base_query = User.query.filter_by(is_blocked=False)
    if requester.role.name in {RoleName.DEPT_ADMIN, RoleName.SUPERVISOR, RoleName.SECURITY_AGENT}:
        base_query = base_query.filter_by(department_id=requester.department_id)

    users = base_query.all()
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
        source = None

        user_device = Device.query.filter(
            Device.user_id == user.id,
            Device.last_known_lat.isnot(None),
            Device.last_known_lng.isnot(None)
        ).first()

        if user_device:
            lat = user_device.last_known_lat
            lng = user_device.last_known_lng
            source = "device"
        else:
            # Fallback: localisation envoyée lors du login
            try:
                details = json.loads(last_login.details or "{}")
                location = details.get("location") if isinstance(details, dict) else None
                if isinstance(location, dict):
                    lat = location.get("lat")
                    lng = location.get("lng")
                    source = "login"
            except Exception:
                pass

        payload.append({
            "id": user.id,
            "name": user.username,
            "email": user.email,
            "role": user.role.name if user.role else None,
            "department": user.department.name if user.department else None,
            "lat": lat,
            "lng": lng,
            "last_login": last_login.created_at.isoformat(),
            "location_source": source or "unavailable",
            "has_location": lat is not None and lng is not None,
            "status": "ONLINE",
        })

    return jsonify(payload), 200
