from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..database import db
from ..models.security_models import SecurityAlert, SecurityLog, User, Role, RoleName
from datetime import datetime, timedelta
from sqlalchemy import or_

security_bp = Blueprint("security", __name__)

_ALERT_TYPE_LABELS = {
    "USER_REPORT": "Signalement utilisateur",
    "GENERAL_INCIDENT": "Incident général",
    "UNAUTHORIZED_EXIT": "Sortie non autorisée",
    "BRUTE_FORCE": "Tentatives de connexion",
    "MANUAL_ALERT": "Alerte manuelle",
}


def _alert_severity(alert: SecurityAlert) -> str:
    if alert.type in {"UNAUTHORIZED_EXIT", "BRUTE_FORCE", "MANUAL_ALERT"}:
        return "CRITICAL"
    if alert.type == "USER_REPORT":
        return "MEDIUM"
    if alert.message and ("BLOQUÉ" in alert.message.upper() or "CRITIQUE" in alert.message.upper()):
        return "CRITICAL"
    return "HIGH"


def _serialize_alert(alert: SecurityAlert) -> dict:
    reporter = User.query.get(alert.user_id) if alert.user_id else None
    tech = User.query.get(alert.assigned_technician_id) if alert.assigned_technician_id else None
    dept_name = alert.department.name if getattr(alert, "department", None) else None
    if not dept_name and reporter and reporter.department:
        dept_name = reporter.department.name

    return {
        "id": alert.id,
        "type": alert.type,
        "typeLabel": _ALERT_TYPE_LABELS.get(alert.type or "", alert.type or "Alerte"),
        "message": alert.message,
        "severity": _alert_severity(alert),
        "status": "ACTIVE" if not alert.is_resolved else "RESOLVED",
        "timestamp": alert.created_at.isoformat() if alert.created_at else None,
        "createdAt": alert.created_at.isoformat() if alert.created_at else None,
        "department": dept_name,
        "reporterName": reporter.username if reporter else None,
        "assignedTechnicianId": alert.assigned_technician_id,
        "assignedTechnicianName": tech.username if tech else None,
        "assignedAt": alert.assigned_at.isoformat() if alert.assigned_at else None,
    }


@security_bp.route("/alerts", methods=["GET"])
@jwt_required()
def get_alerts():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or user.role.name not in [RoleName.SUPER_ADMIN, RoleName.DEPT_ADMIN, RoleName.SUPERVISOR]:
        return jsonify({"message": "Accès réservé aux administrateurs et superviseurs"}), 403

    if user.role.name == RoleName.DEPT_ADMIN:
        dept_user_ids = [u.id for u in User.query.filter_by(department_id=user.department_id).all()]
        filters = [SecurityAlert.department_id == user.department_id]
        if dept_user_ids:
            filters.append(SecurityAlert.user_id.in_(dept_user_ids))
        alerts = (
            SecurityAlert.query.filter(or_(*filters))
            .order_by(SecurityAlert.created_at.desc())
            .limit(50)
            .all()
        )
    elif user.role.name == RoleName.SUPERVISOR:
        alerts = SecurityAlert.query.filter_by(
            assigned_technician_id=user.id,
            is_resolved=False,
        ).order_by(SecurityAlert.created_at.desc()).limit(50).all()
    else:
        alerts = SecurityAlert.query.order_by(SecurityAlert.created_at.desc()).limit(50).all()

    return jsonify([_serialize_alert(a) for a in alerts]), 200


@security_bp.route("/alerts/technicians", methods=["GET"])
@jwt_required()
def list_alert_technicians():
    """Liste des techniciens (superviseurs) du département — chef de département uniquement."""
    user = User.query.get(get_jwt_identity())
    if not user or user.role.name not in {RoleName.DEPT_ADMIN, "ADMIN_DEPT"}:
        return jsonify({"message": "Seul le chef de département peut assigner un technicien"}), 403

    supervisors = (
        User.query.join(Role)
        .filter(
            Role.name == RoleName.SUPERVISOR,
            User.department_id == user.department_id,
            User.is_blocked.is_(False),
        )
        .all()
    )
    return jsonify([
        {"id": u.id, "name": u.username, "email": u.email}
        for u in supervisors
    ]), 200


@security_bp.route("/alerts/<alert_id>/assign", methods=["POST"])
@jwt_required()
def assign_alert_technician(alert_id):
    """Assigne une alerte à un technicien — chef de département uniquement."""
    user = User.query.get(get_jwt_identity())
    if not user or user.role.name not in {RoleName.DEPT_ADMIN, "ADMIN_DEPT"}:
        return jsonify({"message": "Seul le chef de département peut assigner un technicien"}), 403

    alert = SecurityAlert.query.get(alert_id)
    if not alert:
        return jsonify({"message": "Alerte introuvable"}), 404

    if alert.department_id and alert.department_id != user.department_id:
        return jsonify({"message": "Alerte hors de votre département"}), 403
    if not alert.department_id and alert.user_id:
        reporter = User.query.get(alert.user_id)
        if not reporter or reporter.department_id != user.department_id:
            return jsonify({"message": "Alerte hors de votre département"}), 403

    technician_id = (request.json or {}).get("technicianId")
    if not technician_id:
        return jsonify({"message": "technicianId requis"}), 400

    technician = User.query.get(technician_id)
    if not technician or not technician.role or technician.role.name != RoleName.SUPERVISOR:
        return jsonify({"message": "Technicien invalide"}), 400

    if technician.department_id != user.department_id:
        return jsonify({"message": "Le technicien doit appartenir à votre département"}), 403

    alert.assigned_technician_id = technician_id
    alert.assigned_at = datetime.utcnow()
    db.session.commit()

    return jsonify(_serialize_alert(alert)), 200


