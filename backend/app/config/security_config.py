# Configuration de sécurité complète pour l'application

import os
from datetime import timedelta

# === AUTHENTIFICATION ===
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-super-secret-key-change-in-production")
JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

# === MFA / OTP ===
OTP_ISSUER = "SetH - Equipment Management"
OTP_WINDOW = 1  # Allow ±1 time window
BACKUP_CODES_COUNT = 10

# === Politique de mot de passe ===
PASSWORD_MIN_LENGTH = 8
PASSWORD_REQUIRE_UPPERCASE = True
PASSWORD_REQUIRE_LOWERCASE = True
PASSWORD_REQUIRE_DIGITS = True
PASSWORD_REQUIRE_SYMBOLS = True
PASSWORD_EXPIRY_DAYS = 90

# === Limitation des tentatives ===
MAX_LOGIN_ATTEMPTS = 5
LOGIN_ATTEMPT_WINDOW = 15  # minutes
ACCOUNT_LOCKOUT_DURATION = 30  # minutes

# === Géolocalisation et détection d'anomalies ===
ENABLE_GEOLOCATION = True
MAX_LOCATION_CHANGE_SPEED = 900  # km/h (avion commercial)
SUSPICIOUS_LOGIN_THRESHOLD = 70  # score de risque sur 100

# === Appareil ===
DEVICE_TRUST_DURATION = timedelta(days=90)
REQUIRE_DEVICE_VERIFICATION = True

# === Logs de sécurité ===
SECURITY_LOG_RETENTION_DAYS = 365
ALERT_EMAIL_ON_SUSPICIOUS = True

# === HTTPS & CSRF ===
SECURE_COOKIES = True
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'

# === Rate Limiting ===
RATELIMIT_STORAGE_URL = "memory://"
RATELIMIT_DEFAULT = "200 per day, 50 per hour"
RATELIMIT_LOGIN = "5 per 15 minutes"

# === Géofencing ===
ALLOWED_LOCATIONS = {
    "Paris": {"lat": 48.8566, "lng": 2.3522, "radius_km": 50},
    "Lyon": {"lat": 45.7640, "lng": 4.8357, "radius_km": 30},
    "Marseille": {"lat": 43.2965, "lng": 5.3698, "radius_km": 30},
}
