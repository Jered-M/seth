/**
 * Architecture Diagram - MFA & Equipment Security System
 * 
 * This can be rendered as ASCII art or converted to visual diagram
 */

/*
╔══════════════════════════════════════════════════════════════════════════════╗
║           SETH - MULTI-FACTOR AUTHENTICATION ARCHITECTURE                     ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React/TypeScript)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────┐  ┌──────────────────┐  ┌──────────────────────┐   │
│  │  Login Page         │  │ MFA Verification │  │ Security Alerts      │   │
│  │ - Email/Password    │  │ - TOTP Input     │  │ - Real-time alerts   │   │
│  │ - Device Detection  │  │ - Backup Codes   │  │ - Equipment Exits    │   │
│  │ - Risk Evaluation   │  │ - Device Trust   │  │ - Risk Scores        │   │
│  └─────────────────────┘  └──────────────────┘  └──────────────────────┘   │
│           ↓                        ↓                      ↑                   │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                         useMFA() Hook                              │     │
│  │  - setupTOTP()              - evaluateLoginRisk()                 │     │
│  │  - confirmTOTP()            - checkEquipmentExit()               │     │
│  │  - verifyTOTP()             - trustDevice()                      │     │
│  │  - verifyBackupCode()       - listDevices()                      │     │
│  │  - revokeDevice()                                                 │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│           ↓ HTTP/JSON                            ↑ Response                 │
└─────────────────────────────────────────────────────────────────────────────┘
                        │
                        │
           NETWORK (HTTP/1.1 + JSON)
                        │
                        ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                     BACKEND (Python/Flask)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        API Routes (mfa.py)                           │   │
│  │                                                                       │   │
│  │  POST /api/mfa/setup-totp                                           │   │
│  │  POST /api/mfa/confirm-totp                                         │   │
│  │  POST /api/mfa/verify-totp                                          │   │
│  │  POST /api/mfa/verify-backup-code                                   │   │
│  │  POST /api/mfa/trust-device                                         │   │
│  │  POST /api/mfa/evaluate-login-risk                                  │   │
│  │  POST /api/mfa/check-equipment-exit                                 │   │
│  │  GET  /api/mfa/list-devices                                         │   │
│  │  POST /api/mfa/revoke-device                                        │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│           ↓                                      ↑                           │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Security Service Layer                            │   │
│  │                                                                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐         │   │
│  │  │OTPManager    │  │Anomaly       │  │EquipmentExitDetect │         │   │
│  │  │              │  │Detector      │  │                    │         │   │
│  │  │- generate()  │  │              │  │- detect_exit()    │         │   │
│  │  │- verify()    │  │- score()     │  │- check_zone()     │         │   │
│  │  │- qr_code()   │  │- risk_level()│  │- geofence()       │         │   │
│  │  │- backup()    │  │- factors     │  │- distance()       │         │   │
│  │  └──────────────┘  └──────────────┘  └────────────────────┘         │   │
│  │                            ↓                                          │   │
│  │              ┌──────────────────────────┐                             │   │
│  │              │  SecurityService Core    │                             │   │
│  │              │                          │                             │   │
│  │              │ - hash_password()        │                             │   │
│  │              │ - verify_password()      │                             │   │
│  │              │ - generate_jwt()         │                             │   │
│  │              │ - evaluate_risk()        │                             │   │
│  │              │ - log_event()            │                             │   │
│  │              │ - check_device()         │                             │   │
│  │              └──────────────────────────┘                             │   │
│  │                            ↓                                          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                            ↓                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     Database Layer                                   │   │
│  │                                                                       │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐             │   │
│  │  │OTPSecret │  │BackupCode│  │UserDevice│  │SecurityLog          │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘             │   │
│  │                                                                       │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐             │   │
│  │  │LoginAtmpt│  │RiskAssess│  │EquipExit │  │SecurityAlert         │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘             │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│           ↓ SQL                             ↑ MySQL Records                 │
└─────────────────────────────────────────────────────────────────────────────┘
                        │
                        │
              MySQL Database Connection
                        │
                        ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MySQL Database                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  Tables:                                                                     │
│  - User (existing)                        - UserDevice (NEW)                │
│  - Equipment (existing)                   - OTPSecret (NEW)                 │
│  - SecurityLog (existing/enhanced)        - BackupCode (NEW)                │
│  - LoginAttempt (existing/enhanced)       - RiskAssessment (NEW)            │
│  - Department (existing)                  - EquipmentExit (NEW)             │
│  - SecurityAlert (existing/enhanced)                                        │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘


╔══════════════════════════════════════════════════════════════════════════════╗
║                        AUTHENTICATION FLOW (MFA)                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

SCENARIO 1: Normal Login (Low Risk) ✅
┌─────────────────────────────────────────────────────────────────────────────┐
│ User Input: email + password + device_id                                    │
│                    ↓                                                         │
│ 1. Verify Credentials (bcrypt)                                             │
│                    ↓                                                         │
│ 2. Calculate Risk Score                                                    │
│    - Location change:    0 pts (known IP)                                  │
│    - New device:         0 pts (trusted device)                            │
│    - Time anomaly:       0 pts (normal hours)                              │
│    - Failed attempts:    0 pts (none)                                      │
│    - Velocity:           0 pts (impossible? check)                         │
│    - VPN/Proxy:          0 pts (direct connection)                         │
│    ────────────────────────────                                            │
│    TOTAL SCORE: 10/100  (LOW)                                              │
│                    ↓                                                         │
│ 3. Check Recommendation                                                    │
│    Score 10 < 40 → ALLOW                                                  │
│                    ↓                                                         │
│ 4. Issue JWT Token (expiry: 1 hour)                                        │
│                    ↓                                                         │
│ ✅ User LOGGED IN (No MFA required)                                        │
└─────────────────────────────────────────────────────────────────────────────┘

SCENARIO 2: Suspicious Login (High Risk) ⚠️
┌─────────────────────────────────────────────────────────────────────────────┐
│ User Input: email + password + device_id                                    │
│                    ↓                                                         │
│ 1. Verify Credentials (bcrypt)                                             │
│                    ↓                                                         │
│ 2. Calculate Risk Score                                                    │
│    - Location change:   25 pts (country changed: FR→US)                    │
│    - New device:        20 pts (device not in DB)                          │
│    - Time anomaly:      15 pts (3:45 AM - unusual)                         │
│    - Failed attempts:   20 pts (2 failures in last 15 min)                 │
│    - Velocity:          10 pts (1000km in 2 hours)                         │
│    - VPN/Proxy:         0 pts (direct)                                     │
│    ────────────────────────────                                            │
│    TOTAL SCORE: 90/100  (CRITICAL)                                         │
│                    ↓                                                         │
│ 3. Check Recommendation                                                    │
│    Score 90 > 70 → BLOCK                                                  │
│                    ↓                                                         │
│ 4. Create Alert                                                            │
│    - Send SecurityAlert (CRITICAL)                                         │
│    - Log event: "SUSPICIOUS_LOGIN_BLOCKED"                                │
│    - Email admin (if configured)                                           │
│                    ↓                                                         │
│ ❌ USER BLOCKED (potential threat)                                          │
└─────────────────────────────────────────────────────────────────────────────┘

SCENARIO 3: Medium Risk Login (Requires MFA) 🔐
┌─────────────────────────────────────────────────────────────────────────────┐
│ User Input: email + password + device_id                                    │
│                    ↓                                                         │
│ 1. Verify Credentials (bcrypt)                                             │
│                    ↓                                                         │
│ 2. Calculate Risk Score                                                    │
│    - Location change:   25 pts (different city same country)               │
│    - New device:        20 pts (new laptop)                                │
│    - Time anomaly:      0 pts (4 PM - normal)                              │
│    - Failed attempts:   0 pts (none)                                       │
│    - Velocity:          5 pts (300km in 6 hours - plausible)               │
│    - VPN/Proxy:         0 pts (direct)                                     │
│    ────────────────────────────                                            │
│    TOTAL SCORE: 50/100  (MEDIUM)                                           │
│                    ↓                                                         │
│ 3. Check Recommendation                                                    │
│    Score 50 ∈ [40,70] → REQUIRE_MFA                                       │
│                    ↓                                                         │
│ 4A. Show TOTP Verification UI                                              │
│     - Display input field "Enter 6-digit code"                             │
│     - User opens Google Authenticator                                      │
│     - Reads current code: 456789                                           │
│                    ↓                                                         │
│ 4B. Verify TOTP Code                                                       │
│     - POST /api/mfa/verify-totp                                            │
│     - Backend validates against OTPSecret                                  │
│     - TOTP verification successful ✅                                      │
│                    ↓                                                         │
│ 4C. Issue JWT Token                                                        │
│     - Add mfa_verified: true flag                                          │
│     - Token expiry: 1 hour                                                 │
│                    ↓                                                         │
│ ✅ User LOGGED IN (MFA verified)                                           │
│                                                                             │
│ ALTERNATIVE: Use Backup Code                                               │
│     - User clicks "Use backup code instead"                                │
│     - Shows: "XXXX-XXXX-XXXX"                                              │
│     - User enters one of saved codes                                       │
│     - Backend marks code as used                                           │
│     - Continues to step 4C                                                 │
└─────────────────────────────────────────────────────────────────────────────┘


╔══════════════════════════════════════════════════════════════════════════════╗
║                    EQUIPMENT EXIT DETECTION FLOW                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

NORMAL OPERATION: Equipment Inside Zone ✅
┌─────────────────────────────────────────────────────────────────────────────┐
│ Equipment GPS sends: latitude=48.8566, longitude=2.3522 (Paris center)     │
│                    ↓                                                         │
│ Check Geofence:                                                             │
│   - Zone "Paris": center (48.8566, 2.3522), radius 50km                   │
│   - Calculate distance: 0 km                                                │
│   - 0 km < 50 km ✅                                                         │
│                    ↓                                                         │
│ Result:                                                                      │
│   - is_unauthorized: FALSE                                                  │
│   - geofence_exited: FALSE                                                  │
│   - zone: "Paris"                                                            │
│   - distance: 0 km                                                           │
│                    ↓                                                         │
│ ✅ No Alert Generated                                                       │
│ Log: "Equipment location OK"                                                │
└─────────────────────────────────────────────────────────────────────────────┘

ALERT SCENARIO: Equipment Exits Zone ⚠️
┌─────────────────────────────────────────────────────────────────────────────┐
│ Equipment GPS sends: latitude=49.2, longitude=2.3 (North of Paris)         │
│                    ↓                                                         │
│ Check Geofence:                                                             │
│   - Zone "Paris": center (48.8566, 2.3522), radius 50km                   │
│   - Calculate distance: Haversine formula...                                │
│   - Distance = 52.3 km                                                      │
│   - 52.3 km > 50 km ❌ EXITED!                                              │
│                    ↓                                                         │
│ Result:                                                                      │
│   - is_unauthorized: TRUE                                                   │
│   - geofence_exited: TRUE                                                   │
│   - zone_left: "Paris"                                                      │
│   - distance_from_geofence: 52.3 km                                         │
│   - risk_level: "CRITICAL"                                                  │
│                    ↓                                                         │
│ 1. CREATE ALERT                                                             │
│    - Type: "UNAUTHORIZED_EXIT"                                             │
│    - Severity: "CRITICAL"                                                  │
│    - Message: "Equipment exited Paris zone by 52.3km"                      │
│                    ↓                                                         │
│ 2. LOG EVENT                                                                │
│    - Event: "UNAUTHORIZED_EXIT_DETECTED"                                   │
│    - User: Admin who owns equipment                                        │
│    - Details: { equipment_id, lat, lon, zone, distance }                   │
│                    ↓                                                         │
│ 3. Frontend NOTIFICATION                                                    │
│    - <SecurityAlertContainer /> displays critical alert                    │
│    - Red banner "UNAUTHORIZED EXIT: Equipment left Paris"                  │
│    - Auto-dismiss: NO (critical alerts don't auto-dismiss)                 │
│                    ↓                                                         │
│ 🚨 ADMIN ALERTED                                                            │
│ (Email/SMS to be implemented)                                               │
└─────────────────────────────────────────────────────────────────────────────┘


╔══════════════════════════════════════════════════════════════════════════════╗
║                        RISK SCORING ALGORITHM                                 ║
╚══════════════════════════════════════════════════════════════════════════════╝

FORMULA: score = Σ(factor_weight × factor_detected)

Factor                 Weight   Trigger Example                    Points
─────────────────────────────────────────────────────────────────────────────
Location Change         25     Country: France→USA                  +25
New Device              20     Device ID first time                 +20
Time Anomaly            15     Login at 3:45 AM                     +15
Failed Attempts         20     5+ failures in 15 minutes            +20
Impossible Velocity     15     Paris to London in 30 minutes        +15
VPN/Proxy               5      IP from proxy provider               +5
─────────────────────────────────────────────────────────────────────────────
MAXIMUM POSSIBLE SCORE:             100 points

RECOMMENDATION MAPPING:
┌──────────────────────────────────────────────┐
│ Score    Level       Recommendation   Action │
├──────────────────────────────────────────────┤
│ 0-39     LOW         ALLOW            ✅    │
│ 40-59    MEDIUM      REQUIRE_MFA      🔐    │
│ 60-79    HIGH        REQUIRE_MFA      🔐    │
│ 80-100   CRITICAL    BLOCK            ❌    │
└──────────────────────────────────────────────┘

REAL EXAMPLES:

Example 1: Regular Office Worker
  - Same IP: 0 pts
  - Known device: 0 pts
  - Office hours (10 AM): 0 pts
  - No failures: 0 pts
  - Local: 0 pts
  - No VPN: 0 pts
  ────────────────────────
  SCORE: 5/100 → ALLOW ✅

Example 2: Remote Worker from Coffee Shop
  - Different IP (+25): 25 pts
  - Laptop (known device): 0 pts
  - Late evening (11 PM): 15 pts
  - No failures: 0 pts
  - 100km away: 0 pts
  - Coffee WiFi (no VPN): 0 pts
  ────────────────────────
  SCORE: 40/100 → REQUIRE_MFA 🔐

Example 3: Account Compromise Attempt
  - Different country (+25): 25 pts
  - New VPS device (+20): 20 pts
  - 4 AM login (+15): 15 pts
  - 5 failures in 10min (+20): 20 pts
  - Teleportation (+15): 15 pts
  - VPN detected (+5): 5 pts
  ────────────────────────
  SCORE: 100/100 → BLOCK ❌


╔══════════════════════════════════════════════════════════════════════════════╗
║                    DATABASE SCHEMA (8 NEW TABLES)                             ║
╚══════════════════════════════════════════════════════════════════════════════╝

OTPSecret
├─ id (UUID) PK
├─ userId (FK→User)
├─ secret (VARCHAR 32) - TOTP secret base32
├─ createdAt (TIMESTAMP)
└─ Index: (userId, createdAt DESC)

BackupCode
├─ id (UUID) PK
├─ userId (FK→User)
├─ code (VARCHAR 255) - Hashed with bcrypt
├─ used (BOOLEAN)
├─ createdAt (TIMESTAMP)
└─ Index: (userId, used)

UserDevice
├─ id (UUID) PK
├─ userId (FK→User)
├─ deviceId (VARCHAR 255) - Unique device fingerprint
├─ deviceName (VARCHAR 255) - "Chrome Windows", "iPhone"
├─ lastLoginIp (VARCHAR 45) - IPv6 compatible
├─ lastLoginAt (TIMESTAMP)
├─ isAuthorized (BOOLEAN)
└─ Index: (userId, deviceId, isAuthorized)

SecurityLog (Enhanced)
├─ id (UUID) PK
├─ userId (FK→User)
├─ action (VARCHAR 100) - LOGIN_SUCCESS, MFA_VERIFIED, etc.
├─ details (TEXT/JSON)
├─ ipAddress (VARCHAR 45)
├─ createdAt (TIMESTAMP)
└─ Index: (userId, createdAt DESC)

LoginAttempt (Enhanced)
├─ id (UUID) PK
├─ email (VARCHAR 255)
├─ ipAddress (VARCHAR 45)
├─ success (BOOLEAN)
├─ createdAt (TIMESTAMP)
└─ Index: (email, createdAt DESC)

RiskAssessment
├─ id (UUID) PK
├─ userId (FK→User)
├─ score (INT 0-100)
├─ level (ENUM: LOW, MEDIUM, HIGH, CRITICAL)
├─ factors (TEXT/JSON) - Detailed breakdown
├─ recommendation (ENUM: ALLOW, REQUIRE_MFA, BLOCK)
├─ createdAt (TIMESTAMP)
└─ Index: (userId, level, createdAt DESC)

EquipmentExit
├─ id (UUID) PK
├─ equipmentId (FK→Equipment)
├─ userId (FK→User)
├─ latitude (DECIMAL 10,8)
├─ longitude (DECIMAL 11,8)
├─ isUnauthorized (BOOLEAN)
├─ riskLevel (ENUM: LOW, HIGH, CRITICAL)
├─ createdAt (TIMESTAMP)
└─ Index: (equipmentId, isUnauthorized, createdAt DESC)

SecurityAlert (Enhanced)
├─ id (UUID) PK
├─ userId (FK→User)
├─ type (VARCHAR 100) - UNAUTHORIZED_EXIT, MFA_FAILED, etc.
├─ message (TEXT)
├─ severity (ENUM: LOW, MEDIUM, HIGH, CRITICAL)
├─ status (ENUM: PENDING, RESOLVED, FALSE_POSITIVE)
├─ createdAt (TIMESTAMP)
└─ Index: (userId, severity, status, createdAt DESC)
*/

