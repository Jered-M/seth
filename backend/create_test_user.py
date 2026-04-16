from app import create_app
from app.models.security_models import User, Role, RoleName
from app.services.security_service import SecurityService
from app.database import db

app = create_app()
with app.app_context():
    try:
        # First, let's check available departments
        from app.models.security_models import Department
        departments = Department.query.all()
        print(f'Départements disponibles: {len(departments)}')
        if departments:
            dept_id = departments[0].id
            print(f'Utilisation du département: {dept_id}')
        else:
            dept_id = None
            print('Aucun département trouvé, utilisation de NULL')
        
        role = Role.query.filter_by(name=RoleName.USER).first()
        print(f'Rôle USER trouvé: {role}')
        print(f'Role ID: {role.id if role else "NULL"}')
        
        user = User(
            username='testuser123',
            email='testuser@test.com',
            password_hash=SecurityService.hash_password('Test1234!'),
            role_id=role.id if role else None,
            department_id=dept_id,
            is_blocked=True
        )
        db.session.add(user)
        db.session.commit()
        print(' Utilisateur créé avec succès')
        print(f'User ID: {user.id}')
    except Exception as e:
        print(f' Erreur: {type(e).__name__}')
        print(f'Message: {str(e)}')
        db.session.rollback()
