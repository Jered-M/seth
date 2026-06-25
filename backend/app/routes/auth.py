from flask import Blueprint, request, jsonify
import os
import logging
from app.models.security_models import User, Role, UserDevice, RoleName, Device
from app.services.security_service import SecurityService
from app.database import db
from app.seeds import SEED_ACCOUNT_EMAILS, SEED_PASSWORDS
from datetime import datetime
import pyotp
import json

auth_bp = Blueprint("auth", __name__)
log = logging.getLogger("seth.auth")

_DEV_LOCKOUT_OFF = os.getenv("DISABLE_LOGIN_LOCKOUT", "true").lower() == "true"


def _prepare_seed_account(user: User, email: str, password: str | None) -> bool:
    """En dev : débloque et resynchronise le hash si le mot de passe seed est fourni."""
    if not _DEV_LOCKOUT_OFF or email not in SEED_ACCOUNT_EMAILS:
        return False
    user.is_blocked = False
    user.failed_attempts = 0
    user.mfa_enabled = False
    expected = SEED_PASSWORDS.get(email)
    if password and expected and password == expected:
        if not SecurityService.verify_password(password, user.password_hash):
            user.password_hash = SecurityService.hash_password(password)
            db.session.commit()
        return True
    return False


def _sync_user_devices_location(user_id: str, location: dict):
    """Propagate login geolocation to all devices assigned to the user."""
    if not isinstance(location, dict):
        return

    lat = location.get("lat")
    lng = location.get("lng")
    accuracy = location.get("accuracy")
    if lat is None or lng is None:
        return

    devices = Device.query.filter_by(user_id=user_id).all()
    for device in devices:
        device.last_known_lat = float(lat)
        device.last_known_lng = float(lng)
        if accuracy is not None:
            new_accuracy = float(accuracy)
            if device.last_known_accuracy is None or new_accuracy <= device.last_known_accuracy:
                device.last_known_accuracy = new_accuracy
        device.location_updated_at = datetime.utcnow()

    if devices:
        db.session.commit()


