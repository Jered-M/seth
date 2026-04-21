import os
from flask import Flask, send_from_directory
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
    # Définition du chemin absolu vers le dossier dist du frontend
    # On remonte de 3 niveaux depuis backend/app/__init__.py vers la racine
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    dist_path = os.path.abspath(os.path.join(base_dir, 'frontend/dist'))
    
    print(f"DEBUG: Serving frontend from: {dist_path}")
    
    app = Flask(__name__, static_folder=dist_path, static_url_path='/')
    
    # CORS n'est plus vraiment nécessaire si c'est le même serveur, mais on le garde par sécurité
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)
    
    # JWT Config
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "super-secret")
    jwt = JWTManager(app)
    
    # Initialize Database
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
    
    # Route pour servir l'application React
    @app.route("/", defaults={'path': ''})
    @app.route("/<path:path>")
    def serve(path):
        if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        else:
            return send_from_directory(app.static_folder, 'index.html')

    return app
