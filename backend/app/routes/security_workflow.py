from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
import json

from app.database import db
from app.middleware.rbac import role_required
from app.models.security_models import Notification, RoleName, User
from app.services.workflow_service import SecurityWorkflowService

security_workflow_bp = Blueprint("security_workflow", __name__)


def _serialize_notification(n: Notification) -> dict:
    payload = {}
    try:
        payload = json.loads(n.payload_json or "{}")
    except Exception:
        payload = {}
    return {
        "id": n.id,
        "type": n.type,
        "title": n.title,
        "message": payload.get("message") or n.title,
        "payload": payload,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


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
    unread = Notification.query.filter_by(user_id=user_id, is_read=False).count()
    return jsonify({
        "unread_count": unread,
        "notifications": [_serialize_notification(n) for n in rows],
    }), 200


@security_workflow_bp.route("/notifications/<notification_id>/read", methods=["POST"])
@jwt_required()
def mark_notification_read(notification_id):
    user_id = get_jwt_identity()
    row = Notification.query.filter_by(id=notification_id, user_id=user_id).first()
    if not row:
        return jsonify({"message": "Notification introuvable"}), 404
    row.is_read = True
    db.session.commit()
    return jsonify(_serialize_notification(row)), 200


@security_workflow_bp.route("/notifications/read-all", methods=["POST"])
@jwt_required()
def mark_all_notifications_read():
    user_id = get_jwt_identity()
    Notification.query.filter_by(user_id=user_id, is_read=False).update({"is_read": True})
    db.session.commit()
    return jsonify({"message": "Toutes les notifications sont marquées comme lues"}), 200
