"""Suivi temps réel : zones, matériels connectés, historique passages."""
import json
from datetime import datetime, timedelta

from app.database import db
from app.models.security_models import (
    Device,
    InternalRequest,
    RequestStatus,
    Role,
    RoleName,
    SecurityAlert,
    SecurityLog,
    User,
)
from app.services.security_service import SecurityService
from app.services.workflow_service import WorkflowService

ONLINE_WINDOW = timedelta(hours=8)


def _last_success_login(user_id: str):
    return (
        SecurityLog.query.filter_by(user_id=user_id, action="LOGIN", status="SUCCESS")
        .order_by(SecurityLog.created_at.desc())
        .first()
    )


def _login_location(last_login):
    if not last_login:
        return None, None, None
    try:
        details = json.loads(last_login.details or "{}")
        location = details.get("location") if isinstance(details, dict) else None
        if isinstance(location, dict):
            return location.get("lat"), location.get("lng"), location.get("accuracy")
    except Exception:
        pass
    return None, None, None


def _active_exit_request(device_id: str | None, user_id: str):
    if device_id:
        req = (
            InternalRequest.query.filter_by(device_id=device_id)
            .filter(InternalRequest.status.in_([
                RequestStatus.PENDING_DEPT,
                RequestStatus.PENDING_GENERAL,
                RequestStatus.PENDING_SECURITY,
            ]))
            .order_by(InternalRequest.created_at.desc())
            .first()
        )
        if req:
            return req
    return (
        InternalRequest.query.filter_by(user_id=user_id)
        .filter(InternalRequest.status.in_([
            RequestStatus.PENDING_DEPT,
            RequestStatus.PENDING_GENERAL,
            RequestStatus.PENDING_SECURITY,
        ]))
        .order_by(InternalRequest.created_at.desc())
        .first()
    )


def map_equipment_status(device: Device | None, in_zone: bool, exit_req: InternalRequest | None) -> str:
    """Statut affiché carte / alertes."""
    if device and device.status in {"OUT_OF_ZONES", "OUT"}:
        return "OUT_OF_ZONE"
    if not in_zone:
        return "OUT_OF_ZONE"
    if device and device.status == "MAINTENANCE":
        return "MAINTENANCE"
    if exit_req:
        if exit_req.status == RequestStatus.PENDING_SECURITY:
            return "AUTHORIZED_EXIT"
        if exit_req.status in {RequestStatus.PENDING_DEPT, RequestStatus.PENDING_GENERAL}:
            return "PENDING"
    if device and device.status == "EXIT_REQUESTED":
        return "PENDING"
    return "ON_SITE"


def notify_login(user: User, in_zone: bool | None, lat, lng, login_time: datetime):
    """Notifie admins et agents à chaque connexion (avec ou sans GPS)."""
    dept_name = user.department.name if user.department else "Global"
    if in_zone is True:
        zone_label = "dans la zone autorisée"
        zone_status = "IN_ZONE"
    elif in_zone is False:
        zone_label = "HORS ZONE"
        zone_status = "OUT_OF_ZONE"
    else:
        zone_label = "position GPS non disponible"
        zone_status = "UNKNOWN"
    title = f"Connexion — {user.username} ({dept_name})"
    payload = {
        "user_id": user.id,
        "username": user.username,
        "department": dept_name,
        "login_at": login_time.isoformat(),
        "zone_status": zone_status,
        "lat": lat,
        "lng": lng,
        "message": f"{user.username} connecté à {login_time.strftime('%H:%M')} — {zone_label}",
    }

    if user.department_id:
        for admin in User.query.filter_by(department_id=user.department_id).all():
            if admin.role and admin.role.name in {RoleName.DEPT_ADMIN, "ADMIN_DEPT"}:
                WorkflowService._notify(admin.id, "USER_LOGIN", title, payload)

    for admin in User.query.join(Role).filter(Role.name.in_([RoleName.SUPER_ADMIN, "ADMIN_GENERAL"])).all():
        WorkflowService._notify(admin.id, "USER_LOGIN", title, payload)

    for agent in User.query.join(Role).filter(Role.name == RoleName.SECURITY_AGENT).all():
        if not user.department_id or agent.department_id == user.department_id:
            WorkflowService._notify(agent.id, "USER_LOGIN", title, payload)


