"""Réinitialise mots de passe + débloque tous les comptes seed."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.models.security_models import User, Role
from app.services.security_service import SecurityService
from app.database import db
from app.seeds import SEED_ACCOUNT_EMAILS

SEED_PASSWORDS = {
    "superadmin@seth.com": "SuperSecret123!",
    "admin-it@seth.com": "AdminIT123!",
    "dept_admin@test.com": "Test1234!",
    "user@seth.com": "User123!",
    "security@seth.com": "Security123!",
}


def main():
    app = create_app()
    with app.app_context():
        for email in SEED_ACCOUNT_EMAILS:
            user = User.query.filter_by(email=email).first()
            pwd = SEED_PASSWORDS.get(email, "")
            if not user:
                print(f"MISSING  {email}")
                continue
            user.password_hash = SecurityService.hash_password(pwd)
            user.is_blocked = False
            user.failed_attempts = 0
            user.mfa_enabled = False
            role_ok = user.role.name if user.role else "NO_ROLE"
            verify = SecurityService.verify_password(pwd, user.password_hash)
            db.session.commit()
            print(f"OK       {email} | role={role_ok} | verify={verify}")
        print("Done — tous les comptes seed réinitialisés.")


if __name__ == "__main__":
    main()
