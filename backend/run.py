from dotenv import load_dotenv
import os
import sys

# Load environment variables from .env file
load_dotenv()

from app import create_app
from app.database import db
from app.seeds import seed_data
from app.scheduled_tasks import start_scheduler

app = create_app()
scheduler = None

if __name__ == "__main__":
    with app.app_context():
        # Optionnel: seed data automatically or via flag
        if "--seed" in sys.argv:
            seed_data()

    if os.getenv("ENABLE_SCHEDULER", "false").lower() == "true":
        scheduler = start_scheduler(app)

    try:
        app.run(debug=True, host='0.0.0.0', port=5000, use_reloader=False)
    finally:
        if scheduler:
            scheduler.shutdown(wait=False)
