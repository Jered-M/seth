from flask import Blueprint, request, jsonify
from app.models.security_models import User, Role, UserDevice, RoleName, Device
from app.services.security_service import SecurityService
from app.database import db
import pyotp
import json

auth_bp = Blueprint("auth", __name__)


def _sync_user_devices_location(user_id: str, location: dict):
    """Propagate login geolocation to all devices assigned to the user."""
    if not isinstance(location, dict):
        return

    lat = location.get("lat")
    lng = location.get("lng")
    if lat is None or lng is None:
        return

    devices = Device.query.filter_by(user_id=user_id).all()
    for device in devices:
        device.last_known_lat = lat
        device.last_known_lng = lng

    if devices:
        db.session.commit()

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email", "").lower().strip()
    password = data.get("password")
    location = data.get("location")
    user_agent = request.headers.get("User-Agent")
    ip = request.remote_addr
    
    print(f"DEBUG: Login attempt for email={email}, IP={ip}")
    user = User.query.filter(User.email.ilike(email)).first()
    
    if not user:
        print(f"DEBUG: User not found for email={email}")
        return jsonify({"message": "Identifiants invalides"}), 401
        
    if not SecurityService.verify_password(password, user.password_hash):
        print(f"DEBUG: Password mismatch for user={email}")
        SecurityService.log_event(user.id, "LOGIN", "Échec de connexion", ip, user_agent, status="FAILED")
        # Logique de blocage
        user.failed_attempts += 1
        if user.failed_attempts >= 5:
            user.is_blocked = True
            SecurityService.create_alert(user.id, "BRUTE_FORCE", "Compte bloqué après 5 échecs")
        db.session.commit()
        return jsonify({"message": "Identifiants invalides"}), 401

    if user.is_blocked:
        return jsonify({"message": "Compte bloqué"}), 403

    # Reset attempts on success
    user.failed_attempts = 0
    db.session.commit()

    # Évaluation du risque
    risk = SecurityService.evaluate_login_risk(user.id, ip, user_agent)
    
    if risk["recommendation"] == "BLOCK":
        SecurityService.log_event(user.id, "LOGIN", "Bloqué par score de risque", ip, user_agent, status="BLOCKED", risk_score=risk["score"])
        return jsonify({"message": "Accès bloqué pour raisons de sécurité"}), 403

    if risk["recommendation"] == "REQUIRE_MFA" or user.mfa_enabled:
        return jsonify({
            "message": "MFA_REQUIRED",
            "user_id": user.id,
            "email": user.email,
            "risk_score": risk["score"],
            "factors": risk["factors"]
        }), 200

    # Success direct
    tokens = SecurityService.generate_tokens(user)
    details = {"message": "Connexion réussie"}
    if isinstance(location, dict) and location.get("lat") is not None and location.get("lng") is not None:
        details["location"] = {
            "lat": location.get("lat"),
            "lng": location.get("lng"),
            "accuracy": location.get("accuracy")
        }

    SecurityService.log_event(
        user.id,
        "LOGIN",
        json.dumps(details),
        ip,
        user_agent,
        risk_score=risk["score"]
    )

    _sync_user_devices_location(user.id, location)
    
    return jsonify({
        "message": "Success",
        "access_token": tokens["access_token"],
        "user": {
            "id": user.id,
            "name": user.username,
            "email": user.email,
            "role": user.role.name,
            "department": user.department.name if user.department else None,
            "department_id": user.department_id
        }
    }), 200

@auth_bp.route("/mfa/verify", methods=["POST"])
def verify_mfa():
    data = request.json
    user_id = data.get("user_id")
    otp_token = data.get("token")
    location = data.get("location")
    user_agent = request.headers.get("User-Agent")
    ip = request.remote_addr
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({"message": "Utilisateur non trouvé"}), 404
        
    totp = pyotp.TOTP(user.mfa_secret)
    if totp.verify(otp_token):
        # Enregistrer l'appareil si inconnu
        device_hash = SecurityService.get_device_hash(ip, user_agent)
        known_device = UserDevice.query.filter_by(user_id=user.id, device_id_hash=device_hash).first()
        if not known_device:
            new_device = UserDevice(
                user_id=user.id,
                device_id_hash=device_hash,
                device_name=user_agent[:50],
                last_ip=ip,
                is_trusted=True # Déjà vérifié par MFA
            )
            db.session.add(new_device)
        else:
            known_device.is_trusted = True
            known_device.last_ip = ip
        
        db.session.commit()
        
        tokens = SecurityService.generate_tokens(user)
        SecurityService.log_event(user.id, "MFA_VERIFY", "MFA réussie", ip, user_agent)

        details = {"message": "Connexion réussie après MFA"}
        if isinstance(location, dict) and location.get("lat") is not None and location.get("lng") is not None:
            details["location"] = {
                "lat": location.get("lat"),
                "lng": location.get("lng"),
                "accuracy": location.get("accuracy")
            }

        SecurityService.log_event(
            user.id,
            "LOGIN",
            json.dumps(details),
            ip,
            user_agent,
        )

        _sync_user_devices_location(user.id, location)
        
        return jsonify({
            "message": "Success",
            "access_token": tokens["access_token"],
            "user": {
                "id": user.id,
                "name": user.username,
                "email": user.email,
                "role": user.role.name,
                "department": user.department.name if user.department else None,
                "department_id": user.department_id
            }
        }), 200
    
    SecurityService.log_event(user.id, "MFA_VERIFY", "MFA échouée", ip, user_agent, status="FAILED")
    return jsonify({"message": "Code invalide"}), 401
