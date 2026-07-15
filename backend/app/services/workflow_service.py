import json
from datetime import datetime

from app.database import db
from app.models.security_models import (
    AuditImpersonation,
    Device,
    InternalRequest,
    Notification,
    RequestApprovalEvent,
    RequestStatus,
    Role,
    RoleName,
    SecurityAlert,
    SecurityIncident,
    User,
    UserSession,
)
from app.services.security_service import SecurityService


class WorkflowService:
    @staticmethod
    def _security_agent_users():
        return User.query.join(Role).filter(Role.name == RoleName.SECURITY_AGENT).all()

    @staticmethod
    def _notify_security_agents(request: InternalRequest, title: str, notif_type: str, extra: dict | None = None):
        author = User.query.get(request.user_id)
        dept_name = request.department.name if request.department else None
        payload = {
            "request_id": request.id,
            "department_id": request.department_id,
            "department": dept_name,
            "device_id": request.device_id,
            "title": request.title,
            "message": f"{author.username if author else 'Utilisateur'} — {request.title}",
            **(extra or {}),
        }
        for agent in WorkflowService._security_agent_users():
            WorkflowService._notify(agent.id, notif_type, title, payload)

    @staticmethod
    def dispatch_alert_notifications(alert: SecurityAlert, title: str, exclude_user_id: str | None = None):
        """Diffuse une alerte/signalement aux agents sécurité, admins dept et admin général."""
        reporter = User.query.get(alert.user_id) if alert.user_id else None
        dept_name = reporter.department.name if reporter and reporter.department else None
        payload = {
            "alert_id": alert.id,
            "alert_type": alert.type,
            "message": alert.message,
            "department_id": alert.department_id,
            "department": dept_name,
            "reporter": reporter.username if reporter else None,
        }

        def _should_notify(user_id: str) -> bool:
            return not exclude_user_id or user_id != exclude_user_id

        for agent in WorkflowService._security_agent_users():
            if _should_notify(agent.id):
                WorkflowService._notify(agent.id, "SECURITY_ALERT", title, payload)

        if alert.department_id:
            for admin in User.query.filter_by(department_id=alert.department_id).all():
                if (
                    admin.role
                    and admin.role.name in {RoleName.DEPT_ADMIN, "ADMIN_DEPT"}
                    and _should_notify(admin.id)
                ):
                    WorkflowService._notify(admin.id, "SECURITY_ALERT", title, payload)

        for admin in User.query.join(Role).filter(Role.name.in_([RoleName.SUPER_ADMIN, "ADMIN_GENERAL"])).all():
            if _should_notify(admin.id):
                WorkflowService._notify(admin.id, "SECURITY_ALERT", title, payload)

    @staticmethod
    def _notify_exit_event(request: InternalRequest, notif_type: str, title: str, message: str, extra: dict | None = None):
        """Notifie agents sécurité + admins lors d'un événement de sortie."""
        payload = {
            "request_id": request.id,
            "department_id": request.department_id,
            "device_id": request.device_id,
            "message": message,
            **(extra or {}),
        }
        WorkflowService._notify_security_agents(request, title, notif_type, {"message": message, **(extra or {})})

        for admin in User.query.filter_by(department_id=request.department_id).all():
            if admin.role and admin.role.name in {RoleName.DEPT_ADMIN, "ADMIN_DEPT"}:
                WorkflowService._notify(admin.id, notif_type, title, payload)

        for sa in User.query.join(Role).filter(Role.name.in_([RoleName.SUPER_ADMIN, "ADMIN_GENERAL"])).all():
            WorkflowService._notify(sa.id, notif_type, title, payload)
    @staticmethod
    def _notify(user_id: str, notif_type: str, title: str, payload: dict):
        notification = Notification(
            user_id=user_id,
            type=notif_type,
            title=title,
            payload_json=json.dumps(payload, ensure_ascii=False),
        )
        db.session.add(notification)
        db.session.flush()
        notification_id = notification.id
        db.session.commit()

        from app.services.push_service import PushService

        PushService.send_to_user(
            user_id,
            title,
            payload.get("message") or title,
            {"notification_id": notification_id, "type": notif_type},
        )

    @staticmethod
    def _event(request_id: str, actor_id: str, level: str, action: str, comment: str | None = None):
        db.session.add(
            RequestApprovalEvent(
                request_id=request_id,
                actor_id=actor_id,
                level=level,
                action=action,
                comment=comment,
            )
        )

    @staticmethod
    def create_request(user: User, data: dict) -> InternalRequest:
        if not user.department_id:
            raise ValueError("Utilisateur sans département")

        request = InternalRequest(
            user_id=user.id,
            department_id=user.department_id,
            device_id=data.get("device_id"),
            type=data.get("type", "GENERAL"),
            title=data.get("title", "Demande interne"),
            reason=data.get("reason", ""),
            status=RequestStatus.PENDING_DEPT,
        )
        db.session.add(request)
        db.session.flush()

        WorkflowService._event(request.id, user.id, "USER", "CREATE", data.get("reason"))
        WorkflowService._notify(
            user.id,
            "REQUEST_CREATED",
            "Demande envoyée",
            {"request_id": request.id, "status": request.status},
        )

        dept_admins = User.query.filter_by(department_id=user.department_id).all()
        for admin in dept_admins:
            if admin.role and admin.role.name == RoleName.DEPT_ADMIN:
                WorkflowService._notify(
                    admin.id,
                    "REQUEST_PENDING_DEPT",
                    "Nouvelle demande à valider",
                    {"request_id": request.id, "department_id": user.department_id},
                )

        db.session.commit()
        return request

    @staticmethod
    def approve_request(request: InternalRequest, actor: User, comment: str | None = None):
        role = actor.role.name if actor.role else None

        if request.status == RequestStatus.PENDING_DEPT and role == RoleName.DEPT_ADMIN:
            if actor.department_id != request.department_id:
                raise PermissionError("Hors périmètre département")
            request.status = RequestStatus.PENDING_GENERAL
            request.dept_reviewer_id = actor.id
            request.dept_comment = comment
            WorkflowService._event(request.id, actor.id, "DEPT", "APPROVE", comment)
            WorkflowService._notify(
                request.user_id,
                "REQUEST_ESCALATED",
                "Demande validée par votre département",
                {"request_id": request.id},
            )
            super_admins = User.query.join(Role).filter(Role.name == RoleName.SUPER_ADMIN).all()
            for admin in super_admins:
                WorkflowService._notify(
                    admin.id,
                    "REQUEST_PENDING_GENERAL",
                    "Validation finale requise",
                    {"request_id": request.id},
                )

        elif request.status == RequestStatus.PENDING_GENERAL and role == RoleName.SUPER_ADMIN:
            request.status = RequestStatus.PENDING_SECURITY
            request.general_reviewer_id = actor.id
            request.general_comment = comment
            WorkflowService._event(request.id, actor.id, "GENERAL", "APPROVE", comment)
            WorkflowService._notify(
                request.user_id,
                "REQUEST_PENDING_SECURITY",
                "Demande approuvée — présentez-vous au poste de sécurité",
                {"request_id": request.id},
            )
            WorkflowService._notify_security_agents(
                request,
                "Sortie matériel à contrôler",
                "REQUEST_PENDING_SECURITY",
            )
        else:
            raise ValueError("Transition invalide")

        request.updated_at = datetime.utcnow()
        db.session.commit()

    @staticmethod
    def reject_request(request: InternalRequest, actor: User, comment: str):
        if not comment:
            raise ValueError("Commentaire obligatoire")

        role = actor.role.name if actor.role else None
        if request.status == RequestStatus.PENDING_DEPT and role == RoleName.DEPT_ADMIN:
            if actor.department_id != request.department_id:
                raise PermissionError("Hors périmètre département")
            request.status = RequestStatus.REJECTED_DEPT
            request.dept_reviewer_id = actor.id
            request.dept_comment = comment
            WorkflowService._event(request.id, actor.id, "DEPT", "REJECT", comment)
        elif request.status == RequestStatus.PENDING_GENERAL and role == RoleName.SUPER_ADMIN:
            request.status = RequestStatus.REJECTED_GENERAL
            request.general_reviewer_id = actor.id
            request.general_comment = comment
            WorkflowService._event(request.id, actor.id, "GENERAL", "REJECT", comment)
        else:
            raise ValueError("Transition invalide")

        WorkflowService._notify(
            request.user_id,
            "REQUEST_REJECTED",
            "Demande rejetée",
            {"request_id": request.id, "comment": comment},
        )
        request.updated_at = datetime.utcnow()
        db.session.commit()

    @staticmethod
    def confirm_physical_exit(request: InternalRequest, agent: User, comment: str | None = None, agent_location: dict | None = None):
        if request.status != RequestStatus.PENDING_SECURITY:
            raise ValueError("Demande non éligible au contrôle sécurité")
        if not agent.role or agent.role.name not in {RoleName.SECURITY_AGENT, RoleName.SUPER_ADMIN, "ADMIN_GENERAL"}:
            raise PermissionError("Réservé à l'agent de sécurité ou admin général")

        request.status = RequestStatus.COMPLETED
        request.security_reviewer_id = agent.id
        request.security_comment = comment
        request.exited_at = datetime.utcnow()
        WorkflowService._event(request.id, agent.id, "SECURITY", "CONFIRM_EXIT", comment)

        if request.device_id:
            device = Device.query.get(request.device_id)
            if device:
                device.status = "OUT"

        exit_details = {
            "message": "Passage autorisé — sortie matériel",
            "request_id": request.id,
            "device_id": request.device_id,
            "agent_location": agent_location,
        }
        SecurityService.log_event(
            agent.id,
            "EXIT_AUTHORIZED",
            json.dumps(exit_details),
            "127.0.0.1",
            "security-agent",
            department_id=request.department_id,
        )

        author = User.query.get(request.user_id)
        if author:
            WorkflowService._notify(
                request.user_id,
                "REQUEST_COMPLETED",
                "Sortie matériel autorisée au poste sécurité",
                {"request_id": request.id, "message": "Passage autorisé — sortie matériel"},
            )
            exit_msg = f"Sortie autorisée — {author.username}"
            WorkflowService._notify_exit_event(
                request,
                "EXIT_AUTHORIZED",
                exit_msg,
                exit_msg,
                exit_details,
            )

        request.updated_at = datetime.utcnow()
        db.session.commit()

    @staticmethod
    def deny_physical_exit(request: InternalRequest, agent: User, comment: str, agent_location: dict | None = None):
        if not comment:
            raise ValueError("Motif obligatoire")
        if request.status != RequestStatus.PENDING_SECURITY:
            raise ValueError("Demande non éligible au contrôle sécurité")
        if not agent.role or agent.role.name != RoleName.SECURITY_AGENT:
            raise PermissionError("Réservé à l'agent de sécurité")

        request.status = RequestStatus.REJECTED_SECURITY
        request.security_reviewer_id = agent.id
        request.security_comment = comment
        WorkflowService._event(request.id, agent.id, "SECURITY", "DENY_EXIT", comment)

        deny_details = {
            "message": f"Sortie refusée — {comment}",
            "request_id": request.id,
            "agent_location": agent_location,
        }
        SecurityService.log_event(
            agent.id,
            "EXIT_DENIED",
            json.dumps(deny_details),
            "127.0.0.1",
            "security-agent",
            status="ALERT",
            risk_score=70,
            department_id=request.department_id,
        )
        SecurityService.log_event(
            request.user_id,
            "FRAUDULENT_EXIT",
            json.dumps(deny_details),
            "127.0.0.1",
            "security-agent",
            status="ALERT",
            risk_score=80,
            department_id=request.department_id,
        )

        deny_title = "Sortie matériel refusée au poste de sécurité"
        deny_msg = f"Sortie refusée — {comment}"
        WorkflowService._notify(
            request.user_id,
            "REQUEST_DENIED_SECURITY",
            deny_title,
            {"request_id": request.id, "comment": comment, "message": deny_msg},
        )
        WorkflowService._notify_exit_event(
            request,
            "REQUEST_DENIED_SECURITY",
            deny_title,
            deny_msg,
            {"comment": comment, **deny_details},
        )
        request.updated_at = datetime.utcnow()
        db.session.commit()


