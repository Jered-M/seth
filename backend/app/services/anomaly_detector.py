"""
Module de détection d'anomalies pour analyse des risques
"""

import math
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import requests


class AnomalyDetector:
    """Détecte les anomalies et calcule les scores de risque"""
    
    # Facteurs de risque pondérés
    RISK_WEIGHTS = {
        'location_change': 25,      # Changement de localisation géographique
        'new_device': 20,           # Nouvel appareil
        'time_anomaly': 15,         # Heure anormale de connexion
        'failed_attempts': 20,      # Tentatives échouées
        'velocity': 15,             # Impossible velocity (déplacement trop rapide)
        'tor_proxy': 5,             # Utilisation VPN/Tor/Proxy
    }
    
    def __init__(self):
        """Initialise le détecteur"""
        self.geoip_service = GeoIPService()
    
    def calculate_risk_score(self, user_id: str, login_data: Dict) -> Dict:
        """
        Calcule un score de risque complet pour une tentative de connexion
        
        Args:
            user_id: ID utilisateur
            login_data: Dictionnaire contenant:
                - ip_address: Adresse IP
                - device_id: ID appareil
                - device_name: Nom de l'appareil
                - user_agent: User agent du navigateur
                - timestamp: Horodatage
                - location_coords: (lat, lon) optionnel
        
        Returns:
            {
                'score': 0-100,
                'level': 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL',
                'factors': {anomaly_type: risk_value},
                'recommendation': 'ALLOW'|'REQUIRE_MFA'|'BLOCK'
            }
        """
        score = 0
        factors = {}
        
        # 1. Vérifier changement de localisation
        location_risk = self._check_location_change(user_id, login_data)
        score += location_risk['value']
        factors['location_change'] = location_risk
        
        # 2. Vérifier nouvel appareil
        device_risk = self._check_new_device(user_id, login_data)
        score += device_risk['value']
        factors['new_device'] = device_risk
        
        # 3. Vérifier anomalie temporelle
        time_risk = self._check_time_anomaly(user_id, login_data)
        score += time_risk['value']
        factors['time_anomaly'] = time_risk
        
        # 4. Vérifier tentatives échouées
        failed_risk = self._check_failed_attempts(user_id)
        score += failed_risk['value']
        factors['failed_attempts'] = failed_risk
        
        # 5. Vérifier vélocité impossible
        velocity_risk = self._check_impossible_velocity(user_id, login_data)
        score += velocity_risk['value']
        factors['velocity'] = velocity_risk
        
        # 6. Vérifier VPN/Proxy
        proxy_risk = self._check_proxy_usage(login_data)
        score += proxy_risk['value']
        factors['tor_proxy'] = proxy_risk
        
        # Normaliser à 0-100
        score = min(100, max(0, score))
        
        # Déterminer le niveau et la recommandation
        level = self._score_to_level(score)
        recommendation = self._score_to_recommendation(score, factors)
        
        return {
            'score': score,
            'level': level,
            'factors': factors,
            'recommendation': recommendation,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    def _check_location_change(self, user_id: str, login_data: Dict) -> Dict:
        """Détecte les changements de localisation suspects"""
        # À implémenter avec la base de données
        risk_data = login_data.get('last_location')
        current_ip = login_data.get('ip_address')
        
        if not risk_data:
            return {'value': 0, 'detected': False, 'reason': 'No previous location'}
        
        try:
            current_geo = self.geoip_service.get_location(current_ip)
            last_geo = risk_data
            
            # Calculer distance en km
            distance = self._haversine_distance(
                (last_geo['latitude'], last_geo['longitude']),
                (current_geo['latitude'], current_geo['longitude'])
            )
            
            # Plus de 1000 km en moins de 1 heure = suspect
            if distance > 1000:
                return {
                    'value': 20,
                    'detected': True,
                    'reason': f'Impossible displacement: {distance:.0f}km',
                    'distance': distance
                }
            
            # Changement de pays = penaltié
            if last_geo['country_code'] != current_geo['country_code']:
                return {
                    'value': 15,
                    'detected': True,
                    'reason': f'Country changed: {last_geo["country"]} → {current_geo["country"]}'
                }
            
            return {'value': 0, 'detected': False, 'reason': 'Location OK'}
            
        except Exception as e:
            return {'value': 0, 'detected': False, 'reason': str(e)}
    
    def _check_new_device(self, user_id: str, login_data: Dict) -> Dict:
        """Détecte les connexions depuis un nouvel appareil"""
        device_id = login_data.get('device_id')
        
        # À implémenter avec la base de données UserDevice
        # Pour maintenant, retourner risque faible
        return {
            'value': 10,
            'detected': False,
            'reason': 'Device verification pending'
        }
    
    def _check_time_anomaly(self, user_id: str, login_data: Dict) -> Dict:
        """Détecte les connexions à des heures anormales"""
        try:
            timestamp = datetime.fromisoformat(login_data['timestamp'])
            hour = timestamp.hour
            
            # Connexions entre 2h-5h du matin = suspectes (sauf cas légitimes)
            if 2 <= hour <= 5:
                return {
                    'value': 10,
                    'detected': True,
                    'reason': f'Unusual login time: {hour}:00'
                }
            
            return {'value': 0, 'detected': False, 'reason': 'Normal login time'}
            
        except Exception as e:
            return {'value': 0, 'detected': False, 'reason': str(e)}
    
    def _check_failed_attempts(self, user_id: str) -> Dict:
        """Détecte les tentatives échouées consécutives"""
        # À implémenter avec vérification LoginAttempt
        # Compter les échecs dans les 15 dernières minutes
        return {
            'value': 0,
            'detected': False,
            'reason': 'No failed attempts'
        }
    
    def _check_impossible_velocity(self, user_id: str, login_data: Dict) -> Dict:
        """Vérifie l'impossibilité physique de déplacement"""
        # Basé sur les données de localisation
        return {
            'value': 0,
            'detected': False,
            'reason': 'Velocity OK'
        }
    
    def _check_proxy_usage(self, login_data: Dict) -> Dict:
        """Détecte l'utilisation de VPN/Proxy"""
        ip = login_data.get('ip_address')
        
        try:
            # Vérifier si IP est dans une liste de proxies connus
            is_proxy = self.geoip_service.is_proxy(ip)
            
            if is_proxy:
                return {
                    'value': 10,
                    'detected': True,
                    'reason': 'Proxy/VPN detected'
                }
            
            return {'value': 0, 'detected': False, 'reason': 'Direct connection'}
            
        except Exception as e:
            return {'value': 0, 'detected': False, 'reason': str(e)}
    
    def _score_to_level(self, score: int) -> str:
        """Convertit un score en niveau d'alerte"""
        if score >= 80:
            return 'CRITICAL'
        elif score >= 60:
            return 'HIGH'
        elif score >= 40:
            return 'MEDIUM'
        else:
            return 'LOW'
    
    def _score_to_recommendation(self, score: int, factors: Dict) -> str:
        """Convertit un score en recommandation"""
        if score >= 80:
            return 'BLOCK'
        elif score >= 50:
            return 'REQUIRE_MFA'
        else:
            return 'ALLOW'
    
    @staticmethod
    def _haversine_distance(coord1: Tuple[float, float], 
                           coord2: Tuple[float, float]) -> float:
        """
        Calcule la distance en km entre deux coordonnées (lat, lon)
        Formule de Haversine
        """
        lat1, lon1 = coord1
        lat2, lon2 = coord2
        
        R = 6371  # Rayon moyen de la terre en km
        
        # Convertir en radians
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        # Formule Haversine
        a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        return R * c


class GeoIPService:
    """Service de géolocalisation par adresse IP"""
    
    # Utilise ip-api.com (gratuit) ou MaxMind GeoIP2
    BASE_URL = "http://ip-api.com/json/"
    
    def get_location(self, ip_address: str) -> Dict:
        """
        Récupère la localisation d'une adresse IP
        
        Retourne:
            {
                'country': 'France',
                'country_code': 'FR',
                'city': 'Paris',
                'latitude': 48.8566,
                'longitude': 2.3522,
                'isp': 'Orange France'
            }
        """
        try:
            response = requests.get(f"{self.BASE_URL}{ip_address}")
            response.raise_for_status()
            data = response.json()
            
            if data.get('status') == 'fail':
                raise ValueError(f"GeoIP lookup failed: {data.get('message')}")
            
            return {
                'country': data.get('country'),
                'country_code': data.get('countryCode'),
                'city': data.get('city'),
                'latitude': data.get('lat'),
                'longitude': data.get('lon'),
                'isp': data.get('isp'),
                'timezone': data.get('timezone'),
                'is_proxy': data.get('proxy', False)
            }
            
        except Exception as e:
            raise Exception(f"GeoIP service error: {str(e)}")
    
    @staticmethod
    def is_proxy(ip_address: str) -> bool:
        """Vérifie si une IP est identifiée comme proxy"""
        # À implémenter avec service IP2Proxy ou similaire
        return False


class EquipmentExitDetector:
    """Détecte les sorties non autorisées d'équipements"""
    
    def __init__(self, config):
        self.config = config
        self.geofence_manager = GeofenceManager(config)
    
    def detect_unauthorized_exit(self, equipment_id: str, 
                                current_location: Tuple[float, float],
                                user_id: str) -> Dict:
        """
        Détecte si un équipement est en sortie non autorisée
        
        Args:
            equipment_id: ID équipement
            current_location: (latitude, longitude)
            user_id: Utilisateur responsable
        
        Returns:
            {
                'is_unauthorized': bool,
                'geofence_exited': bool,
                'zone_left': str,
                'distance_from_geofence': float,
                'risk_level': 'LOW'|'HIGH'|'CRITICAL'
            }
        """
        # Vérifier si l'équipement a quitté la géoclôture
        geofence_check = self.geofence_manager.check_location(equipment_id, current_location)
        
        result = {
            'is_unauthorized': False,
            'geofence_exited': geofence_check['exited'],
            'zone_left': geofence_check['zone'],
            'distance_from_geofence': geofence_check['distance'],
            'risk_level': 'LOW'
        }
        
        if geofence_check['exited']:
            result['is_unauthorized'] = True
            result['risk_level'] = 'CRITICAL'
            # À intégrer: vérifier les autorisations spéciales, etc.
        
        return result


class GeofenceManager:
    """Gère les géoclôtures (zones autorisées)"""
    
    def __init__(self, config):
        self.zones = config.GEOFENCE_ZONES
    
    def check_location(self, equipment_id: str, 
                      current_location: Tuple[float, float]) -> Dict:
        """
        Vérifie si l'équipement est dans une géoclôture autorisée
        
        Retourne:
            {
                'inside': bool,
                'exited': bool,
                'zone': str (nom zone),
                'distance': float (km)
            }
        """
        lat, lon = current_location
        
        for zone_name, zone_data in self.zones.items():
            center = zone_data['center']  # (lat, lon)
            radius = zone_data['radius']  # km
            
            distance = self._haversine_distance(
                (lat, lon),
                (center[0], center[1])
            )
            
            if distance <= radius:
                return {
                    'inside': True,
                    'exited': False,
                    'zone': zone_name,
                    'distance': distance
                }
        
        # Aucune zone, équipement sorti
        closest_zone = min(self.zones.items(), 
                          key=lambda x: self._haversine_distance(
                              (lat, lon),
                              (x[1]['center'][0], x[1]['center'][1])
                          ))
        
        distance = self._haversine_distance(
            (lat, lon),
            (closest_zone[1]['center'][0], closest_zone[1]['center'][1])
        )
        
        return {
            'inside': False,
            'exited': True,
            'zone': closest_zone[0],
            'distance': distance
        }
    
    @staticmethod
    def _haversine_distance(coord1: Tuple[float, float], 
                           coord2: Tuple[float, float]) -> float:
        """Calcule distance en km entre deux coordonnées"""
        lat1, lon1 = coord1
        lat2, lon2 = coord2
        
        R = 6371
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        return R * c
