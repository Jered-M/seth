"""
EXAMPLE: How to integrate MFA into existing Flask app

This shows how to modify app/__init__.py to enable all MFA features
"""

# backend/app/__init__.py
# =====================

from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def create_app():
    """Create and configure Flask application"""
    
    app = Flask(__name__)
    
    # ========== CONFIGURATION ==========
    
    # CORS Setup
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    
    # JWT Configuration
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'dev-secret-key-change-in-production')
    jwt = JWTManager(app)
    
    # ========== SECURITY SERVICE INITIALIZATION ==========
    
    # Import security service
    from app.services.security_service import SecurityService
    
    # Initialize security service
    app.security_service = SecurityService()
    
    # ========== REGISTER BLUEPRINTS ==========
    
    # Existing routes
    from app.routes.auth import auth_bp
    from app.routes.equipment import equipment_bp
    from app.routes.admin import admin_bp
    from app.routes.security import security_bp
    from app.routes.exit_requests import exit_requests_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(equipment_bp, url_prefix='/api/equipment')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(security_bp, url_prefix='/api/security')
    app.register_blueprint(exit_requests_bp, url_prefix='/api/exit-requests')
    
    # NEW: MFA routes
    from app.routes.mfa import mfa_bp
    app.register_blueprint(mfa_bp)  # url_prefix already in mfa.py
    
    # ========== ERROR HANDLERS ==========
    
    @app.errorhandler(401)
    def unauthorized(error):
        return {'message': 'Unauthorized'}, 401
    
    @app.errorhandler(403)
    def forbidden(error):
        return {'message': 'Forbidden'}, 403
    
    @app.errorhandler(404)
    def not_found(error):
        return {'message': 'Not found'}, 404
    
    @app.errorhandler(500)
    def internal_error(error):
        return {'message': 'Internal server error'}, 500
    
    # ========== HEALTH CHECK ==========
    
    @app.route('/api/health', methods=['GET'])
    def health():
        return {
            'status': 'ok',
            'mfa_enabled': True,
            'version': '2.0.0'
        }, 200
    
    return app


# ========== INITIALIZATION ==========

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)


"""
ENVIRONMENT VARIABLES (.env)
=============================

# Server
FLASK_ENV=production
FLASK_DEBUG=False

# JWT
JWT_SECRET_KEY=your-super-secret-key-change-this-in-production-to-random-32-chars
JWT_EXPIRY_HOURS=1
JWT_REFRESH_DAYS=30

# Password Policy
PASSWORD_MIN_LENGTH=8
PASSWORD_SPECIAL_CHARS=!@#$%^&*()_+-=[]{}|;:,.<>?

# Device Trust
DEVICE_TRUST_DAYS=90

# Optional: GeoIP
GEOIP_API_KEY=optional-ip2location-api-key

# Database
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=your-password
MYSQL_DATABASE=seth_db

# CORS
CORS_ORIGINS=http://localhost:3050,http://localhost:3000
"""


"""
TESTING THE MFA SETUP
=======================

1. Start backend:
   $ cd backend
   $ python app/__init__.py
   
   Output:
   * Running on http://0.0.0.0:5000
   * Debug mode: off

2. Health check:
   $ curl http://localhost:5000/api/health
   
   Response:
   {
     "status": "ok",
     "mfa_enabled": true,
     "version": "2.0.0"
   }

3. Setup MFA for test user:
   $ curl -X POST http://localhost:5000/api/mfa/setup-totp \
     -H "Content-Type: application/json" \
     -d '{"user_id": "test-user", "email": "test@company.com"}'
   
   Response includes QR code + backup codes

4. Start frontend:
   $ cd frontend
   $ npm run dev
   
   Open http://localhost:3050 in browser

5. Test complete MFA flow in UI:
   - Go to Login
   - Enter credentials
   - If risk score > 40, MFA screen appears
   - Enter 6-digit code from test Authenticator
   - Login successful!
"""


"""
INTEGRATION CHECKLIST
======================

Backend:
[ ] requirements.txt updated (PyJWT, pyotp, qrcode, requests)
[ ] services/otp_manager.py created
[ ] services/anomaly_detector.py created
[ ] services/security_service.py updated
[ ] routes/mfa.py created with 11 endpoints
[ ] app/__init__.py registers mfa_bp blueprint
[ ] .env file configured with JWT_SECRET_KEY
[ ] Database tables created (SQL script provided)
[ ] Test endpoints respond correctly

Frontend:
[ ] components/TOTPVerification.tsx created
[ ] components/SecurityAlerts.tsx created
[ ] hooks/useMFA.ts created
[ ] Login component calls useMFA.setupTOTP()
[ ] Risk assessment integrated into login flow
[ ] Alerts displayed in Layout or Dashboard
[ ] Equipment exit detection integrated

Testing:
[ ] Create test user account
[ ] Setup TOTP and scan QR code
[ ] Attempt login from new location
[ ] Verify MFA is required
[ ] Test backup codes
[ ] Test equipment geofence
[ ] Verify alerts display
[ ] Check database tables have data
[ ] Review security logs

Security:
[ ] JWT_SECRET_KEY is strong (32+ chars)
[ ] Passwords hashed with bcrypt
[ ] TOTP codes expire after 30 seconds
[ ] Backup codes marked as used
[ ] Rate limiting not exceeded
[ ] Geofences cover required areas
[ ] Alerts are critical severity where appropriate
"""


"""
PRODUCTION DEPLOYMENT
======================

Before going live:

1. Security Audit
   - [ ] Change JWT_SECRET_KEY from default
   - [ ] Enable HTTPS/TLS 1.3+
   - [ ] Review geofence coordinates
   - [ ] Test rate limiting
   - [ ] Verify password policy

2. Database
   - [ ] Backup database before schema changes
   - [ ] Run SQL migration scripts
   - [ ] Create database indexes
   - [ ] Test disaster recovery

3. Monitoring
   - [ ] Setup logging (INFO, ERROR, CRITICAL)
   - [ ] Configure email alerts for CRITICAL events
   - [ ] Setup performance monitoring
   - [ ] Create dashboard for security metrics

4. Documentation
   - [ ] Train admins on MFA setup
   - [ ] Document geofence zones
   - [ ] Create runbook for incident response
   - [ ] Document backup/recovery procedures

5. Rollout
   - [ ] Soft launch to 10% users
   - [ ] Monitor for issues
   - [ ] Gradual rollout to 50%
   - [ ] Full rollout to 100%
   - [ ] Monitor post-launch metrics

Post-Launch:
   - [ ] Monitor failed MFA attempts
   - [ ] Review false positive alerts
   - [ ] Gather user feedback
   - [ ] Plan for biometric 3rd factor
   - [ ] Schedule security audit
"""
