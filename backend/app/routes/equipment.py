from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..services.security_service import SecurityService
from ..models.security_models import User, RoleName, SecurityLog, Device, Department
from app.database import db
from sqlalchemy import text
import uuid

equipment_bp = Blueprint("equipment", __name__)


def _generate_equipment_serial() -> str:
    """Generate a human-readable equipment identifier without QR semantics."""
    return f"EQ-{uuid.uuid4().hex[:10].upper()}"


def _load_equipment_context(equipment_id: str):
    """Return equipment metadata from either devices or equipment table."""
    try:
        device = Device.query.get(equipment_id)
        if device:
            return {
                "storage": "devices",
                "id": device.id,
                "department_id": device.department_id,
                "assigned_user_id": device.user_id,
            }
    except Exception:
        pass

    row = db.session.execute(
        text(
            """
            SELECT id, owner_department, gps_device_identifier
            FROM equipment
            WHERE id = :id
            """
        ),
        {"id": equipment_id},
    ).mappings().first()

    if not row:
        return None

    return {
        "storage": "equipment",
        "id": row["id"],
        "department_id": row["owner_department"],
        "assigned_user_id": row["gps_device_identifier"],
    }


def _get_assigned_user_ids():
    """Return user IDs already linked to at least one equipment across both storage schemas."""
    assigned_ids = set()

    try:
        orm_rows = db.session.execute(
            text("SELECT user_id FROM devices WHERE user_id IS NOT NULL")
        ).mappings().all()
        assigned_ids.update(str(r["user_id"]) for r in orm_rows if r.get("user_id"))
    except Exception:
        pass

    try:
        equipment_rows = db.session.execute(
            text("SELECT gps_device_identifier FROM equipment WHERE gps_device_identifier IS NOT NULL")
        ).mappings().all()
        assigned_ids.update(str(r["gps_device_identifier"]) for r in equipment_rows if r.get("gps_device_identifier"))
    except Exception:
        pass

    return assigned_ids

@equipment_bp.route("/", methods=["GET"])
@jwt_required()
def get_equipments():
    try:
        devices = Device.query.all()
        return jsonify([
            {
                "id": d.id,
                "serialNumber": d.serial_number,
                "type": d.name or "OTHER",
                "status": d.status,
                "departmentId": d.department_id,
                "department": d.department.name if d.department else None,
                "assignedTo": d.user.username if d.user else None,
                "location": None,
                "last_known_lat": d.last_known_lat,
                "last_known_lng": d.last_known_lng,
            }
            for d in devices
        ]), 200
    except Exception:
        rows = db.session.execute(text(
            """
            SELECT e.id, e.serial_number, e.label, e.owner_department, u.username AS assigned_to
            FROM equipment
            LEFT JOIN users u ON e.gps_device_identifier = u.id
            ORDER BY id DESC
            """
        )).mappings().all()
        return jsonify([
            {
                "id": r["id"],
                "serialNumber": r["serial_number"],
                "type": r["label"] or "OTHER",
                "status": "AVAILABLE",
                "departmentId": None,
                "department": r["owner_department"],
                "assignedTo": r["assigned_to"],
                "location": None,
                "last_known_lat": None,
                "last_known_lng": None,
            }
            for r in rows
        ]), 200

