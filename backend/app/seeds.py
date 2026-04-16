from app.models.security_models import Role, RoleName, User, Department
from app.services.security_service import SecurityService
from app.database import db

def seed_data():
    # Roles
    roles = [
        {"name": RoleName.SUPER_ADMIN, "description": "Administrateur Général - Accès complet au système"},
        {"name": RoleName.DEPT_ADMIN, "description": "Administrateur de Département - Gère son département et rapports"},
        {"name": RoleName.SUPERVISOR, "description": "Superviseur - Surveille équipements et valide sorties"},
        {"name": RoleName.SECURITY_AGENT, "description": "Agent de Sécurité - Contrôle physique des sorties"},
        {"name": RoleName.USER, "description": "Utilisateur - Employé avec équipement assigné"}
    ]
    
    for r in roles:
        if not Role.query.filter_by(name=r["name"]).first():
            new_role = Role(name=r["name"], description=r["description"])
            db.session.add(new_role)
    
    db.session.commit()
    
    # Create Departments
    departments_data = [
        "Informatique",
        "Ressources Humaines",
        "Finance",
        "Marketing"
    ]
    
    dept_map = {}
    for dept_name in departments_data:
        existing = Department.query.filter_by(name=dept_name).first()
        if not existing:
            new_dept = Department(name=dept_name)
            db.session.add(new_dept)
        dept_map[dept_name] = Department.query.filter_by(name=dept_name).first()
    
    db.session.commit()
    
    # Super Admin
    if not User.query.filter_by(email="superadmin@seth.com").first():
        sa_role = Role.query.filter_by(name=RoleName.SUPER_ADMIN).first()
        super_admin = User(
            username="superadmin",
            email="superadmin@seth.com",
            password_hash=SecurityService.hash_password("SuperSecret123!"),
            role_id=sa_role.id,
            mfa_enabled=False # Disable for first login
        )
        db.session.add(super_admin)
        db.session.commit()
        print("✅ Super Admin créé: superadmin@seth.com / SuperSecret123!")
    else:
        print("✅ Super Admin déjà existant.")
    
    # Department Admin (Informatique)
    if not User.query.filter_by(email="admin-it@seth.com").first():
        dept_admin_role = Role.query.filter_by(name=RoleName.DEPT_ADMIN).first()
        it_dept = Department.query.filter_by(name="Informatique").first()
        dept_admin = User(
            username="admin_it",
            email="admin-it@seth.com",
            password_hash=SecurityService.hash_password("AdminIT123!"),
            role_id=dept_admin_role.id,
            department_id=it_dept.id if it_dept else None,
            mfa_enabled=False
        )
        db.session.add(dept_admin)
        db.session.commit()
        print("✅ Admin Département créé: admin-it@seth.com / AdminIT123! (Informatique)")
    else:
        print("✅ Admin Département déjà existant.")

    # Department Admin test account requested by user
    if not User.query.filter_by(email="dept_admin@test.com").first():
        dept_admin_role = Role.query.filter_by(name=RoleName.DEPT_ADMIN).first()
        marketing_dept = Department.query.filter_by(name="Marketing").first()
        dept_admin_test = User(
            username="dept_admin_test",
            email="dept_admin@test.com",
            password_hash=SecurityService.hash_password("Test1234!"),
            role_id=dept_admin_role.id,
            department_id=marketing_dept.id if marketing_dept else None,
            mfa_enabled=False,
            is_blocked=False,
        )
        db.session.add(dept_admin_test)
        db.session.commit()
        print("✅ Compte test créé: dept_admin@test.com / Test1234! (Marketing)")
    else:
        print("✅ Compte test dept_admin déjà existant.")
    
    # Regular User in Informatique Department
    if not User.query.filter_by(email="user@seth.com").first():
        user_role = Role.query.filter_by(name=RoleName.USER).first()
        it_dept = Department.query.filter_by(name="Informatique").first()
        user = User(
            username="user",
            email="user@seth.com",
            password_hash=SecurityService.hash_password("User123!"),
            role_id=user_role.id,
            department_id=it_dept.id if it_dept else None,
            mfa_enabled=False
        )
        db.session.add(user)
        db.session.commit()
        print("✅ Utilisateur régulier créé: user@seth.com / User123! (Informatique)")
