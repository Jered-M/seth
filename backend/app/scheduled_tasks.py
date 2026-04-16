from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler

from app.database import db
from app.models.security_models import Device, SecurityAlert, SecurityLog
from app.services.security_service import SecurityService


_scheduler = None


def poll_geofences(app):
    with app.app_context():
        devices = Device.query.filter(
            Device.last_known_lat.isnot(None),
            Device.last_known_lng.isnot(None)
        ).all()

        for device in devices:
            if SecurityService.check_geofencing(device.id):
                continue

            if device.status != "OUT_OF_ZONES":
                device.status = "OUT_OF_ZONES"
                SecurityService.create_alert(
                    device.user_id,
                    "UNAUTHORIZED_EXIT",
                    f"Le matériel {device.name} est sorti de la zone autorisée."
                )
                SecurityService.log_event(
                    device.user_id,
                    "GEOFENCE_BREACH",
                    f"Matériel hors zone détecté: {device.name}",
                    "127.0.0.1",
                    "scheduler",
                    status="ALERT",
                    risk_score=90,
                )

        db.session.commit()


def cleanup_old_security_logs(app, retention_days: int = 90):
    with app.app_context():
        cutoff = datetime.utcnow() - timedelta(days=retention_days)
        SecurityLog.query.filter(SecurityLog.created_at < cutoff).delete(synchronize_session=False)
        SecurityAlert.query.filter(SecurityAlert.is_resolved.is_(True), SecurityAlert.created_at < cutoff).delete(synchronize_session=False)
        db.session.commit()


def start_scheduler(app):
    global _scheduler

    if _scheduler is not None:
        return _scheduler

    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(func=lambda: poll_geofences(app), trigger="interval", seconds=60, id="poll_geofences", replace_existing=True)
    _scheduler.add_job(func=lambda: cleanup_old_security_logs(app), trigger="cron", hour=2, minute=0, id="cleanup_old_logs", replace_existing=True)
    _scheduler.start()
    return _scheduler
