from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.middleware.rbac import role_required
from app.models.security_models import Device, InternalRequest, RequestStatus, RoleName, User
from app.services.workflow_service import WorkflowService

requests_bp = Blueprint("internal_requests", __name__)


def _serialize(req: InternalRequest):
    author = User.query.get(req.user_id)
    device = Device.query.get(req.device_id) if req.device_id else None
    return {
        "id": req.id,
        "type": req.type,
        "title": req.title,
        "reason": req.reason,
        "status": req.status,
        "device_id": req.device_id,
        "device_name": device.name if device else None,
        "device_serial": device.serial_number if device else None,
        "department_id": req.department_id,
        "department_name": req.department.name if req.department else None,
        "author_name": author.username if author else None,
        "author_email": author.email if author else None,
        "created_at": req.created_at.isoformat() if req.created_at else None,
        "updated_at": req.updated_at.isoformat() if req.updated_at else None,
        "exited_at": req.exited_at.isoformat() if req.exited_at else None,
        "dept_comment": req.dept_comment,
        "general_comment": req.general_comment,
        "security_comment": req.security_comment,
    }


@requests_bp.route("/", methods=["POST"])
@jwt_required()
@role_required([RoleName.USER])
def create_request():
    user = User.query.get(get_jwt_identity())
    data = request.json or {}
    try:
        req = WorkflowService.create_request(user, data)
        return jsonify(_serialize(req)), 201
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400


@requests_bp.route("/mine", methods=["GET"])
@jwt_required()
@role_required([RoleName.USER, RoleName.DEPT_ADMIN, RoleName.SUPER_ADMIN, RoleName.SECURITY_AGENT])
def my_requests():
    user = User.query.get(get_jwt_identity())
    if not user:
        return jsonify({"message": "Session expirée — reconnectez-vous"}), 401
    rows = InternalRequest.query.filter_by(user_id=user.id).order_by(InternalRequest.created_at.desc()).all()
    return jsonify([_serialize(r) for r in rows]), 200


@requests_bp.route("/pending/dept", methods=["GET"])
@jwt_required()
@role_required([RoleName.DEPT_ADMIN])
def pending_dept():
    user = User.query.get(get_jwt_identity())
    rows = InternalRequest.query.filter_by(
        department_id=user.department_id,
        status=RequestStatus.PENDING_DEPT,
    ).order_by(InternalRequest.created_at.desc()).all()
    return jsonify([_serialize(r) for r in rows]), 200


@requests_bp.route("/pending/global", methods=["GET"])
@jwt_required()
@role_required([RoleName.SUPER_ADMIN])
def pending_global():
    rows = InternalRequest.query.filter_by(status=RequestStatus.PENDING_GENERAL).order_by(
        InternalRequest.created_at.desc()
    ).all()
    return jsonify([_serialize(r) for r in rows]), 200


@requests_bp.route("/pending/security", methods=["GET"])
@jwt_required()
@role_required([RoleName.SECURITY_AGENT])
def pending_security():
    """Demandes validées par les admins — en attente de contrôle sortie matériel."""
    rows = InternalRequest.query.filter_by(status=RequestStatus.PENDING_SECURITY).order_by(
        InternalRequest.created_at.desc()
    ).all()
    return jsonify([_serialize(r) for r in rows]), 200


@requests_bp.route("/history/security", methods=["GET"])
@jwt_required()
@role_required([RoleName.SECURITY_AGENT])
def security_history():
    rows = InternalRequest.query.filter(
        InternalRequest.status.in_([RequestStatus.COMPLETED, RequestStatus.REJECTED_SECURITY])
    ).order_by(InternalRequest.updated_at.desc()).limit(100).all()
    return jsonify([_serialize(r) for r in rows]), 200


@requests_bp.route("/<request_id>/approve", methods=["POST"])
@jwt_required()
@role_required([RoleName.DEPT_ADMIN, RoleName.SUPER_ADMIN])
def approve_request(request_id):
    actor = User.query.get(get_jwt_identity())
    req = InternalRequest.query.get(request_id)
    if not req:
        return jsonify({"message": "Demande introuvable"}), 404
    try:
        WorkflowService.approve_request(req, actor, (request.json or {}).get("comment"))
        return jsonify(_serialize(req)), 200
    except (ValueError, PermissionError) as exc:
        return jsonify({"message": str(exc)}), 400


@requests_bp.route("/<request_id>/reject", methods=["POST"])
@jwt_required()
@role_required([RoleName.DEPT_ADMIN, RoleName.SUPER_ADMIN])
def reject_request(request_id):
    actor = User.query.get(get_jwt_identity())
    req = InternalRequest.query.get(request_id)
    if not req:
        return jsonify({"message": "Demande introuvable"}), 404
    comment = (request.json or {}).get("comment")
    try:
        WorkflowService.reject_request(req, actor, comment)
        return jsonify(_serialize(req)), 200
    except (ValueError, PermissionError) as exc:
        return jsonify({"message": str(exc)}), 400


@requests_bp.route("/<request_id>/confirm-exit", methods=["POST"])
@jwt_required()
@role_required([RoleName.SECURITY_AGENT])
def confirm_exit(request_id):
    agent = User.query.get(get_jwt_identity())
    req = InternalRequest.query.get(request_id)
    if not req:
        return jsonify({"message": "Demande introuvable"}), 404
    try:
        WorkflowService.confirm_physical_exit(req, agent, (request.json or {}).get("comment"))
        return jsonify(_serialize(req)), 200
    except (ValueError, PermissionError) as exc:
        return jsonify({"message": str(exc)}), 400


@requests_bp.route("/<request_id>/deny-exit", methods=["POST"])
@jwt_required()
@role_required([RoleName.SECURITY_AGENT])
def deny_exit(request_id):
    agent = User.query.get(get_jwt_identity())
    req = InternalRequest.query.get(request_id)
    if not req:
        return jsonify({"message": "Demande introuvable"}), 404
    comment = (request.json or {}).get("comment")
    try:
        WorkflowService.deny_physical_exit(req, agent, comment)
        return jsonify(_serialize(req)), 200
    except (ValueError, PermissionError) as exc:
        return jsonify({"message": str(exc)}), 400
