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
    def log_event(user_id: str, action: str, details: str, ip: str, user_agent: str, status: str = "SUCCESS", risk_score: int = 0):
        """Enregistre un événement de sécurité"""
        user = User.query.get(user_id) if user_id else None
        risk_level = "LOW"
        if risk_score > 70: risk_level = "HIGH"
        elif risk_score > 40: risk_level = "MEDIUM"

        log = SecurityLog(
            user_id=user_id,
            department_id=user.department_id if user else None,
            action=action,
            details=details,
            ip_address=ip,
            user_agent=user_agent,
            status=status,
            risk_score=risk_score,
            risk_level=risk_level
        )
        db.session.add(log)
        db.session.commit()

    @staticmethod
    def create_alert(user_id: str, alert_type: str, message: str):
        """Crée une alerte de sécurité"""
        user = User.query.get(user_id) if user_id else None
        alert = SecurityAlert(
            user_id=user_id,
            department_id=user.department_id if user else None,
            type=alert_type,
            message=message
        )
        db.session.add(alert)
        db.session.commit()

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
