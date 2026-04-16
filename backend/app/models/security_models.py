from datetime import datetime, timedelta
import uuid
from app.database import db

# Role Constants
class RoleName:
    SUPER_ADMIN = "ADMIN_GENERAL" # Administrateur Général
    DEPT_ADMIN = "ADMIN_DEPT"     # Administrateur de Département
    SUPERVISOR = "SUPERVISOR"     # Superviseur
    SECURITY_AGENT = "SECURITY_AGENT" # Agent de Sécurité (Porter)
    USER = "USER"                 # Utilisateur

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

class SecurityAlert(db.Model):
    """Alertes générées par le système"""
    __tablename__ = "security_alerts"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    department_id = db.Column(db.String(36), db.ForeignKey("departments.id"), nullable=True)
    type = db.Column(db.String(100)) # UNKNOWN_DEVICE, UNUSUAL_LOCATION, BRUTE_FORCE, UNAUTHORIZED_EXIT
    message = db.Column(db.Text)
    is_resolved = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

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
