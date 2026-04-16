"""
Routes pour authentification multifactorielle (MFA)
Support TOTP, codes de secours, vérification de dispositif
"""

from flask import Blueprint, request, jsonify, current_app
from datetime import datetime
import uuid
from ..database import execute_query, execute_one
from ..services.security_service import SecurityService

mfa_bp = Blueprint("mfa", __name__, url_prefix="/api/mfa")
security_service = SecurityService()

# ========== SETUP MFA ==========

@mfa_bp.route("/setup-totp", methods=["POST"])
def setup_totp():
    """
    Initialise TOTP pour un utilisateur
    Retourne secret + QR code + codes de secours
    
    Body: { "user_id": "...", "email": "..." }
    """
    try:
        data = request.json
        user_id = data.get("user_id")
        email = data.get("email")
        
        if not user_id or not email:
            return jsonify({"message": "Missing user_id or email"}), 400
        
        # Générer TOTP setup
        mfa_setup = security_service.setup_mfa_totp(user_id, email)
        
        # Stocker temporairement (en session avant confirmation)
        execute_query(
            """INSERT INTO OTPSecret (id, userId, secret, createdAt) 
               VALUES (%s, %s, %s, NOW())""",
            (str(uuid.uuid4()), user_id, mfa_setup['secret']),
            is_select=False
        )
        
        return jsonify({
            "success": True,
            "secret": mfa_setup['secret'],
            "qr_code": mfa_setup['qr_code'],
            "provisioning_uri": mfa_setup['provisioning_uri'],
            "backup_codes": mfa_setup['backup_codes']
        }), 200
        
    except Exception as e:
        return jsonify({"message": f"Error: {str(e)}"}), 500


@mfa_bp.route("/confirm-totp", methods=["POST"])
def confirm_totp():
    """
    Confirme la configuration TOTP en vérifiant un code
    
    Body: { "user_id": "...", "totp_code": "123456", "backup_codes": [...] }
    """
    try:
        data = request.json
        user_id = data.get("user_id")
        totp_code = data.get("totp_code")
        backup_codes = data.get("backup_codes", [])
        
        if not user_id or not totp_code:
            return jsonify({"message": "Missing parameters"}), 400
        
        # Récupérer le secret OTP
        otp_record = execute_one(
            "SELECT secret FROM OTPSecret WHERE userId = %s ORDER BY createdAt DESC LIMIT 1",
            (user_id,)
        )
        
        if not otp_record:
            return jsonify({"message": "OTP not initialized"}), 400
        
        # Vérifier le code TOTP
        if not security_service.verify_mfa_totp(otp_record['secret'], totp_code):
            return jsonify({"message": "Invalid TOTP code"}), 401
        
        # Sauvegarder les codes de secours hashés
        if backup_codes:
            for code in backup_codes:
                hashed = security_service.backup_code_manager.hash_code(code)
                execute_query(
                    """INSERT INTO BackupCode (id, userId, code, used) 
                       VALUES (%s, %s, %s, FALSE)""",
                    (str(uuid.uuid4()), user_id, hashed),
                    is_select=False
                )
        
        # Marquer MFA comme activée
        execute_query(
            "UPDATE User SET mfaEnabled = TRUE, mfaType = 'TOTP' WHERE id = %s",
            (user_id,),
            is_select=False
        )
        
        SecurityService.log_event(user_id, "MFA_ENABLED", "TOTP MFA activated", "SYSTEM")
        
        return jsonify({
            "success": True,
            "message": "MFA successfully enabled"
        }), 200
        
    except Exception as e:
        return jsonify({"message": f"Error: {str(e)}"}), 500


# ========== VÉRIFICATION MFA LORS DE LA CONNEXION ==========

