"""Données et fonctions de seed pour SetH.

- seed_data()              → seed complet (rôles, départements, comptes, devices)
- sync_seed_accounts_for_dev() → sync rapide au démarrage (run.py / create_app)
- SEED_ACCOUNT_EMAILS / SEED_PASSWORDS → constantes partagées (auth, scripts)

Ne pas lancer ce fichier directement (ModuleNotFoundError: app).
Utiliser : python seed.py   (depuis le dossier backend/)
"""
from app.models.security_models import Role, RoleName, User, Department, AuthorizedZone, SecurityAlert, SecurityIncident, Device
from app.services.security_service import SecurityService
from app.database import db
import json

SEED_ACCOUNT_EMAILS = (
    "superadmin@seth.com",
    "admin-it@seth.com",
    "dept_admin@test.com",
    "user@seth.com",
    "security@seth.com",
)

SEED_PASSWORDS = {
    "superadmin@seth.com": "SuperSecret123!",
    "admin-it@seth.com": "AdminIT123!",
    "dept_admin@test.com": "Test1234!",
    "user@seth.com": "User123!",
    "security@seth.com": "Security123!",
}


def ensure_seed_accounts_unlocked() -> int:
    """Réactive les comptes seed — sans réécrire le hash à chaque démarrage (évite l'instabilité Supabase)."""
    fixed = 0
    for email in SEED_ACCOUNT_EMAILS:
        account = User.query.filter_by(email=email).first()
        if not account:
            continue
        changed = False
        if account.is_blocked or account.failed_attempts or account.mfa_enabled:
            account.is_blocked = False
            account.failed_attempts = 0
            account.mfa_enabled = False
            changed = True
        if changed:
            fixed += 1
    if fixed:
        db.session.commit()
    return fixed


