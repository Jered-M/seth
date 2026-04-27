"""
Routes pour les statistiques du dashboard
Fournit les données pour les activités récentes et la répartition par département
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from app.models.security_models import Device, Department, User
from app.database import get_db_connection
from functools import wraps
import jwt
import os

dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/api/dashboard')

# Décorateur pour vérifier l'authentification
def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization', '')
        
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
        
        if not token:
            return jsonify({'error': 'Token manquant'}), 401
        
        try:
            secret_key = os.getenv('JWT_SECRET_KEY', 'your-secret-key')
            data = jwt.decode(token, secret_key, algorithms=['HS256'])
            request.user_id = data.get('userId')
            return f(*args, **kwargs)
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expiré'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Token invalide'}), 401
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    return decorated_function


@dashboard_bp.route('/recent-activities', methods=['GET'])
@require_auth
def get_recent_activities():
    """Récupère les activités récentes des équipements"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Récupérer les activités récentes (logs de sécurité)
        cursor.execute("""
            SELECT 
                sl.id,
                sl.user_id,
                sl.action,
                sl.details,
                sl.ip_address,
                sl.created_at,
                u.username as user,
                d.serial_number as equipment_id
            FROM security_logs sl
            LEFT JOIN users u ON sl.user_id = u.id
            LEFT JOIN devices d ON sl.details LIKE CONCAT('%', d.id, '%')
            ORDER BY sl.created_at DESC
            LIMIT 10
        """)
        
        activities = cursor.fetchall()
        cursor.close()
        connection.close()
        
        result = []
        for activity in activities:
            if activity is None:
                continue
            # Format time relative
            import datetime
            log_time = activity.get('created_at')
            if not log_time:
                log_time = datetime.datetime.now()
            now = datetime.datetime.now()
            diff = (now - log_time).total_seconds()
            
            if diff < 60:
                time_str = 'À l\'instant'
            elif diff < 3600:
                time_str = f"{int(diff/60)} min"
            elif diff < 86400:
                time_str = f"{int(diff/3600)}h"
            else:
                time_str = log_time.strftime('%d/%m/%Y')
            
            action_type = 'ASSIGNED' if 'assign' in str(activity.get('action', '')).lower() else 'AVAILABLE'
            
            result.append({
                'id': str(activity.get('id', '')),
                'item': activity.get('equipment_id') or 'Système',
                'user': (activity.get('user') or 'Système').upper(),
                'time': time_str,
                'type': action_type,
                'details': activity.get('details', '')
            })
        
        return jsonify(result), 200
    
    except Exception as e:
        print(f"Error in get_recent_activities: {str(e)}")
        return jsonify({'error': str(e)}), 500


@dashboard_bp.route('/department-distribution', methods=['GET'])
@require_auth
def get_department_distribution():
    """Récupère la répartition des équipements par département"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Récupérer le nombre d'équipements par département
        cursor.execute("""
            SELECT 
                d.name as department,
                COUNT(e.id) as count,
                ROUND((COUNT(e.id) / NULLIF((SELECT COUNT(*) FROM devices), 0) * 100), 0) as percentage
            FROM departments d
            LEFT JOIN devices e ON d.id = e.department_id
            GROUP BY d.id, d.name
            ORDER BY count DESC
        """)
        
        departments = cursor.fetchall()
        cursor.close()
        connection.close()
        
        result = []
        for dept in departments:
            if dept is None:
                continue
            result.append({
                'name': dept.get('department') or 'Non assigné',
                'count': dept.get('count', 0) or 0,
                'percentage': dept.get('percentage', 0) or 0
            })
        
        return jsonify(result), 200
    
    except Exception as e:
        print(f"Error in get_department_distribution: {str(e)}")
        return jsonify({'error': str(e)}), 500


@dashboard_bp.route('/stats', methods=['GET'])
@require_auth
def get_dashboard_stats():
    """Récupère les statistiques globales du dashboard"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Statistiques globales
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) as available,
                SUM(CASE WHEN status = 'ASSIGNED' THEN 1 ELSE 0 END) as busy,
                SUM(CASE WHEN status = 'MAINTENANCE' THEN 1 ELSE 0 END) as maintenance
            FROM devices
        """)
        
        stats = cursor.fetchone()
        
        # Nombre d'utilisateurs actifs
        cursor.execute("""
            SELECT COUNT(*) as activeUsers
            FROM users
            WHERE is_blocked = false
        """)
        
        users = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'total': stats.get('total') or 0 if stats else 0,
            'available': stats.get('available') or 0 if stats else 0,
            'busy': stats.get('busy') or 0 if stats else 0,
            'maintenance': stats.get('maintenance') or 0 if stats else 0,
            'activeUsers': users.get('activeUsers') or 0 if users else 0
        }), 200
    
    except Exception as e:
        print(f"Error in get_dashboard_stats: {str(e)}")
        return jsonify({'error': str(e)}), 500