export const architectureNotes = `
KEY DESIGN DECISIONS:

1. WHY TOTP OVER SMS?
   - SMS vulnerable to SIM swapping
   - No network/mobile carrier dependency
   - Works offline with correct time

2. WHY BACKUP CODES?
   - Account recovery if app lost/corrupted
   - 10 codes generated (one-time use each)
   - User responsible for safe storage

3. WHY HAVERSINE DISTANCE?
   - Great-circle distance (Earth is sphere)
   - Accurate for real-world geofencing
   - Standard algorithm in GIS

4. WHY 90-DAY DEVICE TRUST?
   - Balance security vs convenience
   - Force re-verification quarterly
   - Can be customized per organization

5. WHY 50KM FOR PARIS?
   - Covers Île-de-France region
   - Includes suburbs + occasional REMOTE
   - Too small (10km) = false positives

6. WHY JWT OVER SESSION COOKIES?
   - Good for REST APIs / mobile
   - Stateless (scales horizontally)
   - Can contain user info (user_id, role)

7. WHY BCRYPT FOR PASSWORDS?
   - Slow by design (resistant to brute force)
   - Built-in salt generation
   - Constant-time comparison

SECURITY CONSIDERATIONS:

⚠️  NOT SUITABLE FOR:
   - High-security installations (add HSM)
   - Financial transactions (add encryption)
   - Identity verification (add biometrics)

✅ SUITABLE FOR:
   - Corporate equipment tracking
   - Prevent unauthorized removal
   - Account compromise detection
   - Normal business operations

FUTURE ENHANCEMENTS:
   1. Biometric 3rd factor (fingerprint/FaceID)
   2. WebSocket real-time alerts
   3. Email + SMS notifications
   4. Slack/Teams integration
   5. Hardware security keys (FIDO2)
`;
