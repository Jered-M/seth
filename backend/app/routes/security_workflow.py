from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.middleware.rbac import role_required
from app.models.security_models import Notification, RoleName, User
from app.services.workflow_service import SecurityWorkflowService

security_workflow_bp = Blueprint("security_workflow", __name__)


@security_workflow_bp.route("/alerts/trigger", methods=["POST"])
@jwt_required()
@role_required([RoleName.SECURITY_AGENT])
def trigger_alert():
    agent = User.query.get(get_jwt_identity())
    data = request.json or {}
    department_id = data.get("department_id")
    if not department_id:
        return jsonify({"message": "department_id requis"}), 400

    alert, incident = SecurityWorkflowService.trigger_alert(
        agent,
        department_id,
        data.get("type", "MANUAL_ALERT"),
        data.get("message", "Alerte déclenchée manuellement"),
        data.get("severity", "CRITICAL"),
    )
    return jsonify({
        "alert_id": alert.id,
        "incident_id": incident.id,
        "message": "Alerte diffusée",
    }), 201


@security_workflow_bp.route("/notifications", methods=["GET"])
@jwt_required()
def list_notifications():
    user_id = get_jwt_identity()
    rows = Notification.query.filter_by(user_id=user_id).order_by(Notification.created_at.desc()).limit(50).all()
    return jsonify([
        {
            "id": n.id,
            "type": n.type,
            "title": n.title,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in rows
    ]), 200
