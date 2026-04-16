

import sys
sys.path.insert(0, '/backend')

from app.database import execute_query, execute_one
import bcrypt
import uuid

def create_test_users():
    """Crée les utilisateurs de test pour la démonstration"""
    
    test_users = [
        {
            'email': 'admin1@admin.com',
            'password': '1111111',
            'name': 'Pierre Legrand',
            'role': 'ADMIN'
        },
        {
            'email': 'admin2@admin.com',
            'password': '2222222',
            'name': 'Sophie Martin',
            'role': 'ADMIN'
        },
        {
            'email': 'admin3@admin.com',
            'password': '3333333',
            'name': 'Jean Dubois',
            'role': 'ADMIN'
        },
        {
            'email': 'admin4@admin.com',
            'password': '4444444',
            'name': 'Marie Aubert',
            'role': 'ADMIN'
        },
        {
            'email': 'super@admin.com',
            'password': 'SuperAdmin123!',
            'name': 'SetH',
            'role': 'SUPER_ADMIN'
        },
        {
            'email': 'user1@user.com',
            'password': 'User123!',
            'name': 'Jean Dupont',
            'role': 'USER'
        }
    ]
    
    for user in test_users:
        # Check if user already exists
        existing_user = execute_one(
            "SELECT id FROM User WHERE email = %s",
            (user['email'],)
        )
        
        if existing_user:
            print(f"✓ User {user['email']} already exists")
            continue
        
        # Hash password
        hashed_password = bcrypt.hashpw(user['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Create user
        user_id = str(uuid.uuid4())
        
        try:
            execute_query(
                """INSERT INTO User (id, email, password, name, role, createdAt, updatedAt) 
                   VALUES (%s, %s, %s, %s, %s, NOW(), NOW())""",
                (user_id, user['email'], hashed_password, user['name'], user['role']),
                is_select=False
            )
            print(f"✓ Created user: {user['email']} (Password: {user['password']}) - Role: {user['role']}")
        except Exception as e:
            print(f"✗ Error creating user {user['email']}: {str(e)}")
    
    print("\n✅ Test users created successfully!")
    print("\n📋 Test Credentials:")
    print("=" * 50)
    for user in test_users:
        print(f"Email: {user['email']}")
        print(f"Password: {user['password']}")
        print(f"Role: {user['role']}")
        print("-" * 50)

if __name__ == "__main__":
    create_test_users()
