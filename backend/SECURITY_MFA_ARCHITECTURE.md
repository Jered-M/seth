# Architecture de Sécurité SetH - Multi-Factor Authentication (MFA)

## 📋 Vue d'ensemble

Ce projet implémente une architecture de sécurité complète pour détecter les sorties non autorisées d'équipements avec support de l'authentification multifactorielle (MFA).

### Composants Clés

#### 1. **OTPManager** (`services/otp_manager.py`)

- Génération de secrets TOTP (Time-based One-Time Password)
- Génération de codes QR pour l'authentification
- Génération et validation de codes de secours (10 codes, format XXXX-XXXX-XXXX)
- Vérification TOTP avec fenêtre de tolérance (±1 intervalle/30 secondes)

**Bibliothèques utilisées:**

- `pyotp`: Génération/validation TOTP
- `qrcode`: Génération de codes QR
- `bcrypt`: Hash sécurisé des codes de secours

#### 2. **AnomalyDetector** (`services/anomaly_detector.py`)

Détecte les anomalies de connexion en calculant un score de risque (0-100):

**Facteurs analysés:**

- **Location Change** (25pts): Changement géographique, changement de pays
- **New Device** (20pts): Connexion depuis un nouvel appareil
- **Time Anomaly** (15pts): Connexions entre 2h-5h du matin
- **Failed Attempts** (20pts): Tentatives échouées consécutives
- **Impossible Velocity** (15pts): Déplacement physiquement impossible
- **Proxy/VPN** (5pts): Détection de proxy ou VPN

**Recommandations automatiques:**

```
Score < 40      → ALLOW (Connexion normale)
40 ≤ Score < 60 → REQUIRE_MFA (MFA obligatoire)
Score ≥ 60      → BLOCK (Connexion bloquée)
```

#### 3. **EquipmentExitDetector** (`services/anomaly_detector.py`)

Détecte les sorties non autorisées d'équipements:

**Zones Autorisées (Géoclôtures):**

```
- Paris: Centre (48.8566, 2.3522), Rayon 50km
- Lyon: Centre (45.7640, 4.8357), Rayon 30km
- Marseille: Centre (43.2965, 5.3698), Rayon 30km
```

#### 4. **SecurityService** (`services/security_service.py`)

Service central combinant toutes les fonctionnalités:

**Authentification:**

- Validation de force de mot de passe (8+ chars, MAJ, min, chiffre, symbole)
- Hachage bcrypt des mots de passe
- Génération/vérification JWT tokens
- Tokens d'accès: 1 heure
- Tokens de rafraîchissement: 30 jours

**MFA TOTP:**

- Setup TOTP via QR code
- Confirmation MFA avec vérification de code
- Gestion des codes de secours
- Vérification lors de connexion

**Appareil de Confiance:**

- Empreinte numérique d'appareil
- Approbation automatique (90 jours)
- Révocation d'appareils

## 🔐 Flux d'Authentification MFA Complete

### Phase 1: Setup Initial

```
1. User → POST /api/mfa/setup-totp
   ↓ Retourne secret + QR code + codes de secours
2. User scanne QR code dans Google Authenticator
3. User → POST /api/mfa/confirm-totp
   ↓ Validation code TOTP + sauvegarde codes de secours
4. MFA activée!
```

### Phase 2: Connexion avec MFA

```
1. User → POST /api/auth/login (email + password + device_id)
   ↓ Vérification identifiants
   ↓ Calcul risque de connexion

   Si risque CRITICAL/HIGH ou MFA obligatoire:
   2. Server demande TOTP code
   3. User → POST /api/mfa/verify-totp (code)
      OU → POST /api/mfa/verify-backup-code (code de secours)

   4. Server valide MFA
   5. Server → Retourne JWT token
```

### Phase 3: Détection d'Analytics/Sécurité Continu

```
1. Chaque tentative de connexion → Evaluation risque
2. Chaque déplacement équipement → Vérification géoclôture
3. Alertes générées si détection anomalie/sortie
```

## 📊 Endpoints API

### Auth & MFA

```
POST   /api/mfa/setup-totp              → Setup TOTP pour utilisateur
POST   /api/mfa/confirm-totp            → Confirmer TOTP avec vérification code
POST   /api/mfa/verify-totp             → Vérifier code TOTP à la connexion
POST   /api/mfa/verify-backup-code      → Vérifier code de secours
POST   /api/mfa/trust-device            → Marquer appareil comme de confiance
GET    /api/mfa/list-devices            → Lister appareils approuvés
POST   /api/mfa/revoke-device           → Révoquer accès appareil
```

### Évaluation Sécurité

```
POST   /api/mfa/evaluate-login-risk     → Évaluer risque pour connexion
POST   /api/mfa/check-equipment-exit    → Vérifier sortie équipement
```

## 🗄️ Modèles de Base de Données Requis

