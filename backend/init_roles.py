from app import create_app
from app.models.security_models import Role, RoleName
from app.database import db

app = create_app()
with app.app_context():
    roles = [
        ('ADMIN_GENERAL', 'Administrateur Général'),
        ('ADMIN_DEPT', 'Administrateur de Département'),
        ('SUPERVISOR', 'Superviseur'),
        ('SECURITY_AGENT', 'Agent de Sécurité'),
        ('USER', 'Utilisateur'),
    ]
    
    for name, desc in roles:
        if not Role.query.filter_by(name=name).first():
            db.session.add(Role(name=name, description=desc))
            print(f' Créé: {name}')
        else:
            print(f' Existe: {name}')
    
    db.session.commit()
    print('Rôles OK')