def sync_seed_accounts_for_dev() -> None:
    """Crée l'agent sécurité si absent + resynchronise tous les mots de passe seed."""
    if not User.query.filter_by(email="security@seth.com").first():
        agent_role = Role.query.filter_by(name=RoleName.SECURITY_AGENT).first()
        it_dept = Department.query.filter_by(name="Informatique").first()
        if agent_role:
            db.session.add(
                User(
                    username="agent_securite",
                    email="security@seth.com",
                    password_hash=SecurityService.hash_password(SEED_PASSWORDS["security@seth.com"]),
                    role_id=agent_role.id,
                    department_id=it_dept.id if it_dept else None,
                    mfa_enabled=False,
                    is_blocked=False,
                )
            )
            print("✅ Agent sécurité créé: security@seth.com / Security123!")

    for email in SEED_ACCOUNT_EMAILS:
        account = User.query.filter_by(email=email).first()
        pwd = SEED_PASSWORDS.get(email)
        if not account or not pwd:
            continue
        account.password_hash = SecurityService.hash_password(pwd)
        account.is_blocked = False
        account.failed_attempts = 0
        account.mfa_enabled = False
        if account.role_id is None and email == "security@seth.com":
            agent_role = Role.query.filter_by(name=RoleName.SECURITY_AGENT).first()
            if agent_role:
                account.role_id = agent_role.id

    db.session.commit()


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
    else:
        print("✅ Utilisateur régulier déjà existant: user@seth.com")

    # Agent de sécurité (poste de contrôle sorties matériel)
    if not User.query.filter_by(email="security@seth.com").first():
        agent_role = Role.query.filter_by(name=RoleName.SECURITY_AGENT).first()
        it_dept = Department.query.filter_by(name="Informatique").first()
        if not agent_role:
            print("⚠️  Rôle SECURITY_AGENT absent — création agent sécurité impossible")
        else:
            agent = User(
                username="agent_securite",
                email="security@seth.com",
                password_hash=SecurityService.hash_password("Security123!"),
                role_id=agent_role.id,
                department_id=it_dept.id if it_dept else None,
                mfa_enabled=False,
                is_blocked=False,
            )
            db.session.add(agent)
            db.session.commit()
            print("✅ Agent sécurité créé: security@seth.com / Security123!")
    else:
        print("✅ Agent sécurité déjà existant: security@seth.com / Security123!")

    # TEST DEVICES WITHOUT HARDCODED GPS - FOR REAL TRACKING
    print("\n🌍 Seeding real Devices per department...")
    from app.models.security_models import Device
    import uuid

    devices_data = {
        "Informatique": [
            {"name": "Laptop Dev1", "serial": "EQ-IT-LAPTOP-001", "status": "ASSIGNED"},
            {"name": "Server Node1", "serial": "EQ-IT-SRV-001", "status": "IN_USE"},
            {"name": "Tablet Admin", "serial": "EQ-IT-TAB-001", "status": "AVAILABLE"},
        ],
        "Ressources Humaines": [
            {"name": "HR Laptop", "serial": "EQ-HR-LAPTOP-001", "status": "AVAILABLE"},
            {"name": "HR Tablet", "serial": "EQ-HR-TAB-001", "status": "IN_USE"},
        ],
        "Finance": [
            {"name": "Finance Workstation", "serial": "EQ-FIN-WS-001", "status": "AVAILABLE"},
            {"name": "Finance Laptop", "serial": "EQ-FIN-LAPTOP-001", "status": "MAINTENANCE"},
        ],
        "Marketing": [
            {"name": "Marketing iPad", "serial": "EQ-MKT-IPAD-001", "status": "AVAILABLE"},
            {"name": "Marketing Laptop", "serial": "EQ-MKT-LAPTOP-001", "status": "IN_USE"},
        ]
    }

    created_count = 0
    super_admin_user = User.query.filter_by(username="superadmin").first()
    
    for dept_name, devices in devices_data.items():
        dept = dept_map.get(dept_name)
        if not dept:
            print(f"⚠️  Département {dept_name} manquant, skip devices")
            continue

        for dev_data in devices:
            serial = dev_data["serial"]
            existing_device = Device.query.filter_by(serial_number=serial).first()
            
            if existing_device:
                # Update existing device to remove fake GPS
                existing_device.last_known_lat = None
                existing_device.last_known_lng = None
                if serial == "EQ-IT-LAPTOP-001" and super_admin_user:
                    existing_device.user_id = super_admin_user.id
                    existing_device.status = "ASSIGNED"
                print(f"✅ Device {serial} réinitialisé pour tracking réel")
                continue

            device = Device(
                id=str(uuid.uuid4()),
                name=dev_data["name"],
                serial_number=serial,
                department_id=dept.id,
                status=dev_data["status"],
                last_known_lat=None,
                last_known_lng=None,
                user_id=super_admin_user.id if serial == "EQ-IT-LAPTOP-001" and super_admin_user else None
            )
            db.session.add(device)
            created_count += 1

    db.session.commit()
    print(f"✅ {created_count} test GPS devices seeded across departments!")

    print("\n🌍 Seeding Geofencing zones & Simulations...")
    # 1. Périmètre du Bâtiment (Global - Pas de département assigné)
    building_zone = AuthorizedZone.query.filter_by(name="Périmètre du Bâtiment").first()
    if not building_zone:
        building_zone = AuthorizedZone(
            name="Périmètre du Bâtiment",
            center_lat=-11.676486,
            center_lng=27.48082, # Admin general base location
            radius_meters=500.0,
            department_id=None,
            polygon_points=json.dumps([[-11.672, 27.475], [-11.672, 27.485], [-11.680, 27.485], [-11.680, 27.475]])
        )
        db.session.add(building_zone)

    # 2. Périmètre du Département (Informatique)
    dept_zone = AuthorizedZone.query.filter_by(name="Délimitation Département IT").first()
    it_dept = dept_map.get("Informatique")
    if not dept_zone and it_dept:
        dept_zone = AuthorizedZone(
            name="Délimitation Département IT",
            center_lat=-11.676000, 
            center_lng=27.48000, # Admin de departement base location (start point)
            radius_meters=150.0,
            department_id=it_dept.id,
            polygon_points=json.dumps([[-11.675, 27.479], [-11.675, 27.481], [-11.677, 27.481], [-11.677, 27.479]])
        )
        db.session.add(dept_zone)
    db.session.commit()
    
    # 3. Simulations des 3 cas
    # 3.1: Agent dans le périmètre du département, mais pas au bureau (aux alentours)
    sim1_serial = "EQ-SIM1-DEPT-AROUND"
    sim1 = Device.query.filter_by(serial_number=sim1_serial).first()
    if not sim1 and it_dept:
        sim1 = Device(
            id=str(uuid.uuid4()),
            name="Agent Alentours Dept",
            serial_number=sim1_serial,
            department_id=it_dept.id,
            status="ASSIGNED",
            last_known_lat=-11.676200, # Dans le cercle du dept, mais légèrement décalé
            last_known_lng=27.480500,
            last_known_accuracy=15.0
        )
        db.session.add(sim1)
    
    # 3.2: Agent qui a désactivé sa localisation (Alerte direct à l'admin général)
    sim2_serial = "EQ-SIM2-GPS-OFF"
    sim2 = Device.query.filter_by(serial_number=sim2_serial).first()
    if not sim2 and it_dept:
        sim2 = Device(
            id=str(uuid.uuid4()),
            name="Agent GPS Désactivé",
            serial_number=sim2_serial,
            department_id=it_dept.id,
            status="ASSIGNED",
            last_known_lat=-11.676800,  # Dernière position connue avant désactivation
            last_known_lng=27.480200,
            last_known_accuracy=12.0,
        )
        db.session.add(sim2)
        db.session.flush()
        # Create alert for GPS Disabled that must be resolved by Admin General
        alert2 = SecurityAlert.query.filter_by(message=f"Localisation désactivée par {sim2_serial}").first()
        if not alert2:
            alert2 = SecurityAlert(
                user_id=super_admin_user.id if super_admin_user else None,
                department_id=it_dept.id,
                type="GPS_DISABLED",
                message=f"Localisation désactivée par {sim2_serial}",
                is_resolved=False
            )
            db.session.add(alert2)
            db.session.flush()
            incident = SecurityIncident(
                alert_id=alert2.id,
                department_id=it_dept.id,
                status="OPEN"
            )
            db.session.add(incident)

    # 3.3: Agent hors site
    sim3_serial = "EQ-SIM3-OFFSITE"
    sim3 = Device.query.filter_by(serial_number=sim3_serial).first()
    if not sim3 and it_dept:
        sim3 = Device(
            id=str(uuid.uuid4()),
            name="Agent Hors Site",
            serial_number=sim3_serial,
            department_id=it_dept.id,
            status="OUT_OF_ZONES",
            last_known_lat=-11.685000, # En dehors de la zone de 500m
            last_known_lng=27.490000,
            last_known_accuracy=10.0
        )
        db.session.add(sim3)
        db.session.flush()
        # Create alert for Unauthorized Exit
        alert3 = SecurityAlert.query.filter_by(message=f"L'équipement {sim3.id} a quitté la zone autorisée sans permission.").first()
        if not alert3:
            alert3 = SecurityAlert(
                user_id=super_admin_user.id if super_admin_user else None,
                department_id=it_dept.id,
                type="UNAUTHORIZED_EXIT",
                message=f"L'équipement {sim3.id} a quitté la zone autorisée sans permission.",
                is_resolved=False
            )
            db.session.add(alert3)
            db.session.flush()
            incident = SecurityIncident(
                alert_id=alert3.id,
                department_id=it_dept.id,
                status="OPEN"
            )
            db.session.add(incident)

    db.session.commit()
    print("✅ Geofencing and Simulations seeded!")

    ensure_seed_accounts_unlocked()
    sync_seed_accounts_for_dev()
    print("✅ Comptes seed débloqués et mots de passe synchronisés")
    _print_seed_accounts_summary()


def _print_seed_accounts_summary() -> None:
    """Récapitulatif visible de tous les comptes seed après seed/sync."""
    print("\n📋 Comptes seed disponibles :")
    for email in SEED_ACCOUNT_EMAILS:
        account = User.query.filter_by(email=email).first()
        pwd = SEED_PASSWORDS.get(email, "?")
        if not account:
            print(f"   ❌ {email} — ABSENT (relancer seed ou run.py)")
            continue
        role_name = account.role.name if account.role else "SANS_RÔLE"
        status = "bloqué" if account.is_blocked else "OK"
        print(f"   ✅ {email} / {pwd} — rôle={role_name} ({status})")

