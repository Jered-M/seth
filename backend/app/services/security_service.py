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
    def _is_ip_in_subnets(ip_address: str | None, subnets_json: str | None) -> bool:
        if not ip_address or not subnets_json:
            return False
        try:
            import json
            import ipaddress
            subnets = json.loads(subnets_json)
            ip_obj = ipaddress.ip_address(ip_address)
            for subnet in subnets:
                if ip_obj in ipaddress.ip_network(subnet, strict=False):
                    return True
        except Exception:
            pass
        return False

    @staticmethod
    def check_geofencing(device_id: str, ip_address: str | None = None) -> bool:
        """Vérifie si l'équipement est dans une zone autorisée (IP, Polygone ou Cercle)"""
        device = Device.query.get(device_id)
        
        zones = AuthorizedZone.query.filter(
            (AuthorizedZone.department_id == device.department_id) | (AuthorizedZone.department_id == None)
        ).all()
        
        if not zones:
            return True # Aucune restriction
            
        # 1. Vérification par IP en priorité (le plus fiable pour un desktop connecté au réseau)
        if ip_address:
            for zone in zones:
                if zone.ip_subnets and SecurityService._is_ip_in_subnets(ip_address, zone.ip_subnets):
                    return True

        if not device or not device.last_known_lat or not device.last_known_lng:
            # Si on a checké l'IP sans succès et qu'on a pas de GPS, on autorise par défaut
            # (ou on pourrait bloquer, mais pour éviter les faux positifs on garde l'ancien comportement)
            return True 

            
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
    def check_point_in_zone(lat: float | None, lng: float | None, department_id: str | None = None, ip_address: str | None = None) -> dict:
        """Vérifie si un point (GPS ou IP) est dans une zone autorisée."""
        zones = AuthorizedZone.query.filter(
            (AuthorizedZone.department_id == department_id) | (AuthorizedZone.department_id.is_(None))
        ).all()
        if not zones:
            return {"in_zone": True, "zone_name": None, "reason": "no_zones_configured"}

        # 1. Vérification IP
        if ip_address:
            for zone in zones:
                if zone.ip_subnets and SecurityService._is_ip_in_subnets(ip_address, zone.ip_subnets):
                    return {"in_zone": True, "zone_name": zone.name, "reason": "ip_subnet"}

        if lat is None or lng is None:
            return {"in_zone": True, "zone_name": None, "reason": "no_gps"}

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


