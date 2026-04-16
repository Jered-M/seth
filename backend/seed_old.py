from app.database import execute_query, execute_one
import bcrypt
import uuid

def seed():
    # Create Departments
    departments = ["Informatique", "Ressources Humaines", "Comptabilité", "Logistique"]
    dep_ids = {}
    for dep_name in departments:
        existing = execute_one("SELECT id FROM Department WHERE name = %s", (dep_name,))
        if existing:
            dep_ids[dep_name] = existing['id']
        else:
            id = str(uuid.uuid4())
            execute_query("INSERT INTO Department (id, name) VALUES (%s, %s)", (id, dep_name), is_select=False)
            dep_ids[dep_name] = id

    # Create Super Admin User
    super_admin_email = "seth@admin.com"
    hashed_password = bcrypt.hashpw("1234567".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    if not execute_one("SELECT id FROM User WHERE email = %s", (super_admin_email,)):
        admin_id = str(uuid.uuid4())
        execute_query(
            "INSERT INTO User (id, email, password, name, role, createdAt, updatedAt) VALUES (%s, %s, %s, %s, %s, NOW(), NOW())",
            (admin_id, super_admin_email, hashed_password, "Super Administrateur SetH", "SUPER_ADMIN"),
            is_select=False
        )

    # Create some equipment types
    dep_it_id = dep_ids.get("Informatique")
    if dep_it_id:
        if not execute_one("SELECT id FROM Equipment WHERE serial_number = %s", ("IT-LP-001",)):
            eq_id = str(uuid.uuid4())
            execute_query(
                "INSERT INTO Equipment (id, serial_number, type, status, departmentId, location, createdAt, updatedAt) VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())",
                (eq_id, "IT-LP-001", "LAPTOP", "AVAILABLE", dep_it_id, "Bureau Tech 1"),
                is_select=False
            )

    print("Seeding completed successfully!")

if __name__ == "__main__":
    seed()
