import os
import sys
# Ajouter le dossier backend au path pour importer l'app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.database import db
from app.models.security_models import User, Role, RoleName
from app.services.security_service import SecurityService

def force_reset_admin():
    app = create_app()
    with app.app_context():
        print("🔍 Vérification des rôles...")
        sa_role = Role.query.filter_by(name=RoleName.SUPER_ADMIN).first()
        if not sa_role:
            print("⚠️ Rôle SUPER_ADMIN manquant. Création...")
            sa_role = Role(name=RoleName.SUPER_ADMIN, description="Administrateur Général")
            db.session.add(sa_role)
            db.session.commit()

        email = "superadmin@seth.com"
        password = "AdminPassword123!"
        
        user = User.query.filter_by(email=email).first()
        if user:
            print(f"🔄 Mise à jour du mot de passe pour {email}...")
            user.password_hash = SecurityService.hash_password(password)
            user.mfa_enabled = False
            user.is_blocked = False
        else:
            print(f"✨ Création du compte {email}...")
            user = User(
                username="superadmin",
                email=email,
                password_hash=SecurityService.hash_password(password),
                role_id=sa_role.id,
                mfa_enabled=False
            )
            db.session.add(user)
        
        db.session.commit()
        print(f"✅ Succès ! Connectez-vous avec :")
        print(f"📧 Email : {email}")
        print(f"🔑 Password : {password}")

if __name__ == "__main__":
    force_reset_admin()