@security_bp.route("/alerts/<alert_id>/resolve", methods=["PUT"])
@jwt_required()
def resolve_alert(alert_id):
    user = User.query.get(get_jwt_identity())
    if not user or user.role.name not in [RoleName.SUPER_ADMIN, RoleName.DEPT_ADMIN, RoleName.SUPERVISOR]:
        return jsonify({"message": "Accès refusé"}), 403

    alert = SecurityAlert.query.get(alert_id)
    if not alert:
        return jsonify({"message": "Alerte introuvable"}), 404

    if user.role.name == RoleName.DEPT_ADMIN and alert.department_id != user.department_id:
        return jsonify({"message": "Alerte hors de votre département"}), 403

    if user.role.name == RoleName.SUPERVISOR and alert.assigned_technician_id != user.id:
        return jsonify({"message": "Alerte non assignée à vous"}), 403

    alert.is_resolved = True
    db.session.commit()
    return jsonify(_serialize_alert(alert)), 200


@security_bp.route("/stats", methods=["GET"])
@jwt_required()
def get_security_stats():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or user.role.name not in [RoleName.SUPER_ADMIN, RoleName.DEPT_ADMIN, RoleName.SUPERVISOR]:
        return jsonify({"message": "Unauthorized"}), 403

    last_24h = datetime.utcnow() - timedelta(hours=24)

    if user.role.name == RoleName.DEPT_ADMIN:
        total_alerts = SecurityAlert.query.filter_by(department_id=user.department_id).count()
        pending_alerts = SecurityAlert.query.filter_by(department_id=user.department_id, is_resolved=False).count()
        failed_logins = SecurityLog.query.filter(
            SecurityLog.action == "LOGIN",
            SecurityLog.status == "FAILED",
            SecurityLog.department_id == user.department_id,
            SecurityLog.created_at > last_24h,
        ).count()
    else:
        total_alerts = SecurityAlert.query.count()
        pending_alerts = SecurityAlert.query.filter_by(is_resolved=False).count()
        failed_logins = SecurityLog.query.filter(
            SecurityLog.action == "LOGIN",
            SecurityLog.status == "FAILED",
            SecurityLog.created_at > last_24h,
        ).count()

    risk_score = min(100, (pending_alerts * 15) + (failed_logins * 10))

    return jsonify({
        "total_alerts": total_alerts,
        "pending_alerts": pending_alerts,
        "failed_logins_24h": failed_logins,
        "system_risk_score": risk_score,
    }), 200


def _serialize_log(log: SecurityLog, include_department: bool = False) -> dict:
    dept_name = None
    if log.department_id and log.department:
        dept_name = log.department.name
    elif log.user_id and log.user and log.user.department:
        dept_name = log.user.department.name

    payload = {
        "id": str(log.id),
        "timestamp": log.created_at.isoformat() if log.created_at else None,
        "action": log.action,
        "user": log.user.username if log.user_id and log.user else "System",
        "ipAddress": log.ip_address or "N/A",
        "details": log.details or "N/A",
        "status": log.status or "OK",
        "userAgent": log.user_agent or "N/A",
    }
    if include_department:
        payload["department"] = dept_name or "Global"
    return payload


def _logs_for_dept_admin(user: User):
    """Logs du département : department_id explicite ou utilisateur du département."""
    dept_user_ids = [
        uid for (uid,) in User.query.filter_by(department_id=user.department_id).with_entities(User.id).all()
    ]
    filters = [SecurityLog.department_id == user.department_id]
    if dept_user_ids:
        filters.append(SecurityLog.user_id.in_(dept_user_ids))
    return (
        SecurityLog.query.filter(or_(*filters))
        .order_by(SecurityLog.created_at.desc())
        .limit(100)
        .all()
    )


def _is_super_admin_role(role: str | None) -> bool:
    return role in {"ADMIN_GENERAL", "SUPER_ADMIN", RoleName.SUPER_ADMIN}


def _is_dept_admin_role(role: str | None) -> bool:
    return role in {"ADMIN_DEPT", "DEPT_ADMIN", RoleName.DEPT_ADMIN}


@security_bp.route("/logs", methods=["GET"])
@jwt_required()
def get_security_logs():
    """Récupère les logs de sécurité filtrés par rôle"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"message": "Utilisateur non trouvé"}), 404

        role = user.role.name if user.role else None

        if _is_dept_admin_role(role):
            if not user.department_id:
                return jsonify({"message": "Département non assigné à cet administrateur"}), 403
            logs = _logs_for_dept_admin(user)
            scope = "department"
            dept_label = user.department.name if user.department else None
        elif _is_super_admin_role(role):
            logs = SecurityLog.query.order_by(SecurityLog.created_at.desc()).limit(100).all()
            scope = "global"
            dept_label = None
        else:
            return jsonify({"message": "Accès réservé aux administrateurs"}), 403

        return jsonify({
            "scope": scope,
            "department": dept_label,
            "logs": [_serialize_log(log, include_department=(scope == "global")) for log in logs],
        }), 200

    except Exception as e:
        import traceback
        print(f"Error in get_security_logs: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            "message": f"Erreur lors du chargement des logs: {str(e)}",
            "logs": [],
        }), 500


@security_bp.route("/report", methods=["POST"])
@jwt_required()
def report_incident():
    user_id = get_jwt_identity()
    data = request.json or {}

    from ..services.security_service import SecurityService
    SecurityService.create_alert(
        user_id,
        data.get("type", "GENERAL_INCIDENT"),
        data.get("message", "Incident reported from interface"),
    )
    return jsonify({"message": "Incident rapporté avec succès"}), 201