@equipment_bp.route("/", methods=["POST"])
@jwt_required()
def add_equipment():
    data = request.json or {}
    try:
        equipment_id = str(uuid.uuid4())
        serial_number = _generate_equipment_serial()
        current_user_id = get_jwt_identity()

        department_id = data.get("departmentId")
        if isinstance(department_id, str):
            department_id = department_id.strip() or None

        # Fallback: use connected user's department when departmentId is omitted.
        if not department_id:
            current_user = User.query.get(current_user_id)
            department_id = current_user.department_id if current_user else None

        if not department_id:
            return jsonify({"message": "departmentId manquant. Assignez un département à l'utilisateur connecté ou fournissez departmentId."}), 400

        dept_exists = Department.query.get(department_id)
        if not dept_exists:
            return jsonify({"message": "departmentId invalide: département introuvable."}), 400

        try:
            device = Device(
                id=equipment_id,
                name=data.get("type", "OTHER"),
                serial_number=serial_number,
                department_id=department_id,
                status="AVAILABLE",
            )
            db.session.add(device)
            db.session.commit()
            return jsonify({"message": "Equipment added", "id": equipment_id, "serialNumber": serial_number}), 201
        except Exception:
            db.session.rollback()
            db.session.execute(
                text(
                    """
                    INSERT INTO equipment (id, asset_tag, serial_number, label, owner_department, gps_device_identifier)
                    VALUES (:id, :asset_tag, :serial_number, :label, :owner_department, :gps_device_identifier)
                    """
                ),
                {
                    "id": equipment_id,
                    "asset_tag": serial_number,
                    "serial_number": serial_number,
                    "label": data.get("type", "OTHER"),
                    "owner_department": str(department_id),
                    "gps_device_identifier": None,
                },
            )
            db.session.commit()
            return jsonify({"message": "Equipment added", "id": equipment_id, "serialNumber": serial_number}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": str(e)}), 400


@equipment_bp.route("/<id>/assignable-users", methods=["GET"])
@jwt_required()
def get_assignable_users(id):
    current_user_id = get_jwt_identity()

    requester = User.query.get(current_user_id)
    if not requester:
        return jsonify({"message": "Utilisateur connecté introuvable"}), 404

    allowed_roles = {"ADMIN_GENERAL", "SUPER_ADMIN", "ADMIN_DEPT", "DEPT_ADMIN", "SUPERVISOR"}
    if not requester.role or requester.role.name not in allowed_roles:
        return jsonify({"message": "Accès refusé. Permission insuffisante."}), 403

    equipment_ctx = _load_equipment_context(id)
    if not equipment_ctx:
        return jsonify({"message": "Equipment non trouvé"}), 404

    # Department admins and supervisors are limited to their own department.
    if requester.role.name in {"ADMIN_DEPT", "DEPT_ADMIN", "SUPERVISOR"}:
        if requester.department_id != equipment_ctx["department_id"]:
            return jsonify({"message": "Accès refusé hors de votre département."}), 403

    users = User.query.filter_by(department_id=equipment_ctx["department_id"], is_blocked=False).all()
    assigned_user_ids = _get_assigned_user_ids()

    filtered = []
    for user in users:
        if not user.role or user.role.name != RoleName.USER:
            continue
        if str(user.id) in assigned_user_ids:
            continue

        filtered.append({
            "id": user.id,
            "name": user.username,
            "email": user.email,
            "role": user.role.name,
            "department_id": user.department_id,
            "status": "active"
        })

    return jsonify(filtered), 200

@equipment_bp.route("/<id>/assign", methods=["POST"])
@jwt_required()
def assign_equipment(id):
    data = request.json or {}
    user_id = data.get("userId")
    technician_id = get_jwt_identity()

    requester = User.query.get(technician_id)
    if not requester:
        return jsonify({"message": "Utilisateur connecté introuvable"}), 404

    allowed_roles = {"ADMIN_GENERAL", "SUPER_ADMIN", "ADMIN_DEPT", "DEPT_ADMIN", "SUPERVISOR"}
    if not requester.role or requester.role.name not in allowed_roles:
        return jsonify({"message": "Accès refusé. Permission insuffisante."}), 403

    equipment_ctx = _load_equipment_context(id)
    if not equipment_ctx:
        return jsonify({"message": "Equipment non trouvé"}), 404

    user = User.query.get(user_id)
    if not user:
        return jsonify({"message": "Utilisateur non trouvé"}), 404

    if not user.role or user.role.name != RoleName.USER:
        return jsonify({"message": "L'assignation est autorisée uniquement vers un compte utilisateur."}), 400

    if user.is_blocked:
        return jsonify({"message": "Le compte utilisateur n'est pas activé par le super admin."}), 403

    if str(user.id) in _get_assigned_user_ids():
        return jsonify({"message": "Cet utilisateur possède déjà un matériel assigné."}), 409

    equipment_department = equipment_ctx["department_id"]
    user_department = user.department_id

    if requester.role.name in {"ADMIN_DEPT", "DEPT_ADMIN", "SUPERVISOR"}:
        if requester.department_id != equipment_department:
            return jsonify({"message": "Accès refusé hors de votre département."}), 403

    if equipment_department and user_department and equipment_department != user_department:
        return jsonify({"message": "L'utilisateur doit appartenir au même département que l'équipement."}), 403
    
    if equipment_ctx["storage"] == "devices":
        equipment = Device.query.get(id)
        if not equipment:
            return jsonify({"message": "Equipment non trouvé"}), 404
        equipment.status = "ASSIGNED"
        equipment.user_id = user_id
    else:
        db.session.execute(
            text("UPDATE equipment SET gps_device_identifier = :user_id WHERE id = :id"),
            {"user_id": user_id, "id": id},
        )
    db.session.commit()
    
    SecurityService.log_event(technician_id, "EQUIPMENT_ASSIGNED", f"Assigned equipment {id} to user {user_id}", request.remote_addr)
    return jsonify({"message": "Equipment assigned", "id": id}), 200

@equipment_bp.route("/<id>/location", methods=["POST"])
@jwt_required()
def update_location(id):
    """
    Mise à jour de la localisation GPS (Appelée en arrière-plan par le mobile)
    """
    data = request.json
    lat = data.get("lat")
    lng = data.get("lng")
    user_id = get_jwt_identity()
    
    if not lat or not lng:
        return jsonify({"message": "Missing coordinates"}), 400
        
    # Update device location
    device = Device.query.get(id)
    if not device:
        return jsonify({"message": "Equipment non trouvé"}), 404

    device.last_known_lat = lat
    device.last_known_lng = lng
    
    # Check geofencing
    is_inside = SecurityService.check_geofencing(id)
    
    if not is_inside:
        # Check if exit is authorized
        # Current status checks (if OUT or EXIT_APPROVED, it's fine)
        if device.status not in ["OUT", "EXIT_APPROVED"]:
            # Trigger Alert
            SecurityService.create_alert(
                user_id, 
                "UNAUTHORIZED_EXIT", 
                f"L'équipement {id} a quitté la zone autorisée sans permission."
            )
            SecurityService.log_event(
                user_id, 
                "GEOFENCE_VIOLATION", 
                f"Unauthorized area exit for equipment {id}", 
                request.remote_addr,
                request.user_agent.string,
                status="CRITICAL",
                risk_score=90
            )
            return jsonify({"message": "Alert triggered: unauthorized exit", "inside": False}), 200

    return jsonify({"message": "Location updated", "inside": is_inside}), 200
