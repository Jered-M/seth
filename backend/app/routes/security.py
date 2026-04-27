from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..database import db, execute_query, execute_one
from ..models.security_models import SecurityAlert, SecurityLog, User, Role, RoleName
from datetime import datetime, timedelta

security_bp = Blueprint("security", __name__)

@security_bp.route("/alerts", methods=["GET"])
@jwt_required()
def get_alerts():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    # Professional Roles check
    if not user or user.role.name not in [RoleName.SUPER_ADMIN, RoleName.DEPT_ADMIN, RoleName.SUPERVISOR]:
        return jsonify({"message": "Accès réservé aux administrateurs et superviseurs"}), 403
        
    # Get latest alerts
    if user.role.name == RoleName.DEPT_ADMIN:
        alerts = SecurityAlert.query.filter_by(department_id=user.department_id).order_by(SecurityAlert.created_at.desc()).limit(20).all()
    else:
        alerts = SecurityAlert.query.order_by(SecurityAlert.created_at.desc()).limit(20).all()
        
    return jsonify([{
        "id": a.id,
        "type": a.type,
        "message": a.message,
        "severity": "CRITICAL" if "BLOQUÉ" in a.message or "EXIT" in a.type else "HIGH", # Dynamic severity
        "status": "PENDING" if not a.is_resolved else "RESOLVED",
        "createdAt": a.created_at.isoformat()
    } for a in alerts]), 200

@security_bp.route("/stats", methods=["GET"])
@jwt_required()
def get_security_stats():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role.name not in [RoleName.SUPER_ADMIN, RoleName.DEPT_ADMIN, RoleName.SUPERVISOR]:
        return jsonify({"message": "Unauthorized"}), 403
        
    last_24h = datetime.utcnow() - timedelta(hours=24)
    
    # Stats base query
    if user.role.name == RoleName.DEPT_ADMIN:
        total_alerts = SecurityAlert.query.filter_by(department_id=user.department_id).count()
        pending_alerts = SecurityAlert.query.filter_by(department_id=user.department_id, is_resolved=False).count()
        failed_logins = SecurityLog.query.filter(
            SecurityLog.action == "LOGIN", 
            SecurityLog.status == "FAILED",
            SecurityLog.department_id == user.department_id,
            SecurityLog.created_at > last_24h
        ).count()
    else:
        total_alerts = SecurityAlert.query.count()
        pending_alerts = SecurityAlert.query.filter_by(is_resolved=False).count()
        failed_logins = SecurityLog.query.filter(
            SecurityLog.action == "LOGIN", 
            SecurityLog.status == "FAILED",
            SecurityLog.created_at > last_24h
        ).count()
    
    # Simple dynamic risk Score calculation (0-100)
    # Weight: 10 per pending alert, 5 per failed login (capped)
    risk_score = min(100, (pending_alerts * 15) + (failed_logins * 10))
    
    return jsonify({
        "total_alerts": total_alerts,
        "pending_alerts": pending_alerts,
        "failed_logins_24h": failed_logins,
        "system_risk_score": risk_score
    }), 200

@security_bp.route("/logs", methods=["GET"])
@jwt_required()
def get_security_logs():
    """Récupère les logs de sécurité filtrés par rôle"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({"message": "Utilisateur non trouvé"}), 404
        
        # Récupérer les logs en fonction du rôle
        if user.role.name == RoleName.DEPT_ADMIN:
            # DEPT_ADMIN ne voit que les logs de son département
            logs = SecurityLog.query.filter_by(
                department_id=user.department_id
            ).order_by(SecurityLog.created_at.desc()).limit(100).all()
        elif user.role.name in [RoleName.ADMIN_GENERAL, RoleName.SUPER_ADMIN]:
            # SUPER_ADMIN voit tous les logs
            logs = SecurityLog.query.order_by(SecurityLog.created_at.desc()).limit(100).all()
        else:
            # Autres rôles: pas d'accès
            return jsonify({"message": "Accès réservé aux administrateurs"}), 403
        
        # Formatter les résultats
        result = []
        for log in logs:
            result.append({
                'id': str(log.id),
                'timestamp': log.created_at.isoformat() if log.created_at else None,
                'action': log.action,
                'user': log.user.username if log.user_id and log.user else 'System',
                'ipAddress': log.ip_address or 'N/A',
                'details': log.details or 'N/A',
                'status': log.status or 'OK',
                'userAgent': log.user_agent or 'N/A'
            })
        
        return jsonify(result), 200
    
    except Exception as e:
        import traceback
        print(f"Error in get_security_logs: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            "message": f"Erreur lors du chargement des logs: {str(e)}",
            "logs": []
        }), 500

@security_bp.route("/report", methods=["POST"])
@jwt_required()
def report_incident():
    user_id = get_jwt_identity()
    data = request.json
    
    from ..services.security_service import SecurityService
    SecurityService.create_alert(
        user_id, 
        data.get("type", "GENERAL_INCIDENT"), 
        data.get("message", "Incident reported from interface")
    )
    return jsonify({"message": "Incident rapporté avec succès"}), 201
