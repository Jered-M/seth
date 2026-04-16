
from app import create_app
from app.models.security_models import Role, User

app = create_app()
with app.app_context():
    roles = Role.query.all()
    print("Roles in DB:")
    for r in roles:
        print(f"- {r.name}")
    
    users = User.query.all()
    print("\nUsers in DB:")
    for u in users:
        print(f"- {u.username} ({u.email}) - Role: {u.role.name if u.role else 'None'} - Dept: {u.department_id}")
