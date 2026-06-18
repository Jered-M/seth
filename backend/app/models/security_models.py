from datetime import datetime, timedelta
import uuid
from app.database import db

# Role Constants
class RoleName:
    SUPER_ADMIN = "ADMIN_GENERAL"  # Administrateur Général
    ADMIN_GENERAL = SUPER_ADMIN    # alias rétrocompatibilité
    DEPT_ADMIN = "ADMIN_DEPT"      # Administrateur de Département
    ADMIN_DEPT = DEPT_ADMIN        # alias rétrocompatibilité
    SUPERVISOR = "SUPERVISOR"      # Superviseur
    SECURITY_AGENT = "SECURITY_AGENT"  # Agent de Sécurité (Porter)
    USER = "USER"                  # Utilisateur

class Role(db.Model):
    __tablename__ = "roles"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.String(255))

class Department(db.Model):
    __tablename__ = "departments"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = db.Column(db.String(100), unique=True, nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role_id = db.Column(db.String(36), db.ForeignKey("roles.id"))
    department_id = db.Column(db.String(36), db.ForeignKey("departments.id"), nullable=True)
    mfa_enabled = db.Column(db.Boolean, default=False)
    mfa_secret = db.Column(db.String(32), nullable=True)
    is_blocked = db.Column(db.Boolean, default=False)
    failed_attempts = db.Column(db.Integer, default=0)
    last_failed_attempt = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    role = db.relationship("Role", backref="users")
    department = db.relationship("Department", backref="users")

class Device(db.Model):
    """Représente un équipement informatique"""
    __tablename__ = "devices"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=False)
    serial_number = db.Column(db.String(100), unique=True, nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"))
    department_id = db.Column(db.String(36), db.ForeignKey("departments.id"))
    status = db.Column(db.String(50), default="AVAILABLE") # AVAILABLE, IN_USE, EXIT_REQUESTED, OUT_OF_ZONES
    last_known_lat = db.Column(db.Float, nullable=True)
    last_known_lng = db.Column(db.Float, nullable=True)
    last_known_accuracy = db.Column(db.Float, nullable=True)
    location_updated_at = db.Column(db.DateTime, nullable=True)

    user = db.relationship("User", backref="devices")
    department = db.relationship("Department", backref="devices")

class ExitRequest(db.Model):
    """Demande de sortie d'équipement"""
    __tablename__ = "exit_requests"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id = db.Column(db.String(36), db.ForeignKey("devices.id"))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"))
    reason = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(50), default="PENDING") # PENDING, APPROVED, REJECTED
    approved_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    requires_double_validation = db.Column(db.Boolean, default=False)
    second_approved_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    request_date = db.Column(db.DateTime, default=datetime.utcnow)
    expiry_date = db.Column(db.DateTime, nullable=True)

    device = db.relationship("Device", backref="exit_requests")
    user = db.relationship("User", foreign_keys=[user_id], backref="exit_requests")
    first_approver = db.relationship("User", foreign_keys=[approved_by])
    second_approver = db.relationship("User", foreign_keys=[second_approved_by])

class UserDevice(db.Model):
    """Appareils de confiance utilisés pour la connexion"""
    __tablename__ = "user_trusted_devices"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"))
    device_id_hash = db.Column(db.String(255), nullable=False) # Fingerprint
    device_name = db.Column(db.String(255))
    last_ip = db.Column(db.String(45))
    is_trusted = db.Column(db.Boolean, default=False)
    last_login = db.Column(db.DateTime, default=datetime.utcnow)

class SecurityLog(db.Model):
    """Audit log pour toutes les actions"""
    __tablename__ = "security_logs"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    department_id = db.Column(db.String(36), db.ForeignKey("departments.id"), nullable=True)
    action = db.Column(db.String(100), nullable=False)
    details = db.Column(db.Text)
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.String(255))
    status = db.Column(db.String(50)) # SUCCESS, FAILED
    risk_level = db.Column(db.String(20), default="LOW") # LOW, MEDIUM, HIGH
    risk_score = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", foreign_keys=[user_id], backref="security_logs")
    department = db.relationship("Department", backref="security_logs")

class SecurityAlert(db.Model):
    """Alertes générées par le système"""
    __tablename__ = "security_alerts"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    department_id = db.Column(db.String(36), db.ForeignKey("departments.id"), nullable=True)
    type = db.Column(db.String(100)) # UNKNOWN_DEVICE, UNUSUAL_LOCATION, BRUTE_FORCE, UNAUTHORIZED_EXIT
    message = db.Column(db.Text)
    is_resolved = db.Column(db.Boolean, default=False)
    assigned_technician_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    assigned_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    reporter = db.relationship("User", foreign_keys=[user_id], backref="reported_alerts")
    assigned_technician = db.relationship("User", foreign_keys=[assigned_technician_id], backref="assigned_alerts")
    department = db.relationship("Department", backref="security_alerts")

