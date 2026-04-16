import os
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from app.database import init_db
from app.routes.auth import auth_bp
from app.routes.admin import admin_bp
from app.routes.department import dept_bp
from app.routes.user import user_bp
from app.routes.equipment import equipment_bp
from app.routes.supervisor import supervisor_bp

def create_app():
    app = Flask(__name__)
    
    # Configuration CORS améliorée
    CORS(app, 
         resources={r"/api/*": {
             "origins": ["http://localhost:3000", "http://localhost:3050", "http://localhost:3051", "http://127.0.0.1:3000", "http://127.0.0.1:3050", "http://127.0.0.1:3051", "http://192.168.113.1:3050", "http://192.168.113.1:3051", "http://192.168.43.147:3050"],
             "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
             "allow_headers": ["Content-Type", "Authorization"],
             "supports_credentials": True
         }},
         supports_credentials=True
    )
    
    # JWT Config
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "super-secret")
    jwt = JWTManager(app)
    
    # Initialize Database (PostgreSQL via SQLAlchemy)
    init_db(app)
    
    from strawberry.flask.views import GraphQLView
    from app.graphql.schema import schema

    # Register Blueprints
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(dept_bp, url_prefix="/api/dept")
    app.register_blueprint(user_bp, url_prefix="/api/user")
    app.register_blueprint(equipment_bp, url_prefix="/api/equipments")
    app.register_blueprint(supervisor_bp, url_prefix="/api/supervisor")

    # Add GraphQL route
    app.add_url_rule(
        "/api/graphql",
        view_func=GraphQLView.as_view("graphql_view", schema=schema),
    )
    
    @app.route("/")
    def index():
        return {
            "name": "SetH - IT Equipment Management & Security API",
            "version": "2.0",
            "status": "Running"
        }

    return app
