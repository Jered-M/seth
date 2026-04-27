"""
Routes pour la gestion des administrateurs et utilisateurs
Fournit les endpoints CRUD pour les administrateurs avec authentification
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from datetime import datetime
from app.models.security_models import User, Role, RoleName, Department
from app.database import db
from app.services.security_service import SecurityService
import traceback
import os

admin_management_bp = Blueprint('admin_management', __name__, url_prefix='/api/admin')


@admin_management_bp.route('/departments', methods=['GET'])
@require_super_admin
def get_department_admins():
    """Récupère la liste complète des administrateurs par département"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Récupérer tous les administrateurs de département
        cursor.execute("""
            SELECT 
                u.id,
                u.name,
                u.email,
                u.role,
                u.status,
                CASE 
                    WHEN u.lastLogin IS NULL THEN 'Jamais'
                    WHEN DATE(u.lastLogin) = CURDATE() THEN CONCAT('Aujourd\'hui ', TIME_FORMAT(u.lastLogin, '%H:%i'))
                    WHEN DATE(u.lastLogin) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN CONCAT('Hier ', TIME_FORMAT(u.lastLogin, '%H:%i'))
                    ELSE DATE_FORMAT(u.lastLogin, '%d/%m/%Y')
                END as lastLogin,
                d.name as department,
                d.id as departmentId
            FROM User u
            LEFT JOIN Department d ON u.departmentId = d.id
            WHERE u.role = 'ADMIN'
            ORDER BY d.name, u.name
        """)
        
        admins = cursor.fetchall()
        cursor.close()
        connection.close()
        
        # Formater les réponses
        result = []
        for admin in admins:
            result.append({
                'id': str(admin['id']),
                'name': admin['name'],
                'email': admin['email'],
                'department': admin['department'] or 'Non assigné',
                'role': admin['role'],
                'status': 'active' if admin['status'] == 'active' else 'inactive',
                'lastLogin': admin['lastLogin']
            })
        
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_management_bp.route('/departments/<int:admin_id>', methods=['GET'])
@require_super_admin
def get_department_admin(admin_id):
    """Récupère les détails d'un administrateur spécifique"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT 
                u.id,
                u.name,
                u.email,
                u.role,
                u.status,
                u.createdAt,
                u.lastLogin,
                d.name as department,
                d.id as departmentId
            FROM User u
            LEFT JOIN Department d ON u.departmentId = d.id
            WHERE u.id = %s AND u.role = 'ADMIN'
        """, (admin_id,))
        
        admin = cursor.fetchone()
        cursor.close()
        connection.close()
        
        if not admin:
            return jsonify({'error': 'Administrateur non trouvé'}), 404
        
        return jsonify({
            'id': str(admin['id']),
            'name': admin['name'],
            'email': admin['email'],
            'department': admin['department'] or 'Non assigné',
            'role': admin['role'],
            'status': 'active' if admin['status'] == 'active' else 'inactive',
            'lastLogin': admin['lastLogin'].isoformat() if admin['lastLogin'] else None,
            'createdAt': admin['createdAt'].isoformat() if admin['createdAt'] else None
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_management_bp.route('/departments/<int:admin_id>/status', methods=['PUT'])
@require_super_admin
def update_admin_status(admin_id):
    """Met à jour le statut d'un administrateur"""
    try:
        data = request.get_json()
        new_status = data.get('status', '').lower()
        
        if new_status not in ['active', 'inactive']:
            return jsonify({'error': 'Statut invalide'}), 400
        
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Vérifier que l'admin existe
        cursor.execute("""
            SELECT id FROM User WHERE id = %s AND role = 'ADMIN'
        """, (admin_id,))
        
        if not cursor.fetchone():
            cursor.close()
            connection.close()
            return jsonify({'error': 'Administrateur non trouvé'}), 404
        
        # Mettre à jour le statut
        cursor.execute("""
            UPDATE User SET status = %s, updatedAt = NOW()
            WHERE id = %s
        """, (new_status, admin_id))
        
        connection.commit()
        cursor.close()
        connection.close()
        
        return jsonify({
            'message': 'Statut mis à jour avec succès',
            'id': str(admin_id),
            'status': new_status
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_management_bp.route('/departments', methods=['POST'])
@require_super_admin
def create_department_admin():
    """Crée un nouvel administrateur de département"""
    try:
        data = request.get_json()
        
        required_fields = ['name', 'email', 'departmentId']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Champs manquants'}), 400
        
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Vérifier que l'email n'existe pas
        cursor.execute("SELECT id FROM User WHERE email = %s", (data['email'],))
        if cursor.fetchone():
            cursor.close()
            connection.close()
            return jsonify({'error': 'Email déjà utilisé'}), 409
        
        # Vérifier que le département existe
        cursor.execute("SELECT id FROM Department WHERE id = %s", (data['departmentId'],))
        if not cursor.fetchone():
            cursor.close()
            connection.close()
            return jsonify({'error': 'Département non trouvé'}), 404
        
        # Créer l'admin
        password_hash = 'default_password_hash'  # À implémenter avec bcrypt
        cursor.execute("""
            INSERT INTO User (name, email, passwordHash, role, departmentId, status)
            VALUES (%s, %s, %s, 'ADMIN', %s, 'active')
        """, (data['name'], data['email'], password_hash, data['departmentId']))
        
        connection.commit()
        admin_id = cursor.lastrowid
        cursor.close()
        connection.close()
        
        return jsonify({
            'message': 'Administrateur créé avec succès',
            'id': str(admin_id)
        }), 201
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_management_bp.route('/departments/<int:admin_id>', methods=['PUT'])
@require_super_admin
def update_department_admin(admin_id):
    """Met à jour les informations d'un administrateur"""
    try:
        data = request.get_json()
        
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Vérifier que l'admin existe
        cursor.execute("SELECT id FROM User WHERE id = %s AND role = 'ADMIN'", (admin_id,))
        if not cursor.fetchone():
            cursor.close()
            connection.close()
            return jsonify({'error': 'Administrateur non trouvé'}), 404
        
        # Préparer les champs à mettre à jour
        updates = []
        params = []
        
        if 'name' in data:
            updates.append('name = %s')
            params.append(data['name'])
        
        if 'email' in data:
            updates.append('email = %s')
            params.append(data['email'])
        
        if 'departmentId' in data:
            updates.append('departmentId = %s')
            params.append(data['departmentId'])
        
        if updates:
            query = "UPDATE User SET " + ", ".join(updates) + ", updatedAt = NOW() WHERE id = %s"
            params.append(admin_id)
            cursor.execute(query, params)
            connection.commit()
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'message': 'Administrateur mis à jour avec succès',
            'id': str(admin_id)
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_management_bp.route('/departments/<int:admin_id>', methods=['DELETE'])
@require_super_admin
def delete_department_admin(admin_id):
    """Supprime un administrateur"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Vérifier que l'admin existe
        cursor.execute("SELECT id FROM User WHERE id = %s AND role = 'ADMIN'", (admin_id,))
        if not cursor.fetchone():
            cursor.close()
            connection.close()
            return jsonify({'error': 'Administrateur non trouvé'}), 404
        
        # Supprimer l'admin
        cursor.execute("DELETE FROM User WHERE id = %s", (admin_id,))
        connection.commit()
        cursor.close()
        connection.close()
        
        return jsonify({
            'message': 'Administrateur supprimé avec succès',
            'id': str(admin_id)
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_management_bp.route('/users', methods=['POST'])
@jwt_required()
def create_user():
    """Crée un nouvel utilisateur (USER ou SUPERVISOR)"""
    try:
        claims = get_jwt()
        user_id = get_jwt_identity()
        
        # Vérifier que c'est un super-admin
        current_user = User.query.get(user_id)
        if not current_user or current_user.role.name not in [RoleName.ADMIN_GENERAL, RoleName.ADMIN_DEPT]:
            return jsonify({'error': 'Accès non autorisé'}), 403
        
        data = request.get_json()
        
        required_fields = ['email', 'password', 'role']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Champs manquants: email, password, role requis'}), 400
        
        # Valider le rôle
        valid_roles = ['USER', 'SUPERVISOR', 'DEPT_ADMIN']
        if data['role'] not in valid_roles:
            return jsonify({'error': f'Rôle invalide. Utilisez {", ".join(valid_roles)}'}), 400
        
        # Vérifier que l'email n'existe pas
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email déjà utilisé'}), 409
        
        # Déterminer le nom d'utilisateur
        username = data.get('name') or data.get('username') or data['email'].split('@')[0]
        if User.query.filter_by(username=username).first():
            # Si le nom existe, ajouter un suffixe
            username = f"{username}_{datetime.utcnow().timestamp()}"
        
        # Obtenir le rôle
        role_name = RoleName.USER if data['role'] == 'USER' else RoleName.SUPERVISOR if data['role'] == 'SUPERVISOR' else RoleName.ADMIN_DEPT
        role = Role.query.filter_by(name=role_name).first()
        if not role:
            return jsonify({'error': f'Rôle {role_name} non trouvé'}), 500
        
        # Obtenir le département si fourni
        department_id = data.get('department_id') or data.get('departmentId')
        department = None
        if department_id:
            department = Department.query.get(department_id)
            if not department:
                return jsonify({'error': 'Département non trouvé'}), 404
        
        # Créer l'utilisateur
        new_user = User(
            username=username,
            email=data['email'],
            password_hash=SecurityService.hash_password(data['password']),
            role_id=role.id,
            department_id=department_id if department else None
        )
        
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({
            'message': 'Utilisateur créé avec succès',
            'id': str(new_user.id),
            'email': new_user.email,
            'role': data['role']
        }), 201
    
    except Exception as e:
        db.session.rollback()
        print(f"Error creating user: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500


@admin_management_bp.route('/users', methods=['GET'])
@require_super_admin
def get_all_users():
    """Récupère la liste complète de tous les utilisateurs"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Récupérer tous les utilisateurs avec leurs informations
        cursor.execute("""
            SELECT 
                u.id,
                u.name,
                u.email,
                u.role,
                u.status,
                u.createdAt,
                CASE 
                    WHEN u.lastLogin IS NULL THEN 'Jamais'
                    WHEN DATE(u.lastLogin) = CURDATE() THEN CONCAT('Aujourd\'hui ', TIME_FORMAT(u.lastLogin, '%H:%i'))
                    WHEN DATE(u.lastLogin) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN CONCAT('Hier ', TIME_FORMAT(u.lastLogin, '%H:%i'))
                    ELSE DATE_FORMAT(u.lastLogin, '%d/%m/%Y')
                END as lastSeen,
                d.name as department
            FROM User u
            LEFT JOIN Department d ON u.departmentId = d.id
            ORDER BY u.createdAt DESC
        """)
        
        users = cursor.fetchall()
        cursor.close()
        connection.close()
        
        # Formater les réponses
        result = []
        for user in users:
            result.append({
                'id': str(user['id']),
                'name': user['name'],
                'email': user['email'],
                'role': user['role'],
                'status': user['status'],
                'department': user['department'] or 'Non assigné',
                'lastSeen': user['lastSeen'],
                'createdAt': user['createdAt'].isoformat() if user['createdAt'] else None
            })
        
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_management_bp.route('/users/<int:user_id>', methods=['GET'])
@require_super_admin
def get_user(user_id):
    """Récupère les détails d'un utilisateur spécifique"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT 
                u.id,
                u.name,
                u.email,
                u.role,
                u.status,
                u.createdAt,
                u.lastLogin,
                d.name as department
            FROM User u
            LEFT JOIN Department d ON u.departmentId = d.id
            WHERE u.id = %s
        """, (user_id,))
        
        user = cursor.fetchone()
        cursor.close()
        connection.close()
        
        if not user:
            return jsonify({'error': 'Utilisateur non trouvé'}), 404
        
        return jsonify({
            'id': str(user['id']),
            'name': user['name'],
            'email': user['email'],
            'role': user['role'],
            'status': user['status'],
            'department': user['department'] or 'Non assigné',
            'lastLogin': user['lastLogin'].isoformat() if user['lastLogin'] else None,
            'createdAt': user['createdAt'].isoformat() if user['createdAt'] else None
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_management_bp.route('/users/<int:user_id>/role', methods=['PUT'])
@require_super_admin
def update_user_role(user_id):
    """Met à jour le rôle d'un utilisateur"""
    try:
        data = request.get_json()
        new_role = data.get('role', '').upper()
        
        valid_roles = ['USER', 'ADMIN', 'SUPER_ADMIN', 'DEPARTMENT_ADMIN']
        if new_role not in valid_roles:
            return jsonify({'error': f'Rôle invalide. Rôles valides: {", ".join(valid_roles)}'}), 400
        
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Vérifier que l'utilisateur existe
        cursor.execute("SELECT id FROM User WHERE id = %s", (user_id,))
        if not cursor.fetchone():
            cursor.close()
            connection.close()
            return jsonify({'error': 'Utilisateur non trouvé'}), 404
        
        # Mettre à jour le rôle
        cursor.execute("""
            UPDATE User SET role = %s, updatedAt = NOW()
            WHERE id = %s
        """, (new_role, user_id))
        
        connection.commit()
        cursor.close()
        connection.close()
        
        return jsonify({
            'message': 'Rôle mis à jour avec succès',
            'id': str(user_id),
            'role': new_role
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_management_bp.route('/users/<int:user_id>', methods=['DELETE'])
@require_super_admin
def delete_user(user_id):
    """Supprime un utilisateur"""
    try:
        # Vérifier qu'on ne supprime pas le dernier super-admin
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        cursor.execute("SELECT role FROM User WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            cursor.close()
            connection.close()
            return jsonify({'error': 'Utilisateur non trouvé'}), 404
        
        if user['role'] == 'SUPER_ADMIN':
            cursor.execute("SELECT COUNT(*) as count FROM User WHERE role = 'SUPER_ADMIN'")
            result = cursor.fetchone()
            if result['count'] <= 1:
                cursor.close()
                connection.close()
                return jsonify({'error': 'Impossible de supprimer le dernier super-administrateur'}), 400
        
        # Supprimer l'utilisateur
        cursor.execute("DELETE FROM User WHERE id = %s", (user_id,))
        connection.commit()
        cursor.close()
        connection.close()
        
        return jsonify({
            'message': 'Utilisateur supprimé avec succès',
            'id': str(user_id)
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
