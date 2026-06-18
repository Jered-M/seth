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


class WorkflowService:
    @staticmethod
    def _notify_security_agents(request: InternalRequest, title: str, notif_type: str):
        agents = User.query.join(Role).filter(Role.name == RoleName.SECURITY_AGENT).all()
        for agent in agents:
            WorkflowService._notify(
                agent.id,
                notif_type,
                title,
                {
                    "request_id": request.id,
                    "department_id": request.department_id,
                    "device_id": request.device_id,
                    "title": request.title,
                },
            )
    @staticmethod
    def _notify(user_id: str, notif_type: str, title: str, payload: dict):
        notification = Notification(
            user_id=user_id,
            type=notif_type,
            title=title,
            payload_json=json.dumps(payload),
        )
        db.session.add(notification)

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
    def confirm_physical_exit(request: InternalRequest, agent: User, comment: str | None = None):
        if request.status != RequestStatus.PENDING_SECURITY:
            raise ValueError("Demande non éligible au contrôle sécurité")
        if not agent.role or agent.role.name != RoleName.SECURITY_AGENT:
            raise PermissionError("Réservé à l'agent de sécurité")

        request.status = RequestStatus.COMPLETED
        request.security_reviewer_id = agent.id
        request.security_comment = comment
        request.exited_at = datetime.utcnow()
        WorkflowService._event(request.id, agent.id, "SECURITY", "CONFIRM_EXIT", comment)

        if request.device_id:
            device = Device.query.get(request.device_id)
            if device:
                device.status = "OUT"

        WorkflowService._notify(
            request.user_id,
            "REQUEST_COMPLETED",
            "Sortie matériel autorisée et enregistrée",
            {"request_id": request.id},
        )
        request.updated_at = datetime.utcnow()
        db.session.commit()

    @staticmethod
    def deny_physical_exit(request: InternalRequest, agent: User, comment: str):
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
        WorkflowService._notify(
            request.user_id,
            "REQUEST_DENIED_SECURITY",
            "Sortie matériel refusée au poste de sécurité",
            {"request_id": request.id, "comment": comment},
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

        dept_admins = User.query.filter_by(department_id=department_id).all()
        for admin in dept_admins:
            if admin.role and admin.role.name == RoleName.DEPT_ADMIN:
                WorkflowService._notify(
                    admin.id,
                    "SECURITY_ALERT",
                    "Alerte sécurité département",
                    {"alert_id": alert.id, "severity": severity},
                )

        super_admins = User.query.join(Role).filter(Role.name == RoleName.SUPER_ADMIN).all()
        for admin in super_admins:
            WorkflowService._notify(
                admin.id,
                "SECURITY_ALERT",
                "Alerte sécurité globale",
                {"alert_id": alert.id, "severity": severity},
            )

        db.session.commit()
        return alert, incident


class SessionService:
    @staticmethod
    def open_session(user: User, ip: str, user_agent: str, location: dict | None, machine_fingerprint: str | None):
        site_status = "UNKNOWN"
        lat = lng = accuracy = None
        if isinstance(location, dict):
            lat = location.get("lat")
            lng = location.get("lng")
            accuracy = location.get("accuracy")
            # Geofencing simplifié — brancher SecurityService.check_geofencing en prod
            site_status = "ON_SITE" if lat and lng else "UNKNOWN"

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
