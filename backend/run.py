from dotenv import load_dotenv
import os
import sys

# Load environment variables from .env file
load_dotenv()

from app import create_app
from app.database import db
from app.seeds import seed_data
from app.scheduled_tasks import start_scheduler

def initialize_app(app):
    """Effectue l'initialisation de la base de données et le seeding si nécessaire"""
    with app.app_context():
        # Auto-seed if database is empty
        from app.models.security_models import Role
        try:
            if not Role.query.first():
                print("🌑 Base de données vide, lancement du seeding...")
                seed_data()
                print("🌕 Seeding terminé.")
        except Exception as e:
            print(f"⚠️ Erreur lors de l'initialisation de la base : {e}")
            # On ignore l'erreur ici pour laisser l'app démarrer si possible
            pass
        
        if "--seed" in sys.argv:
            seed_data()

app = create_app()
initialize_app(app)

# Global scheduler for production usage
scheduler = None
if os.getenv("ENABLE_SCHEDULER", "false").lower() == "true":
    scheduler = start_scheduler(app)

if __name__ == "__main__":
    try:
        app.run(debug=True, host='0.0.0.0', port=5000, use_reloader=False)
    finally:
        if scheduler:
            scheduler.shutdown(wait=False)