@mfa_bp.route("/verify-totp", methods=["POST"])
def verify_totp():
    """
    Vérifie un code TOTP lors de la connexion
    
    Body: { "user_id": "...", "totp_code": "123456" }
    """
    try:
        data = request.json
        user_id = data.get("user_id")
        totp_code = data.get("totp_code")
        
        if not user_id or not totp_code:
            return jsonify({"message": "Missing parameters"}), 400
        
        # Récupérer le secret TOTP
        otp_record = execute_one(
            "SELECT secret FROM OTPSecret WHERE userId = %s ORDER BY createdAt DESC LIMIT 1",
            (user_id,)
        )
        
        if not otp_record:
            return jsonify({"message": "MFA not configured"}), 400
        
        # Vérifier le code
        if security_service.verify_mfa_totp(otp_record['secret'], totp_code):
            SecurityService.log_event(user_id, "MFA_VERIFIED", "TOTP verification successful", request.remote_addr)
            
            return jsonify({
                "success": True,
                "message": "MFA verification successful"
            }), 200
        else:
            SecurityService.log_event(user_id, "MFA_FAILED", "Invalid TOTP code", request.remote_addr)
            return jsonify({"message": "Invalid TOTP code"}), 401
            
    except Exception as e:
        return jsonify({"message": f"Error: {str(e)}"}), 500


@mfa_bp.route("/verify-backup-code", methods=["POST"])
def verify_backup_code():
    """
    Vérifie un code de secours pour MFA
    
    Body: { "user_id": "...", "backup_code": "XXXX-XXXX-XXXX" }
    """
    try:
        data = request.json
        user_id = data.get("user_id")
        backup_code = data.get("backup_code")
        
        if not user_id or not backup_code:
            return jsonify({"message": "Missing parameters"}), 400
        
        # Chercher code de secours inutilisé
        code_record = execute_one(
            "SELECT * FROM BackupCode WHERE userId = %s AND used = FALSE LIMIT 1",
            (user_id,)
        )
        
        if not code_record:
            SecurityService.log_event(user_id, "BACKUP_CODE_INVALID", "No valid backup codes", request.remote_addr)
            return jsonify({"message": "No valid backup codes available"}), 400
        
        # Vérifier le code
        if security_service.backup_code_manager.verify_code(backup_code, code_record['code']):
            # Marquer comme utilisé
            execute_query(
                "UPDATE BackupCode SET used = TRUE WHERE id = %s",
                (code_record['id'],),
                is_select=False
            )
            
            SecurityService.log_event(user_id, "BACKUP_CODE_USED", f"Code {backup_code[:4]}...used", request.remote_addr)
            
            return jsonify({
                "success": True,
                "message": "Backup code verified successfully"
            }), 200
        else:
            SecurityService.log_event(user_id, "BACKUP_CODE_INVALID", f"Invalid backup code", request.remote_addr)
            return jsonify({"message": "Invalid backup code"}), 401
            
    except Exception as e:
        return jsonify({"message": f"Error: {str(e)}"}), 500


# ========== GESTION D'APPAREIL DE CONFIANCE ==========

@mfa_bp.route("/trust-device", methods=["POST"])
def trust_device():
    """
    Marque l'appareil courant comme de confiance
    
    Body: {
        "user_id": "...",
        "device_id": "...",
        "device_name": "My Chrome Browser"
    }
    """
    try:
        data = request.json
        user_id = data.get("user_id")
        device_id = data.get("device_id")
        device_name = data.get("device_name", "Trusted Device")
        
        if not user_id or not device_id:
            return jsonify({"message": "Missing parameters"}), 400
        
        # Marquer appareil comme approuvé
        is_trusted = SecurityService.mark_device_trusted(user_id, device_id)
        
        if is_trusted:
            SecurityService.log_event(user_id, "DEVICE_TRUSTED", f"Device {device_name} marked as trusted", request.remote_addr)
            
            return jsonify({
                "success": True,
                "message": f"Device {device_name} marked as trusted for 90 days"
            }), 200
        else:
            return jsonify({"message": "Error marking device as trusted"}), 500
            
    except Exception as e:
        return jsonify({"message": f"Error: {str(e)}"}), 500


@mfa_bp.route("/list-devices", methods=["GET"])
def list_devices():
    """
    Liste tous les appareils de confiance de l'utilisateur
    """
    try:
        user_id = request.args.get("user_id")
        
        if not user_id:
            return jsonify({"message": "Missing user_id"}), 400
        
        devices = execute_query(
            "SELECT id, deviceId, deviceName, lastLoginAt, isAuthorized FROM UserDevice WHERE userId = %s ORDER BY lastLoginAt DESC",
            (user_id,)
        )
        
        return jsonify({
            "success": True,
            "devices": devices or []
        }), 200
        
    except Exception as e:
        return jsonify({"message": f"Error: {str(e)}"}), 500