class AuthorizedZone(db.Model):
    """Géofencing: Zones autorisées"""
    __tablename__ = "authorized_zones"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100))
    center_lat = db.Column(db.Float)
    center_lng = db.Column(db.Float)
    radius_meters = db.Column(db.Float)
    polygon_points = db.Column(db.Text, nullable=True) # JSON array of coordinates for polygons
    department_id = db.Column(db.String(36), db.ForeignKey("departments.id"), nullable=True)


class RequestStatus:
    PENDING_DEPT = "PENDING_DEPT"
    PENDING_GENERAL = "PENDING_GENERAL"
    PENDING_SECURITY = "PENDING_SECURITY"  # Validée admin → en attente contrôle gardien
    COMPLETED = "COMPLETED"  # Sortie matériel confirmée par l'agent
    REJECTED_DEPT = "REJECTED_DEPT"
    REJECTED_GENERAL = "REJECTED_GENERAL"
    REJECTED_SECURITY = "REJECTED_SECURITY"  # Refus au poste de sécurité
    CANCELLED = "CANCELLED"


class InternalRequest(db.Model):
    """Demande interne avec workflow à 2 niveaux."""
    __tablename__ = "internal_requests"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    department_id = db.Column(db.String(36), db.ForeignKey("departments.id"), nullable=False)
    device_id = db.Column(db.String(36), db.ForeignKey("devices.id"), nullable=True)
    type = db.Column(db.String(50), default="GENERAL")
    title = db.Column(db.String(200), nullable=False)
    reason = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(50), default=RequestStatus.PENDING_DEPT)
    dept_reviewer_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    general_reviewer_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    security_reviewer_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    dept_comment = db.Column(db.Text, nullable=True)
    general_comment = db.Column(db.Text, nullable=True)
    security_comment = db.Column(db.Text, nullable=True)
    exited_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    author = db.relationship("User", foreign_keys=[user_id], backref="internal_requests")
    department = db.relationship("Department", backref="internal_requests")
    device = db.relationship("Device", backref="internal_requests")


class RequestApprovalEvent(db.Model):
    __tablename__ = "request_approval_events"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    request_id = db.Column(db.String(36), db.ForeignKey("internal_requests.id"), nullable=False)
    actor_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    level = db.Column(db.String(30), nullable=False)  # DEPT | GENERAL
    action = db.Column(db.String(30), nullable=False)  # APPROVE | REJECT | CREATE
    comment = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    request = db.relationship("InternalRequest", backref="approval_events")
    actor = db.relationship("User", backref="approval_events")


class Notification(db.Model):
    __tablename__ = "notifications"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    channel = db.Column(db.String(30), default="IN_APP")
    type = db.Column(db.String(50), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    payload_json = db.Column(db.Text, nullable=True)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", backref="notifications")


class UserSession(db.Model):
    __tablename__ = "user_sessions"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    machine_fingerprint = db.Column(db.String(255), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    ip_address = db.Column(db.String(45), nullable=True)
    lat = db.Column(db.Float, nullable=True)
    lng = db.Column(db.Float, nullable=True)
    accuracy_m = db.Column(db.Float, nullable=True)
    site_status = db.Column(db.String(20), default="UNKNOWN")  # ON_SITE | OFF_SITE | UNKNOWN
    is_active = db.Column(db.Boolean, default=True)
    login_at = db.Column(db.DateTime, default=datetime.utcnow)
    logout_at = db.Column(db.DateTime, nullable=True)

    user = db.relationship("User", backref="sessions")


class SecurityIncident(db.Model):
    __tablename__ = "security_incidents"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    alert_id = db.Column(db.String(36), db.ForeignKey("security_alerts.id"), nullable=True)
    department_id = db.Column(db.String(36), db.ForeignKey("departments.id"), nullable=True)
    triggered_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    status = db.Column(db.String(30), default="OPEN")  # OPEN | RESOLVED
    resolution_note = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    resolved_at = db.Column(db.DateTime, nullable=True)


class AuditImpersonation(db.Model):
    __tablename__ = "audit_impersonations"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    admin_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    target_user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    reason = db.Column(db.Text, nullable=True)
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    ended_at = db.Column(db.DateTime, nullable=True)
