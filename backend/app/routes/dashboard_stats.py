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
                sl.userId,
                sl.action,
                sl.details,
                sl.ipAddress,
                sl.createdAt,
                u.name as user,
                e.serial_number as equipment_id
            FROM SecurityLog sl
            LEFT JOIN User u ON sl.userId = u.id
            LEFT JOIN devices e ON sl.details LIKE CONCAT('%', e.id, '%')
            ORDER BY sl.createdAt DESC
            LIMIT 10
        """)
        
        activities = cursor.fetchall()
        cursor.close()
        connection.close()
        
        result = []
        for activity in activities:
            # Format time relative
            import datetime
            log_time = activity['createdAt']
            now = datetime.datetime.now()
            diff = (now - log_time).total_seconds()
            
            if diff < 60:
                time_str = 'Just now'
            elif diff < 3600:
                time_str = f"{int(diff/60)} min ago"
            elif diff < 86400:
                time_str = f"{int(diff/3600)} hour ago"
            else:
                time_str = log_time.strftime('%d/%m/%Y')
            
            result.append({
                'id': str(activity['id']),
                'item': activity['equipment_id'] or 'Unknown',
                'user': activity['user'] or 'System',
                'time': time_str,
                'type': activity['action'],
                'details': activity['details']
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
            result.append({
                'name': dept['department'] or 'Non assigné',
                'count': dept['count'],
                'percentage': dept['percentage']
            })
        
        return jsonify(result), 200
    
    except Exception as e:
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
        
        # Nombre d'administrateurs actifs
        cursor.execute("""
            SELECT COUNT(*) as activeAdmins
            FROM users
            WHERE role_id IS NOT NULL AND is_blocked = false
        """)
        
        admins = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'total': stats['total'] or 0,
            'available': stats['available'] or 0,
            'busy': stats['busy'] or 0,
            'maintenance': stats['maintenance'] or 0,
            'activeAdmins': admins['activeAdmins'] or 0
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
