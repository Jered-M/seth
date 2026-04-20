import sys
import os

# Add the current directory to sys.path to allow importing 'app'
sys.path.append(os.getcwd())

from app import create_app
from app.models.security_models import Device
from app.database import db

app = create_app()
with app.app_context():
    devices = Device.query.all()
    for d in devices:
        d.last_known_lat = None
        d.last_known_lng = None
        # Optionally assign them to someone so they can be tracked
        # if not d.user_id:
        #    u = User.query.filter_by(username='superadmin').first()
        #    if u: d.user_id = u.id
        #    d.status = 'ASSIGNED'
    
    db.session.commit()
    print(f"Successfully reset coordinates for {len(devices)} devices.")