@mfa_bp.route("/revoke-device", methods=["POST"])
def revoke_device():
    """
    Révoque un appareil de confiance
    
    Body: { "device_id": "..." }
    """
    try:
        data = request.json
        device_id = data.get("device_id")
        user_id = data.get("user_id")
        
        if not device_id or not user_id:
            return jsonify({"message": "Missing parameters"}), 400
        
        execute_query(
            "UPDATE UserDevice SET isAuthorized = FALSE WHERE deviceId = %s AND userId = %s",
            (device_id, user_id),
            is_select=False
        )
        
        SecurityService.log_event(user_id, "DEVICE_REVOKED", f"Device {device_id} revoked", request.remote_addr)
        
        return jsonify({
            "success": True,
            "message": "Device access revoked"
        }), 200
        
    except Exception as e:
        return jsonify({"message": f"Error: {str(e)}"}), 500


# ========== ÉVALUATION DES RISQUES ==========

@mfa_bp.route("/evaluate-login-risk", methods=["POST"])
def evaluate_login_risk():
    """
    Évalue le risque pour une tentative de connexion
    
    Body: {
        "user_id": "...",
        "ip_address": "...",
        "device_id": "...",
        "device_name": "...",
        "user_agent": "..."
    }
    """
    try:
        data = request.json
        user_id = data.get("user_id")
        
        if not user_id:
            return jsonify({"message": "Missing user_id"}), 400
        
        # Préparer le contexte de connexion
        login_context = {
            "ip_address": data.get("ip_address", request.remote_addr),
            "device_id": data.get("device_id"),
            "device_name": data.get("device_name"),
            "user_agent": data.get("user_agent", request.headers.get("User-Agent", "")),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Évaluer le risque
        risk_assessment = security_service.evaluate_login_risk(user_id, login_context)
        
        # Enregistrer dans la base
        execute_query(
            """INSERT INTO RiskAssessment (id, userId, score, level, factors, recommendation, createdAt) 
               VALUES (%s, %s, %s, %s, %s, %s, NOW())""",
            (str(uuid.uuid4()), user_id, risk_assessment['score'], 
             risk_assessment['level'], str(risk_assessment['factors']), 
             risk_assessment['recommendation']),
            is_select=False
        )
        
        return jsonify({
            "success": True,
            "risk_assessment": risk_assessment
        }), 200
        
    except Exception as e:
        return jsonify({"message": f"Error: {str(e)}"}), 500


# ========== DÉTECTION DE SORTIES D'ÉQUIPEMENTS ==========

@mfa_bp.route("/check-equipment-exit", methods=["POST"])
def check_equipment_exit():
    """
    Vérifie si un équipement sorts de sa zone autorisée
    
    Body: {
        "equipment_id": "...",
        "latitude": 48.8566,
        "longitude": 2.3522,
        "user_id": "..."
    }
    """
    try:
        data = request.json
        equipment_id = data.get("equipment_id")
        latitude = data.get("latitude")
        longitude = data.get("longitude")
        user_id = data.get("user_id")
        
        if not equipment_id or latitude is None or longitude is None:
            return jsonify({"message": "Missing parameters"}), 400
        
        # Vérifier sortie non autorisée
        exit_check = security_service.equipment_exit_detector.detect_unauthorized_exit(
            equipment_id,
            (latitude, longitude),
            user_id
        )
        
        # Enregistrer l'événement
        execute_query(
            """INSERT INTO EquipmentExit (id, equipmentId, userId, latitude, longitude, 
               isUnauthorized, riskLevel, createdAt) 
               VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())""",
            (str(uuid.uuid4()), equipment_id, user_id, latitude, longitude,
             exit_check['is_unauthorized'], exit_check['risk_level']),
            is_select=False
        )
        
        # Alerte si sortie non autorisée
        if exit_check['is_unauthorized']:
            SecurityService.create_alert(
                user_id,
                "UNAUTHORIZED_EXIT",
                f"Equipment {equipment_id} detected outside geofence {exit_check['zone_left']}. Distance: {exit_check['distance_from_geofence']:.2f}km",
                "CRITICAL"
            )
            SecurityService.log_event(user_id, "UNAUTHORIZED_EXIT_DETECTED", 
                f"Equipment {equipment_id} outside zone", request.remote_addr)
        
        return jsonify({
            "success": True,
            "equipment_exit": exit_check
        }), 200
        
    except Exception as e:
        return jsonify({"message": f"Error: {str(e)}"}), 500
