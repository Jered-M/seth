from functools import wraps
from flask import request, jsonify
from flask_jwt_extended import get_jwt, verify_jwt_in_request
from app.models.security_models import RoleName


def _normalize_role(role):
    aliases = {
        "ADMIN_GENERAL": "SUPER_ADMIN",
        "SUPER_ADMIN": "SUPER_ADMIN",
        "ADMIN_DEPT": "DEPT_ADMIN",
        "DEPT_ADMIN": "DEPT_ADMIN",
        "SUPERVISOR": "SUPERVISOR",
        "SECURITY_AGENT": "SECURITY_AGENT",
        "GARDIEN": "SECURITY_AGENT",
        "USER": "USER",
    }
    return aliases.get(str(role), str(role))


def role_required(allowed_roles):
    """
    Décorateur pour restreindre l'accès à certains rôles.
    allowed_roles: liste de noms de rôles autorisés (ex: [RoleName.SUPER_ADMIN, RoleName.DEPT_ADMIN])
    """
    normalized_allowed = {_normalize_role(r) for r in allowed_roles}

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            user_role = _normalize_role(claims.get("role"))

            if user_role not in normalized_allowed:
                return jsonify({
                    "status": "error",
                    "message": "Accès refusé. Permission insuffisante."
                }), 403

            return f(*args, **kwargs)

        return decorated_function

    return decorator


def super_admin_required(f):
    return role_required([RoleName.SUPER_ADMIN, "SUPER_ADMIN"])(f)


def dept_admin_required(f):
    return role_required([
        RoleName.SUPER_ADMIN,
        "SUPER_ADMIN",
        RoleName.DEPT_ADMIN,
        "DEPT_ADMIN",
    ])(f)


def supervisor_required(f):
    return role_required([
        RoleName.SUPERVISOR,
        "SUPERVISOR",
        RoleName.SUPER_ADMIN,
        "SUPER_ADMIN",
    ])(f)
