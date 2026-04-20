import os
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

db = SQLAlchemy()


def _normalize_database_url(raw_url: str) -> str:
    """Normalise les URI DB pour SQLAlchemy (Supabase/PostgreSQL inclus)."""
    if not raw_url:
        return ""
        
    db_url = raw_url.strip().strip('"').strip("'")
    
    # Correction pour SQLAlchemy qui n'accepte plus 'postgres://' seul
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    # Ajout automatique de sslmode pour Supabase si manquant
    if "supabase.com" in db_url and "sslmode=" not in db_url:
        sep = "&" if "?" in db_url else "?"
        db_url = f"{db_url}{sep}sslmode=require"

    return db_url

def init_db(app):
    """Initialise l'application avec SQLAlchemy"""
    raw_url = os.getenv("DATABASE_URL", "")
    db_url = _normalize_database_url(raw_url)

    # Debug: afficher l'URL masquée (protection mot de passe) de manière sécurisée
    masked_url = db_url
    try:
        if "://" in db_url and "@" in db_url:
            protocol_part, auth_part = db_url.split("://", 1)
            if "@" in auth_part:
                cred_part, host_part = auth_part.split("@", 1)
                masked_url = f"{protocol_part}://***:***@{host_part}"
    except Exception:
        masked_url = "[URL_INVALID_OR_UNPARSABLE]"
    
    print(f"DEBUG: SQLAlchemy URI being used: {masked_url}")

    use_sqlite = os.getenv("USE_SQLITE", "false").lower() == "true"
    allow_sqlite_fallback = os.getenv("ALLOW_SQLITE_FALLBACK", "false").lower() == "true"

    # Fallback explicite sur SQLite pour le développement local
    if (use_sqlite or not raw_url or "votre_url" in raw_url):
        db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "seth_local.db")
        db_url = f"sqlite:///{db_path}"
        print(f"[SQLITE] MODE: {db_path}")
    elif db_url.startswith("postgresql"):
        try:
            print("[DB] Verification de la connexion Supabase...")
            engine = create_engine(db_url, pool_pre_ping=True)
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print("[OK] Connexion PostgreSQL/Supabase etablie")
        except Exception as e:
            print(f"[ERROR] ECHEC CONNEXION POSTGRES: {e}")
            if allow_sqlite_fallback:
                db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "seth_local.db")
                db_url = f"sqlite:///{db_path}"
                print(f"[WARN] Bascule de secours vers SQLite")
            else:
                # On ne lève pas d'exception ici pour laisser db.init_app tenter sa chance
                pass
    
    app.config['SQLALCHEMY_DATABASE_URI'] = db_url
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
        "connect_args": {"connect_timeout": 10} if db_url.startswith("postgresql") else {}
    }
    app.config['SECRET_KEY'] = os.getenv("SECRET_KEY", "dev-secret-key")
    
    try:
        db.init_app(app)
        with app.app_context():
            # Import models inside context to avoid circularity
            import app.models.security_models
            db.create_all()
            print("[OK] Base de données initialisée (create_all executed)")
    except Exception as e:
        print(f"[CRITICAL ERROR] IN INIT_DB: {e}")
        import traceback
        traceback.print_exc()

def get_db_connection():
    """Retourne une connexion brute à la base de données (pour compatibilité)."""
    return db.engine.raw_connection()

def execute_query(query, params=None, is_select=True):
    from app.database import db
    connection = db.engine.raw_connection()
    try:
        cursor = connection.cursor()
        
        # Determine if we are using SQLite and need to convert %s to ?
        is_sqlite = db.engine.url.drivername.startswith("sqlite")
        if is_sqlite and params:
            query = query.replace('%s', '?')
            
        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)
            
        if is_select:
            # Try to return dict if possible
            columns = [col[0] for col in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]
        else:
            connection.commit()
            return None
    finally:
        connection.close()

def execute_one(query, params=None):
    res = execute_query(query, params, is_select=True)
    return res[0] if res else None