def build_live_positions(requester: User) -> dict:
    online_since = datetime.utcnow() - ONLINE_WINDOW
    role_name = requester.role.name if requester.role else None

    users_query = User.query.filter_by(is_blocked=False)
    if role_name in {RoleName.DEPT_ADMIN, "ADMIN_DEPT", RoleName.SUPERVISOR, RoleName.SECURITY_AGENT}:
        if not requester.department_id:
            return {"online_count": 0, "located_count": 0, "items": []}
        users_query = users_query.filter_by(department_id=requester.department_id)

    items = []
    online_count = 0

    for user in users_query.all():
        last_login = _last_success_login(user.id)
        if not last_login or last_login.created_at < online_since:
            continue

        online_count += 1
        user_devices = Device.query.filter_by(user_id=user.id).all()
        devices_with_gps = [
            d for d in user_devices
            if d.last_known_lat is not None and d.last_known_lng is not None
        ]

        if devices_with_gps:
            for device in devices_with_gps:
                zone = SecurityService.check_point_in_zone(
                    device.last_known_lat, device.last_known_lng, user.department_id
                )
                exit_req = _active_exit_request(device.id, user.id)
                map_status = map_equipment_status(device, zone["in_zone"], exit_req)
                items.append({
                    "id": device.id,
                    "name": device.name,
                    "serial_number": device.serial_number,
                    "assignedTo": user.username,
                    "email": user.email,
                    "role": user.role.name if user.role else None,
                    "lat": device.last_known_lat,
                    "lng": device.last_known_lng,
                    "accuracy": device.last_known_accuracy,
                    "device_status": device.status,
                    "map_status": map_status,
                    "zone_status": "IN_ZONE" if zone["in_zone"] else "OUT_OF_ZONE",
                    "zone_name": zone.get("zone_name"),
                    "exit_request_status": exit_req.status if exit_req else None,
                    "exit_request_id": exit_req.id if exit_req else None,
                    "status": "ONLINE",
                    "department": (
                        user.department.name if user.department
                        else (device.department.name if device.department else None)
                    ),
                    "location_source": "device",
                    "kind": "device",
                    "has_location": True,
                    "last_login": last_login.created_at.isoformat(),
                    "location_updated_at": (
                        device.location_updated_at.isoformat() if device.location_updated_at else None
                    ),
                })
            continue

        lat, lng, accuracy = _login_location(last_login)
        has_real_location = lat is not None and lng is not None
        zone = SecurityService.check_point_in_zone(lat, lng, user.department_id) if has_real_location else {"in_zone": True, "zone_name": None}

        if not has_real_location:
            from app.models.security_models import AuthorizedZone
            fallback_zone = None
            if user.department_id:
                fallback_zone = AuthorizedZone.query.filter_by(department_id=user.department_id).first()
            if not fallback_zone:
                fallback_zone = AuthorizedZone.query.filter_by(department_id=None).first()
            
            if fallback_zone and fallback_zone.center_lat and fallback_zone.center_lng:
                lat = fallback_zone.center_lat
                lng = fallback_zone.center_lng
                accuracy = fallback_zone.radius_meters or 50.0
                zone["in_zone"] = True
                zone["zone_name"] = fallback_zone.name
        exit_req = _active_exit_request(None, user.id)
        items.append({
            "id": user.id,
            "name": user.username,
            "serial_number": None,
            "assignedTo": user.username,
            "email": user.email,
            "role": user.role.name if user.role else None,
            "lat": lat,
            "lng": lng,
            "accuracy": accuracy,
            "device_status": None,
            "map_status": "OUT_OF_ZONE" if lat and lng and not zone["in_zone"] else "ON_SITE",
            "zone_status": "IN_ZONE" if zone["in_zone"] else "OUT_OF_ZONE",
            "zone_name": zone.get("zone_name"),
            "exit_request_status": exit_req.status if exit_req else None,
            "exit_request_id": exit_req.id if exit_req else None,
            "status": "ONLINE",
            "department": user.department.name if user.department else None,
            "location_source": "login" if has_real_location else "zone_center",
            "kind": "user",
            "has_location": lat is not None and lng is not None,
            "last_login": last_login.created_at.isoformat(),
            "location_updated_at": None,
        })

    # Include simulation devices (not assigned to any logged-in user)
    sim_serials = ["EQ-SIM1-DEPT-AROUND", "EQ-SIM2-GPS-OFF", "EQ-SIM3-OFFSITE"]
    existing_device_ids = {item["id"] for item in items}
    for serial in sim_serials:
        device = Device.query.filter_by(serial_number=serial).first()
        if not device or device.id in existing_device_ids:
            continue
        has_loc = device.last_known_lat is not None and device.last_known_lng is not None
        zone = (
            SecurityService.check_point_in_zone(
                device.last_known_lat, device.last_known_lng, device.department_id
            )
            if has_loc
            else {"in_zone": True, "zone_name": None, "reason": "no_gps"}
        )

        if serial == "EQ-SIM2-GPS-OFF":
            map_status = "GPS_DISABLED"
            zone_status = "UNKNOWN"
        elif serial == "EQ-SIM3-OFFSITE":
            map_status = "OUT_OF_ZONE"
            zone_status = "OUT_OF_ZONE"
        else:
            in_zone = zone["in_zone"]
            map_status = "ON_SITE" if in_zone else "OUT_OF_ZONE"
            zone_status = "IN_ZONE" if in_zone else "OUT_OF_ZONE"

        items.append({
            "id": device.id,
            "name": device.name,
            "serial_number": device.serial_number,
            "assignedTo": "Simulation",
            "email": None,
            "role": None,
            "lat": device.last_known_lat,
            "lng": device.last_known_lng,
            "accuracy": device.last_known_accuracy,
            "device_status": device.status,
            "map_status": map_status,
            "zone_status": zone_status,
            "zone_name": zone.get("zone_name"),
            "exit_request_status": None,
            "exit_request_id": None,
            "status": "SIMULATION",
            "department": device.department.name if device.department else None,
            "location_source": "simulation",
            "kind": "device",
            "has_location": has_loc,
            "last_login": None,
            "location_updated_at": (
                device.location_updated_at.isoformat() if device.location_updated_at else None
            ),
        })

    located_count = sum(1 for item in items if item.get("has_location"))
    return {
        "online_count": online_count,
        "located_count": located_count,
        "items": items,
    }


