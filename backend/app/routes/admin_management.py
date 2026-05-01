"""
Routes pour la gestion des administrateurs et utilisateurs
Entièrement refactorisé pour utiliser SQLAlchemy ORM au lieu de SQL brut.
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from datetime import datetime
from app.models.security_models import User, Role, RoleName, Department, SecurityLog
from app.database import db
from app.services.security_service import SecurityService
from app.middleware.rbac import super_admin_required
import traceback

admin_management_bp = Blueprint('admin_management', __name__, url_prefix='/api/admin')

@admin_management_bp.route('/departments', methods=['GET'])
@super_admin_required
def get_department_admins():
    """Récupère la liste complète des administrateurs par département"""
    try:
        # Récupérer les admins (rôle ADMIN_DEPT ou ADMIN)
        admins = User.query.join(Role).filter(Role.name == RoleName.DEPT_ADMIN).all()
        
        result = []
        for admin in admins:
            # Format last login
            last_login_str = "Jamais"
            if admin.created_at: # Utilisons created_at comme fallback ou une autre colonne si lastLogin n'existe pas
                # En réalité, on devrait chercher dans SecurityLog pour le dernier LOGIN
                last_log = SecurityLog.query.filter_by(user_id=admin.id, action="LOGIN", status="SUCCESS").order_by(SecurityLog.created_at.desc()).first()
                if last_log:
                    last_login_str = last_log.created_at.strftime('%d/%m/%Y %H:%i')

            result.append({
                'id': str(admin.id),
                'name': admin.username,
                'email': admin.email,
                'department': admin.department.name if admin.department else 'Non assigné',
                'role': admin.role.name if admin.role else 'USER',
                'status': 'inactive' if admin.is_blocked else 'active',
                'lastLogin': last_login_str
            })
        
        return jsonify(result), 200
    except Exception as e:
        print(f"Error in get_department_admins: {e}")
        return jsonify({'error': str(e)}), 500

@admin_management_bp.route('/departments/<string:admin_id>', methods=['GET'])
@super_admin_required
def get_department_admin(admin_id):
    """Récupère les détails d'un administrateur spécifique"""
    try:
        admin = User.query.get(admin_id)
        if not admin:
            return jsonify({'error': 'Administrateur non trouvé'}), 404
        
        return jsonify({
            'id': str(admin.id),
            'name': admin.username,
            'email': admin.email,
            'department': admin.department.name if admin.department else 'Non assigné',
            'role': admin.role.name if admin.role else 'USER',
            'status': 'inactive' if admin.is_blocked else 'active',
            'createdAt': admin.created_at.isoformat() if admin.created_at else None
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_management_bp.route('/departments/<string:admin_id>/status', methods=['PUT'])
@super_admin_required
def update_admin_status(admin_id):
    """Met à jour le statut d'un administrateur"""
    try:
        data = request.get_json()
        new_status = data.get('status', '').lower()
        
        admin = User.query.get(admin_id)
        if not admin:
            return jsonify({'error': 'Administrateur non trouvé'}), 404
        
        admin.is_blocked = (new_status == 'inactive')
        db.session.commit()
        
        # Audit Log
        SecurityService.log_event(
            get_jwt_identity(),
            "ADMIN_STATUS_UPDATE",
            f"Statut de l'admin {admin_id} changé en {new_status}",
            request.remote_addr,
            request.headers.get("User-Agent")
        )
        
        return jsonify({
            'message': 'Statut mis à jour avec succès',
            'id': str(admin_id),
            'status': new_status
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_management_bp.route('/departments', methods=['POST'])
@super_admin_required
def create_department_admin():
    """Crée un nouvel administrateur de département"""
    try:
        data = request.get_json()
        required_fields = ['name', 'email', 'departmentId']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Champs manquants'}), 400
        
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email déjà utilisé'}), 409
        
        role = Role.query.filter_by(name=RoleName.DEPT_ADMIN).first()
        
        new_admin = User(
            username=data['name'],
            email=data['email'],
            password_hash=SecurityService.hash_password("SetPassword123!"), # Password par défaut
            role_id=role.id,
            department_id=data['departmentId'],
            is_blocked=False
        )
        
        db.session.add(new_admin)
        db.session.commit()
        
        SecurityService.log_event(
            get_jwt_identity(),
            "ADMIN_CREATE",
            f"Création de l'administrateur {data['email']}",
            request.remote_addr,
            request.headers.get("User-Agent")
        )
        
        return jsonify({'message': 'Administrateur créé avec succès', 'id': str(new_admin.id)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_management_bp.route('/users', methods=['GET'])
@super_admin_required
def get_all_users():
    """Récupère la liste complète de tous les utilisateurs"""
    try:
        users = User.query.order_by(User.created_at.desc()).all()
        result = []
        for u in users:
            result.append({
                'id': str(u.id),
                'name': u.username,
                'email': u.email,
                'role': u.role.name if u.role else 'USER',
                'status': 'inactive' if u.is_blocked else 'active',
                'department': u.department.name if u.department else 'Non assigné',
                'createdAt': u.created_at.isoformat() if u.created_at else None
            })
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_management_bp.route('/users/<string:user_id>', methods=['DELETE'])
@super_admin_required
def delete_user(user_id):
    """Supprime un utilisateur"""
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'Utilisateur non trouvé'}), 404
            
        if user.role.name == RoleName.SUPER_ADMIN:
            count = User.query.join(Role).filter(Role.name == RoleName.SUPER_ADMIN).count()
            if count <= 1:
                return jsonify({'error': 'Impossible de supprimer le dernier super-administrateur'}), 400
        
        db.session.delete(user)
        db.session.commit()
        
        SecurityService.log_event(
            get_jwt_identity(),
            "USER_DELETE",
            f"Suppression de l'utilisateur {user_id}",
            request.remote_addr,
            request.headers.get("User-Agent")
        )
        
        return jsonify({'message': 'Utilisateur supprimé avec succès'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