```sql
-- OTP/TOTP secrets
CREATE TABLE OTPSecret (
    id VARCHAR(36) PRIMARY KEY,
    userId VARCHAR(36),
    secret VARCHAR(32) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES User(id)
);

-- Codes de secours
CREATE TABLE BackupCode (
    id VARCHAR(36) PRIMARY KEY,
    userId VARCHAR(36),
    code VARCHAR(255) NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES User(id)
);

-- Appareils de confiance
CREATE TABLE UserDevice (
    id VARCHAR(36) PRIMARY KEY,
    userId VARCHAR(36),
    deviceId VARCHAR(255),
    deviceName VARCHAR(255),
    lastLoginIp VARCHAR(45),
    lastLoginAt TIMESTAMP,
    isAuthorized BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (userId) REFERENCES User(id)
);

-- Logs d'événements sécurité
CREATE TABLE SecurityLog (
    id VARCHAR(36) PRIMARY KEY,
    userId VARCHAR(36),
    action VARCHAR(100),
    details TEXT,
    ipAddress VARCHAR(45),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES User(id)
);

-- Tentatives de connexion
CREATE TABLE LoginAttempt (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255),
    ipAddress VARCHAR(45),
    success BOOLEAN,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Évaluation risque
CREATE TABLE RiskAssessment (
    id VARCHAR(36) PRIMARY KEY,
    userId VARCHAR(36),
    score INT,
    level VARCHAR(20),
    factors TEXT,
    recommendation VARCHAR(20),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES User(id)
);

-- Détection sorties équipements
CREATE TABLE EquipmentExit (
    id VARCHAR(36) PRIMARY KEY,
    equipmentId VARCHAR(36),
    userId VARCHAR(36),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    isUnauthorized BOOLEAN,
    riskLevel VARCHAR(20),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alertes sécurité
CREATE TABLE SecurityAlert (
    id VARCHAR(36) PRIMARY KEY,
    userId VARCHAR(36),
    type VARCHAR(100),
    message TEXT,
    severity VARCHAR(20),
    status VARCHAR(20),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES User(id)
);

-- Ajouter colonnes à la table User
ALTER TABLE User ADD COLUMN mfaEnabled BOOLEAN DEFAULT FALSE;
ALTER TABLE User ADD COLUMN mfaType VARCHAR(50) DEFAULT NULL;
```

## ⚙️ Configuration Environnement

**Variables d'environnement requises (.env):**

```
# JWT
JWT_SECRET_KEY=your-super-secret-key-change-this-in-production
JWT_EXPIRY_HOURS=1
JWT_REFRESH_DAYS=30

# Sécurité MFA
PASSWORD_MIN_LENGTH=8
DEVICE_TRUST_DAYS=90

# GeoIP (pour détection localisation)
GEOIP_API_KEY=your-geoip-api-key  # Optional: ip-api.com is free
```

## 📦 Dépendances Python

```
Flask
Flask-CORS
Flask-JWT-Extended
PyJWT                    # JWT tokens
bcrypt                   # Password hashing
pyotp                    # TOTP generation/validation
qrcode[pil]             # QR code generation
requests                # HTTP requests (GeoIP)
```

Installation:

```bash
pip install -r requirements.txt
```

## 🔧 Integration dans l'app Flask

```python
# app/__init__.py
from flask import Flask
from app.services.security_service import SecurityService
from app.routes.mfa import mfa_bp

app = Flask(__name__)
app.security_service = SecurityService()
app.register_blueprint(mfa_bp)
```

## 📝 Exemples d'Utilisation

### 1. Setup MFA pour un utilisateur

```bash
curl -X POST http://localhost:5000/api/mfa/setup-totp \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "email": "user@example.com"
  }'
```

### 2. Confirmer TOTP

```bash
curl -X POST http://localhost:5000/api/mfa/confirm-totp \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "totp_code": "123456",
    "backup_codes": ["XXXX-XXXX-XXXX", ...]
  }'
```

### 3. Vérifier sortie équipement

```bash
curl -X POST http://localhost:5000/api/mfa/check-equipment-exit \
  -H "Content-Type: application/json" \
  -d '{
    "equipment_id": "eq123",
    "latitude": 48.9000,
    "longitude": 2.5000,
    "user_id": "user123"
  }'
```

## 🚨 Alertes Déclenchées Automatiquement

| Événement                           | Sévérité | Action                            |
| ----------------------------------- | -------- | --------------------------------- |
| **Sortie non autorisée équipement** | CRITICAL | Création alerte, logs             |
| **Risque connexion CRITICAL**       | CRITICAL | Blocage, requiert MFA             |
| **Nouvel appareil détecté**         | MEDIUM   | Notification, approbation requise |
| **MFA échouée**                     | HIGH     | Tentative bloquée                 |
| **Brute force**                     | HIGH     | Compte bloqué 1 heure             |
| **Changement de pays**              | MEDIUM   | MFA requise                       |

## 🔄 Flux de Prévention de Sortie Non Autorisée

```
1. API Equipment reçoit nouvelle localisation GPS
2. check-equipment-exit() vérifie géoclôture
3. Si EXITED:
   - Créer alerte CRITICAL
   - Logger événement
   - Si score risque > 70: BLOQUER sortie
   - Notifier administrateur
   - Enregistrer EquipmentExit
4. Dashboard affiche alertes temps réel
```

## 🛡️ Niveau de Sécurité

**Classification de sécurité:** 🟡 **MEDIUM-HIGH**

✅ Points forts:

- MFA 2-factor (TOTP + device)
- Détection anomalies temps réel
- Géoclôtures réseau
- Rate limiting
- Audit logging complet
- Codes de secours

❌ À améliorer pour production:

- Authentification biométrique (3ème facteur)
- Chiffrement bout-en-bout
- HTTPS obligatoire (TLS 1.3+)
- Alertes temps réel WebSocket
- Pentest professionnel

## 📚 Références

- [RFC 6238 TOTP](https://tools.ietf.org/html/rfc6238)
- [NIST Authentication Guidelines](https://pages.nist.gov/800-63-3/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

---

**Version:** 1.0  
**Dernière mise à jour:** 2026-03-17  
**Responsable:** Security Team
