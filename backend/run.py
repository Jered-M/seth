from dotenv import load_dotenv
import os
import sys
import logging

# Load environment variables from .env file
load_dotenv()

from app.logging_config import setup_logging

setup_logging()
log = logging.getLogger("seth.run")

from app import create_app
from app.database import db
from app.seeds import seed_data, sync_seed_accounts_for_dev
from app.scheduled_tasks import start_scheduler

def initialize_app(app):
    """Effectue l'initialisation de la base de données et le seeding si nécessaire"""
    with app.app_context():
        from app.models.security_models import Role
        try:
            if not Role.query.first():
                log.info("Base vide — lancement du seeding...")
                seed_data()
                log.info("Seeding terminé.")
        except Exception as e:
            log.warning("Erreur initialisation base: %s", e)

        if "--seed" in sys.argv:
            seed_data()
        else:
            sync_seed_accounts_for_dev()
            log.info("Comptes seed prêts — security@seth.com / Security123!")

app = create_app()
initialize_app(app)

_request_routes = [r.rule for r in app.url_map.iter_rules() if r.rule.startswith("/api/requests")]
if _request_routes:
    log.info("%s routes /api/requests enregistrées", len(_request_routes))
else:
    log.warning("AUCUNE route /api/requests — vérifiez internal_requests.py")

@app.after_request
def _log_api_requests(response):
    from flask import request
    if request.path.startswith("/api/"):
        log.info("%s %s → %s", request.method, request.path, response.status_code)
    return response

# Global scheduler for production usage
scheduler = None
if os.getenv("ENABLE_SCHEDULER", "false").lower() == "true":
    scheduler = start_scheduler(app)

if __name__ == "__main__":
    log.info("Serveur SetH — logs API visibles ci-dessous (Ctrl+C pour arrêter)")
    log.info("Diagnostic: GET http://127.0.0.1:5000/api/auth/dev/seed-status")
    try:
        app.run(debug=True, host='0.0.0.0', port=5000, use_reloader=False)
    finally:
        if scheduler:
            scheduler.shutdown(wait=False)
