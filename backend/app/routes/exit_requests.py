from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..database import execute_query, execute_one
from ..services.security_service import SecurityService
import uuid

exit_bp = Blueprint("exit_requests", __name__)

@exit_bp.route("/", methods=["POST"])
@jwt_required()
def create_request():
    user_id = get_jwt_identity()
    data = request.json
    
    id = str(uuid.uuid4())
    execute_query(
        "INSERT INTO ExitRequest (id, equipmentId, userId, reason, duration, status, createdAt, updatedAt) VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())",
        (id, data.get("equipmentId"), user_id, data.get("reason"), data.get("duration"), "PENDING"),
        is_select=False
    )
    SecurityService.log_event(user_id, "EXIT_REQUEST_CREATED", f"Requested exit for {data.get('equipmentId')}", request.remote_addr)
    return jsonify({"message": "Exit request created", "id": id}), 201

@exit_bp.route("/<id>/approve", methods=["POST"])
@jwt_required()
def approve_request(id):
    admin_id = get_jwt_identity()
    data = request.json
    
    # Get current request state
    exit_req = execute_one("SELECT * FROM ExitRequest WHERE id = %s", (id,))
    if not exit_req:
        return jsonify({"message": "Request not found"}), 404
        
    is_approved = data.get("approved")
    
    if not is_approved:
        status = "REJECTED"
        execute_query("UPDATE ExitRequest SET status = %s, adminId = %s, updatedAt = NOW() WHERE id = %s", (status, admin_id, id), is_select=False)
    else:
        # Check double validation logic
        requires_double = exit_req.get("requires_double_validation", False)
        if hasattr(exit_req, "requires_double_validation"):
             requires_double = exit_req["requires_double_validation"]
        
        current_status = exit_req.get("status")
        
        if requires_double:
            if exit_req.get("adminId") and exit_req.get("adminId") != admin_id:
                # Second admin approving
                status = "APPROVED"
                execute_query("UPDATE ExitRequest SET status = %s, second_approved_by = %s, updatedAt = NOW() WHERE id = %s", (status, admin_id, id), is_select=False)
            else:
                # First admin approving
                status = "PARTIAL_APPROVED"
                execute_query("UPDATE ExitRequest SET status = %s, adminId = %s, updatedAt = NOW() WHERE id = %s", (status, admin_id, id), is_select=False)
        else:
            status = "APPROVED"
            execute_query("UPDATE ExitRequest SET status = %s, adminId = %s, updatedAt = NOW() WHERE id = %s", (status, admin_id, id), is_select=False)
    
    SecurityService.log_event(admin_id, "EXIT_REQUEST_DECISION", f"Request {id} set to {status}", request.remote_addr)
    return jsonify({"message": f"Request {status}", "id": id}), 200

@exit_bp.route("/<id>/confirm", methods=["POST"])
@jwt_required()
def confirm_exit(id):
    porter_id = get_jwt_identity()
    
    exit_req = execute_one("SELECT * FROM ExitRequest WHERE id = %s", (id,))
    if not exit_req:
        return jsonify({"message": "Request not found"}), 404
        
    if exit_req['status'] != "APPROVED":
        return jsonify({"message": "Request not approved"}), 400
        
    execute_query(
        "UPDATE ExitRequest SET status = %s, porterId = %s, updatedAt = NOW() WHERE id = %s",
        ("OUT", porter_id, id),
        is_select=False
    )
    
    execute_query(
        "UPDATE Equipment SET status = %s, updatedAt = NOW() WHERE id = %s",
        ("OUT", exit_req['equipmentId']),
        is_select=False
    )
    
    log_id = str(uuid.uuid4())
    execute_query(
        "INSERT INTO MovementLog (id, equipmentId, action, porterId, timestamp) VALUES (%s, %s, %s, %s, NOW())",
        (log_id, exit_req['equipmentId'], "EXIT", porter_id),
        is_select=False
    )
    
    SecurityService.log_event(porter_id, "EXIT_CONFIRMED", f"Confirmed exit of equipment {exit_req['equipmentId']}", request.remote_addr)
    return jsonify({"message": "Exit confirmed"}), 200