def build_passage_history(requester: User) -> dict:
    """Historique passages / présence site pour admins."""
    role_name = requester.role.name if requester.role else None
    since = datetime.utcnow() - timedelta(days=7)

    req_query = InternalRequest.query.filter(InternalRequest.updated_at >= since)
    log_query = SecurityLog.query.filter(SecurityLog.created_at >= since)

    if role_name in {RoleName.DEPT_ADMIN, "ADMIN_DEPT"}:
        req_query = req_query.filter_by(department_id=requester.department_id)
        dept_users = [u.id for u in User.query.filter_by(department_id=requester.department_id).all()]
        log_query = log_query.filter(SecurityLog.user_id.in_(dept_users)) if dept_users else log_query.filter(False)

    on_site_authorized = []
    exited_with_material = []
    fraudulent = []
    recent_logins = []

    for req in req_query.order_by(InternalRequest.updated_at.desc()).limit(200).all():
        author = User.query.get(req.user_id)
        device = Device.query.get(req.device_id) if req.device_id else None
        base = {
            "request_id": req.id,
            "user": author.username if author else None,
            "department": req.department.name if req.department else None,
            "device": device.name if device else None,
            "device_serial": device.serial_number if device else None,
            "status": req.status,
            "updated_at": req.updated_at.isoformat() if req.updated_at else None,
            "exited_at": req.exited_at.isoformat() if req.exited_at else None,
        }
        if req.status == RequestStatus.PENDING_SECURITY:
            on_site_authorized.append({**base, "label": "Sur site — sortie approuvée, en attente agent"})
        elif req.status == RequestStatus.COMPLETED:
            exited_with_material.append({**base, "label": "Sortie autorisée — matériel sorti"})
        elif req.status == RequestStatus.REJECTED_SECURITY:
            fraudulent.append({**base, "label": "Sortie refusée au poste sécurité"})

    for log in log_query.filter(
        SecurityLog.action.in_(["LOGIN", "GEOFENCE_BREACH", "EXIT_DENIED", "FRAUDULENT_EXIT", "EXIT_AUTHORIZED"])
    ).order_by(SecurityLog.created_at.desc()).limit(100).all():
        user = User.query.get(log.user_id) if log.user_id else None
        try:
            details = json.loads(log.details or "{}")
        except Exception:
            details = {}
        loc = details.get("location") if isinstance(details, dict) else {}
        entry = {
            "id": log.id,
            "action": log.action,
            "user": user.username if user else "System",
            "department": user.department.name if user and user.department else None,
            "timestamp": log.created_at.isoformat(),
            "zone_status": details.get("zone_status"),
            "lat": loc.get("lat") if isinstance(loc, dict) else details.get("lat"),
            "lng": loc.get("lng") if isinstance(loc, dict) else details.get("lng"),
            "message": details.get("message") if isinstance(details, dict) else str(details)[:200],
        }
        if log.action == "LOGIN":
            recent_logins.append(entry)
        elif log.action in {"GEOFENCE_BREACH", "FRAUDULENT_EXIT", "EXIT_DENIED"}:
            fraudulent.append(entry)

    return {
        "on_site_authorized": on_site_authorized,
        "exited_with_material": exited_with_material,
        "fraudulent_or_blocked": fraudulent,
        "recent_logins": recent_logins,
    }
