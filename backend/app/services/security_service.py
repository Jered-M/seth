import bcrypt
import pyotp
import os
import uuid
import hashlib
from datetime import datetime, timedelta
from typing import Dict, Tuple, Optional, List
from flask_jwt_extended import create_access_token, create_refresh_token
from app.database import db
from app.models.security_models import (
    User, Role, UserDevice, SecurityLog, SecurityAlert, Device, ExitRequest, AuthorizedZone, RoleName
)

SUPER_ADMIN_PERIMETER_ZONE_NAME = "SUPER_ADMIN_PC_PERIMETER"
SUPER_ADMIN_PERIMETER_RADIUS_M = 10.0
SUPER_ADMIN_PERIMETER_CENTER_LAT = -11.676486
SUPER_ADMIN_PERIMETER_CENTER_LNG = 27.48082
PERIMETER_ALERT_COOLDOWN_MINUTES = 5


class SecurityService:
    """Service central de sécurité utilisant SQLAlchemy et PostgreSQL"""

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash un mot de passe avec bcrypt"""
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    @staticmethod
    def verify_password(password: str, hashed_password: str) -> bool:
        """Vérifie un mot de passe contre son hash"""
        try:
            return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
        except:
            return False

    @staticmethod
    def log_event(
        user_id: str,
        action: str,
        details: str,
        ip: str,
        user_agent: str,
        status: str = "SUCCESS",
        risk_score: int = 0,
        department_id: str | None = None,
    ):
        """Enregistre un événement de sécurité"""
        user = User.query.get(user_id) if user_id else None
        risk_level = "LOW"
        if risk_score > 70:
            risk_level = "HIGH"
        elif risk_score > 40:
            risk_level = "MEDIUM"

        resolved_dept_id = department_id if department_id is not None else (user.department_id if user else None)

        log = SecurityLog(
            user_id=user_id,
            department_id=resolved_dept_id,
            action=action,
            details=details,
            ip_address=ip,
            user_agent=user_agent,
            status=status,
            risk_score=risk_score,
            risk_level=risk_level,
        )
        db.session.add(log)
        db.session.commit()

    @staticmethod
    def create_alert(user_id: str, alert_type: str, message: str):
        """Crée une alerte de sécurité et notifie les agents + admins."""
        user = User.query.get(user_id) if user_id else None
        alert = SecurityAlert(
            user_id=user_id,
            department_id=user.department_id if user else None,
            type=alert_type,
            message=message,
        )
        db.session.add(alert)
        db.session.flush()

        from app.services.workflow_service import WorkflowService

        title = "Signalement utilisateur" if alert_type == "USER_REPORT" else f"Alerte — {alert_type}"
        WorkflowService.dispatch_alert_notifications(alert, title, exclude_user_id=user_id)

        db.session.commit()
        return alert

    @staticmethod
    def get_device_hash(ip: str, user_agent: str) -> str:
        """Génère une empreinte numérique d'appareil"""
        return hashlib.sha256(f"{ip}-{user_agent}".encode()).hexdigest()

    @staticmethod
    def evaluate_login_risk(user_id: str, ip: str, user_agent: str) -> Dict:
        """Évalue le risque d'une tentative de connexion"""
        score = 0
        factors = []
        
        device_hash = SecurityService.get_device_hash(ip, user_agent)
        known_device = UserDevice.query.filter_by(user_id=user_id, device_id_hash=device_hash).first()
        
        if not known_device:
            score += 40
            factors.append("NOUVEL_APPAREIL")
        elif not known_device.is_trusted:
            score += 20
            factors.append("APPAREIL_NON_APPROUVÉ")

        # Vérifier IP inhabituelle (différente du dernier succès)
        last_success = SecurityLog.query.filter_by(user_id=user_id, action="LOGIN", status="SUCCESS").order_by(SecurityLog.created_at.desc()).first()
        if last_success and last_success.ip_address != ip:
            score += 20
            factors.append("IP_INHABITUELLE")

        # Vérifier tentatives échouées récentes
        recent_fails = SecurityLog.query.filter_by(user_id=user_id, action="LOGIN", status="FAILED")\
            .filter(SecurityLog.created_at > (datetime.utcnow() - timedelta(minutes=15))).count()
        if recent_fails >= 3:
            score += 40
            factors.append("BRUTE_FORCE_SUSPECT")

        recommendation = "ALLOW"
        # Temporairement désactivé pour le développement
        # if score > 70: recommendation = "BLOCK"
        # elif score > 40: recommendation = "REQUIRE_MFA"

        return {
            "score": min(score, 100),
            "factors": factors,
            "recommendation": recommendation
        }

    @staticmethod
    def check_geofencing(device_id: str) -> bool:
        """Vérifie si l'équipement est dans une zone autorisée (Cercle ou Polygone)"""
        device = Device.query.get(device_id)
        if not device or not device.last_known_lat or not device.last_known_lng:
            return True # Pas de data GPS, on autorise par défaut
        
        zones = AuthorizedZone.query.filter(
            (AuthorizedZone.department_id == device.department_id) | (AuthorizedZone.department_id == None)
        ).all()
        
        if not zones:
            return True # Aucune restriction
            
        import math
        import json

        def haversine(lat1, lon1, lat2, lon2):
            R = 6371000 
            phi1, phi2 = math.radians(lat1), math.radians(lat2)
            dphi, dlamba = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
            a = math.sin(dphi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlamba / 2)**2
            return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        def is_point_in_path(x, y, poly):
            """Point-in-polygon algorithm (Ray casting)"""
            n = len(poly)
            inside = False
            p1x, p1y = poly[0]
            for i in range(n + 1):
                p2x, p2y = poly[i % n]
                if y > min(p1y, p2y):
                    if y <= max(p1y, p2y):
                        if x <= max(p1x, p2x):
                            if p1y != p2y:
                                xints = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                            if p1x == p2x or x <= xints:
                                inside = not inside
                p1x, p1y = p2x, p2y
            return inside

        for zone in zones:
            # 1. Vérification par polygone si présent
            if zone.polygon_points:
                try:
                    points = json.loads(zone.polygon_points) # Expected: [[lat, lng], [lat, lng], ...]
                    if is_point_in_path(device.last_known_lat, device.last_known_lng, points):
                        return True
                except:
                    pass # Fallback to circle if polygon parsing fails
            
            # 2. Vérification par cercle
            if zone.center_lat and zone.center_lng and zone.radius_meters:
                dist = haversine(device.last_known_lat, device.last_known_lng, zone.center_lat, zone.center_lng)
                if dist <= zone.radius_meters:
                    return True
                
        return False

    @staticmethod
    def check_point_in_zone(lat: float | None, lng: float | None, department_id: str | None = None) -> dict:
        """Vérifie si un point GPS est dans une zone autorisée."""
        if lat is None or lng is None:
            return {"in_zone": True, "zone_name": None, "reason": "no_gps"}

        zones = AuthorizedZone.query.filter(
            (AuthorizedZone.department_id == department_id) | (AuthorizedZone.department_id.is_(None))
        ).all()
        if not zones:
            return {"in_zone": True, "zone_name": None, "reason": "no_zones_configured"}

        import math
        import json as _json

        def haversine(lat1, lon1, lat2, lon2):
            R = 6371000
            phi1, phi2 = math.radians(lat1), math.radians(lat2)
            dphi, dlamba = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
            a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlamba / 2) ** 2
            return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        def is_point_in_path(x, y, poly):
            n = len(poly)
            inside = False
            p1x, p1y = poly[0]
            for i in range(n + 1):
                p2x, p2y = poly[i % n]
                if y > min(p1y, p2y):
                    if y <= max(p1y, p2y):
                        if x <= max(p1x, p2x):
                            if p1y != p2y:
                                xints = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                            if p1x == p2x or x <= xints:
                                inside = not inside
                p1x, p1y = p2x, p2y
            return inside

        for zone in zones:
            if zone.polygon_points:
                try:
                    points = _json.loads(zone.polygon_points)
                    if is_point_in_path(float(lat), float(lng), points):
                        return {"in_zone": True, "zone_name": zone.name, "reason": "polygon"}
                except Exception:
                    pass
            if zone.center_lat and zone.center_lng and zone.radius_meters:
                dist = haversine(float(lat), float(lng), zone.center_lat, zone.center_lng)
                if dist <= zone.radius_meters:
                    return {"in_zone": True, "zone_name": zone.name, "reason": "circle"}

        return {"in_zone": False, "zone_name": None, "reason": "outside_all_zones"}

    @staticmethod
    def generate_tokens(user: User) -> Dict:
        """Génère un access token et refresh token avec claims de rôle"""
        additional_claims = {
            "role": user.role.name,
            "dept": user.department_id,
            "username": user.username
        }
        return {
            "access_token": create_access_token(identity=user.id, additional_claims=additional_claims),
            "refresh_token": create_refresh_token(identity=user.id)
        }

    @staticmethod
    def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        import math
        R = 6371000
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)
        a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
        return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    @staticmethod
    def _is_super_admin(user: User | None) -> bool:
        if not user or not user.role:
            return False
        return user.role.name in {RoleName.SUPER_ADMIN, "ADMIN_GENERAL"}

    @staticmethod
    def ensure_super_admin_perimeter_zone() -> AuthorizedZone:
        """Crée ou met à jour la zone périmètre 10 m (centre fixe poste super admin)."""
        zone = AuthorizedZone.query.filter_by(name=SUPER_ADMIN_PERIMETER_ZONE_NAME).first()
        if not zone:
            zone = AuthorizedZone(
                name=SUPER_ADMIN_PERIMETER_ZONE_NAME,
                radius_meters=SUPER_ADMIN_PERIMETER_RADIUS_M,
                center_lat=SUPER_ADMIN_PERIMETER_CENTER_LAT,
                center_lng=SUPER_ADMIN_PERIMETER_CENTER_LNG,
                department_id=None,
            )
            db.session.add(zone)
        else:
            zone.radius_meters = SUPER_ADMIN_PERIMETER_RADIUS_M
            zone.center_lat = SUPER_ADMIN_PERIMETER_CENTER_LAT
            zone.center_lng = SUPER_ADMIN_PERIMETER_CENTER_LNG
        db.session.commit()
        return zone

    @staticmethod
    def update_super_admin_anchor(lat: float, lng: float) -> AuthorizedZone:
        """Conserve l'ancre fixe — ignore les coordonnées GPS dynamiques."""
        return SecurityService.ensure_super_admin_perimeter_zone()

    @staticmethod
    def get_super_admin_perimeter_status() -> dict:
        zone = AuthorizedZone.query.filter_by(name=SUPER_ADMIN_PERIMETER_ZONE_NAME).first()
        if not zone or zone.center_lat is None or zone.center_lng is None:
            return {
                "configured": False,
                "radius_m": SUPER_ADMIN_PERIMETER_RADIUS_M,
                "center_lat": None,
                "center_lng": None,
            }
        return {
            "configured": True,
            "radius_m": zone.radius_meters or SUPER_ADMIN_PERIMETER_RADIUS_M,
            "center_lat": zone.center_lat,
            "center_lng": zone.center_lng,
            "name": zone.name,
            "fixed_anchor": True,
        }

    @staticmethod
    def check_super_admin_perimeter(lat: float, lng: float) -> dict:
        """Vérifie si un point est dans le périmètre 10 m du poste super admin."""
        zone = AuthorizedZone.query.filter_by(name=SUPER_ADMIN_PERIMETER_ZONE_NAME).first()
        if not zone or zone.center_lat is None or zone.center_lng is None:
            return {
                "configured": False,
                "inside": True,
                "distance_m": None,
                "radius_m": SUPER_ADMIN_PERIMETER_RADIUS_M,
            }

        radius = zone.radius_meters or SUPER_ADMIN_PERIMETER_RADIUS_M
        distance = SecurityService._haversine_m(
            float(lat), float(lng), zone.center_lat, zone.center_lng
        )
        return {
            "configured": True,
            "inside": distance <= radius,
            "distance_m": round(distance, 1),
            "radius_m": radius,
            "center_lat": zone.center_lat,
            "center_lng": zone.center_lng,
        }

    @staticmethod
    def handle_super_admin_perimeter_breach(
        user: User,
        lat: float,
        lng: float,
        ip: str = "",
        user_agent: str = "",
    ):
        """Alerte si un utilisateur sort du périmètre 10 m autour du PC super admin."""
        if SecurityService._is_super_admin(user):
            return

        check = SecurityService.check_super_admin_perimeter(lat, lng)
        if not check["configured"] or check["inside"]:
            return

        import json as _json

        recent = SecurityAlert.query.filter(
            SecurityAlert.user_id == user.id,
            SecurityAlert.type == "SUPER_ADMIN_PERIMETER_BREACH",
            SecurityAlert.created_at > (datetime.utcnow() - timedelta(minutes=PERIMETER_ALERT_COOLDOWN_MINUTES)),
        ).first()
        if recent:
            return

        message = (
            f"HORS PÉRIMÈTRE — {user.username} à {check['distance_m']} m du poste super admin "
            f"(limite {check['radius_m']} m)"
        )
        SecurityService.create_alert(user.id, "SUPER_ADMIN_PERIMETER_BREACH", message)
        SecurityService.log_event(
            user.id,
            "PERIMETER_BREACH",
            _json.dumps({**check, "lat": lat, "lng": lng}),
            ip,
            user_agent,
            status="ALERT",
            risk_score=90,
            department_id=user.department_id,
        )