def _complete_successful_login(user: User, ip: str, user_agent: str | None, location, risk_score: int = 0):
    """Journalise la connexion, ouvre la session et diffuse les notifications in-app."""
    from app.services.tracking_service import notify_login
    from app.services.workflow_service import SessionService

    details = {"message": "Connexion réussie"}
    in_zone = None

    if isinstance(location, dict) and location.get("lat") is not None and location.get("lng") is not None:
        lat = float(location["lat"])
        lng = float(location["lng"])
        zone = SecurityService.check_point_in_zone(lat, lng, user.department_id)
        in_zone = zone["in_zone"]
        zone_status = "IN_ZONE" if in_zone else "OUT_OF_ZONE"
        details["location"] = {
            "lat": lat,
            "lng": lng,
            "accuracy": location.get("accuracy"),
        }
        details["zone_status"] = zone_status
        details["zone_name"] = zone.get("zone_name")
        details["department"] = user.department.name if user.department else None
        details["login_at"] = datetime.utcnow().isoformat()

        if not in_zone:
            SecurityService.create_alert(
                user.id,
                "UNAUTHORIZED_EXIT",
                f"Connexion HORS ZONE — {user.username} ({user.department.name if user.department else 'N/A'})",
            )
            SecurityService.log_event(
                user.id,
                "GEOFENCE_BREACH",
                json.dumps({
                    "message": "Connexion hors zone autorisée",
                    "location": details["location"],
                    "zone_status": zone_status,
                }),
                ip,
                user_agent or "",
                status="ALERT",
                risk_score=85,
                department_id=user.department_id,
            )

    SecurityService.log_event(
        user.id,
        "LOGIN",
        json.dumps(details),
        ip,
        user_agent,
        risk_score=risk_score,
        department_id=user.department_id,
    )

    _sync_user_devices_location(user.id, location)
    SessionService.open_session(user, ip, user_agent, location, None, in_zone=in_zone)

    lat_val = location.get("lat") if isinstance(location, dict) else None
    lng_val = location.get("lng") if isinstance(location, dict) else None

    if lat_val is not None and lng_val is not None:
        flat, flng = float(lat_val), float(lng_val)
        SecurityService.ensure_super_admin_perimeter_zone()
        if not SecurityService._is_super_admin(user):
            SecurityService.handle_super_admin_perimeter_breach(user, flat, flng, ip, user_agent or "")

    notify_login(user, in_zone, lat_val, lng_val, datetime.utcnow())


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json or {}
    email = (data.get("email") or "").lower().strip()
    password = data.get("password")
    if isinstance(password, str):
        password = password.strip()
    location = data.get("location")
    user_agent = request.headers.get("User-Agent")
    ip = request.remote_addr

    log.info("LOGIN tentative email=%s ip=%s pwd_len=%s", email, ip, len(password or ""))
    user = User.query.filter(User.email.ilike(email)).first()

    if not user:
        log.warning("LOGIN échec — utilisateur inconnu: %s", email)
        return jsonify({"message": "Identifiants invalides", "code": "USER_NOT_FOUND"}), 401

    log.info(
        "LOGIN user trouvé id=%s role=%s blocked=%s failed_attempts=%s mfa=%s",
        user.id,
        user.role.name if user.role else None,
        user.is_blocked,
        user.failed_attempts,
        user.mfa_enabled,
    )

    _prepare_seed_account(user, email, password)

    password_ok = SecurityService.verify_password(password, user.password_hash)
    seed_match = email in SEED_PASSWORDS and password == SEED_PASSWORDS.get(email)

    if not password_ok and _DEV_LOCKOUT_OFF and seed_match:
        log.info("LOGIN resync hash seed pour %s", email)
        user.password_hash = SecurityService.hash_password(password)
        user.is_blocked = False
        user.failed_attempts = 0
        db.session.commit()
        password_ok = True

    if not password_ok:
        log.warning(
            "LOGIN mot de passe incorrect email=%s seed_match=%s lockout_off=%s",
            email,
            seed_match,
            _DEV_LOCKOUT_OFF,
        )
        SecurityService.log_event(user.id, "LOGIN", "Échec de connexion", ip, user_agent or "", status="FAILED")
        if not _DEV_LOCKOUT_OFF:
            user.failed_attempts += 1
            if user.failed_attempts >= 5:
                user.is_blocked = True
                SecurityService.create_alert(user.id, "BRUTE_FORCE", "Compte bloqué après 5 échecs")
        db.session.commit()
        hint = ""
        if email in SEED_PASSWORDS and _DEV_LOCKOUT_OFF:
            hint = f" (compte seed : utilisez exactement {SEED_PASSWORDS[email]!r})"
        return jsonify({
            "message": f"Identifiants invalides{hint}",
            "code": "BAD_PASSWORD",
            "seed_account": email in SEED_ACCOUNT_EMAILS,
        }), 401

    user.failed_attempts = 0
    user.is_blocked = False
    user.mfa_enabled = False
    db.session.commit()

    risk = SecurityService.evaluate_login_risk(user.id, ip, user_agent)

    if risk["recommendation"] == "BLOCK":
        log.warning("LOGIN bloqué score risque=%s email=%s", risk["score"], email)
        SecurityService.log_event(user.id, "LOGIN", "Bloqué par score de risque", ip, user_agent, status="BLOCKED", risk_score=risk["score"])
        return jsonify({"message": "Accès bloqué pour raisons de sécurité"}), 403

    if risk["recommendation"] == "REQUIRE_MFA" or user.mfa_enabled:
        log.info("LOGIN MFA requis email=%s score=%s", email, risk["score"])
        return jsonify({
            "message": "MFA_REQUIRED",
            "user_id": user.id,
            "email": user.email,
            "risk_score": risk["score"],
            "factors": risk["factors"]
        }), 200

    # Success direct
    tokens = SecurityService.generate_tokens(user)
    _complete_successful_login(user, ip, user_agent, location, risk_score=risk["score"])

    log.info(
        "LOGIN OK email=%s role=%s dept=%s",
        email,
        user.role.name if user.role else None,
        user.department.name if user.department else None,
    )

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

@auth_bp.route("/dev/seed-status", methods=["GET"])
def dev_seed_status():
    """Diagnostic dev — vérifie que le nouveau backend est bien chargé."""
    if os.getenv("DISABLE_LOGIN_LOCKOUT", "true").lower() != "true":
        return jsonify({"message": "Indisponible"}), 404
    agent = User.query.filter_by(email="security@seth.com").first()
    return jsonify({
        "backend_version": 2,
        "lockout_disabled": True,
        "security_account_exists": agent is not None,
        "security_is_blocked": bool(agent.is_blocked) if agent else None,
        "login_email": "security@seth.com",
        "login_password": SEED_PASSWORDS.get("security@seth.com"),
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
        _complete_successful_login(user, ip, user_agent, location)

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
