"""
Routes pour les statistiques du dashboard
Fournit les données pour les activités récentes et la répartition par département
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from datetime import datetime, timedelta
from app.models.security_models import Device, Department, User, SecurityLog
from app.database import db
from sqlalchemy import func
import traceback

dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/api/dashboard')


@dashboard_bp.route('/recent-activities', methods=['GET'])
@jwt_required()
def get_recent_activities():
    """Récupère les activités récentes des équipements"""
    try:
        # Récupérer les logs de sécurité les plus récents
        logs = SecurityLog.query.order_by(SecurityLog.created_at.desc()).limit(10).all()
        
        result = []
        for log in logs:
            # Format time relative
            log_time = log.created_at or datetime.utcnow()
            now = datetime.utcnow()
            diff = (now - log_time).total_seconds()
            
            if diff < 60:
                time_str = 'À l\'instant'
            elif diff < 3600:
                time_str = f"{int(diff/60)} min"
            elif diff < 86400:
                time_str = f"{int(diff/3600)}h"
            else:
                time_str = log_time.strftime('%d/%m/%Y')
            
            action_type = 'ASSIGNED' if 'assign' in str(log.action or '').lower() else 'AVAILABLE'
            
            result.append({
                'id': str(log.id),
                'item': log.details or 'Système',
                'user': (log.user.username if log.user else 'Système').upper() if log.user_id else 'Système',
                'time': time_str,
                'type': action_type,
                'details': log.details or '',
                'ip_address': log.ip_address or 'N/A'
            })
        
        return jsonify(result), 200
    
    except Exception as e:
        print(f"Error in get_recent_activities: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({'error': str(e), 'activities': []}), 500


@dashboard_bp.route('/department-distribution', methods=['GET'])
@jwt_required()
def get_department_distribution():
    """Récupère la répartition des équipements par département"""
    try:
        # Compter les équipements par département
        dept_counts = db.session.query(
            Department.name,
            func.count(Device.id).label('count')
        ).outerjoin(Device).group_by(Department.id, Department.name).all()
        
        # Calculer le total
        total_equipment = Device.query.count()
        
        result = []
        for dept_name, count in dept_counts:
            percentage = (count / total_equipment * 100) if total_equipment > 0 else 0
            result.append({
                'name': dept_name or 'Non assigné',
                'count': count,
                'percentage': round(percentage, 2)
            })
        
        # Ajouter les équipements sans département
        unassigned = Device.query.filter_by(department_id=None).count()
        if unassigned > 0:
            percentage = (unassigned / total_equipment * 100) if total_equipment > 0 else 0
            result.append({
                'name': 'Non assigné',
                'count': unassigned,
                'percentage': round(percentage, 2)
            })
        
        return jsonify(result), 200
    
    except Exception as e:
        print(f"Error in get_department_distribution: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({'error': str(e), 'distribution': []}), 500


@dashboard_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_dashboard_stats():
    """Récupère les statistiques globales du dashboard"""
    try:
        # Statistiques des équipements
        total_devices = Device.query.count()
        available = Device.query.filter_by(status='AVAILABLE').count()
        assigned = Device.query.filter_by(status='ASSIGNED').count()
        maintenance = Device.query.filter_by(status='MAINTENANCE').count()
        
        # Nombre d'utilisateurs actifs
        active_users = User.query.filter_by(is_blocked=False).count()
        
        return jsonify({
            'total': total_devices,
            'available': available,
            'busy': assigned,
            'maintenance': maintenance,
            'activeUsers': active_users
        }), 200
    
    except Exception as e:
        print(f"Error in get_dashboard_stats: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            'error': str(e),
            'total': 0,
            'available': 0,
            'busy': 0,
            'maintenance': 0,
            'activeUsers': 0
        }), 500