class SecurityWorkflowService:
    @staticmethod
    def trigger_alert(agent: User, department_id: str, alert_type: str, message: str, severity: str = "CRITICAL"):
        alert = SecurityAlert(
            user_id=agent.id,
            department_id=department_id,
            type=alert_type,
            message=message,
        )
        db.session.add(alert)
        db.session.flush()

        incident = SecurityIncident(
            alert_id=alert.id,
            department_id=department_id,
            triggered_by=agent.id,
            status="OPEN",
        )
        db.session.add(incident)

        WorkflowService.dispatch_alert_notifications(
            alert,
            f"Alerte sécurité — {message[:80]}",
            exclude_user_id=agent.id,
        )

        db.session.commit()
        return alert, incident


class SessionService:
    @staticmethod
    def open_session(user: User, ip: str, user_agent: str, location: dict | None, machine_fingerprint: str | None, in_zone: bool | None = None):
        site_status = "UNKNOWN"
        lat = lng = accuracy = None
        if isinstance(location, dict):
            lat = location.get("lat")
            lng = location.get("lng")
            accuracy = location.get("accuracy")
            if in_zone is not None:
                site_status = "ON_SITE" if in_zone else "OFF_SITE"
            elif lat and lng:
                zone = SecurityService.check_point_in_zone(lat, lng, user.department_id)
                site_status = "ON_SITE" if zone["in_zone"] else "OFF_SITE"

        session = UserSession(
            user_id=user.id,
            machine_fingerprint=machine_fingerprint,
            user_agent=(user_agent or "")[:255],
            ip_address=ip,
            lat=lat,
            lng=lng,
            accuracy_m=accuracy,
            site_status=site_status,
            is_active=True,
        )
        db.session.add(session)
        db.session.commit()
        return session

    @staticmethod
    def start_audit(admin: User, target: User, reason: str):
        record = AuditImpersonation(
            admin_id=admin.id,
            target_user_id=target.id,
            reason=reason,
        )
        db.session.add(record)
        db.session.commit()
        return record
