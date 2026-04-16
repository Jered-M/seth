from app import create_app
from app.models.security_models import User
from app.services.security_service import SecurityService
from app.database import db

def reset_sa():
    app = create_app()
    with app.app_context():
        user = User.query.filter_by(email='superadmin@seth.com').first()
        if user:
            user.password_hash = SecurityService.hash_password('SuperSecret123!')
            user.mfa_enabled = False
            user.is_blocked = False
            user.failed_attempts = 0
            db.session.commit()
            print("✅ MOT DE PASSE REINITIALISE : superadmin@seth.com / SuperSecret123!")
        else:
            print("❌ Utilisateur superadmin non trouvé.")

if __name__ == "__main__":
    reset_sa()
