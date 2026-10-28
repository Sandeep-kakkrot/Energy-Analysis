"""
Authentication decorators for Flask route protection.

Usage
-----
    from ..auth.decorators import jwt_required, admin_required

    @bp.get("/summary")
    @jwt_required
    def summary():
        ...   # g.current_user is the authenticated User ORM instance

    @spark_bp.post("/run")
    @admin_required
    def spark_run():
        ...   # only role == 'admin' reaches here
"""
from __future__ import annotations

from functools import wraps

import jwt as pyjwt
from flask import g, jsonify, request

from .jwt_utils import decode_token
from ..models.user import User


# ── Helpers ──────────────────────────────────────────────────

def _extract_bearer() -> str | None:
    """Pull the raw token from the Authorization: Bearer <token> header."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


def _unauthorized(message: str, code: int = 401):
    return jsonify({"success": False, "error": message}), code


# ── @jwt_required ─────────────────────────────────────────────

def jwt_required(fn):
    """
    Decorator: validates the Bearer access token on every request.

    On success  → injects g.current_user (User ORM instance) and calls fn.
    On failure  → returns 401 JSON immediately.
    """
    @wraps(fn)
    def wrapper(*args, **kwargs):
        token = _extract_bearer()
        if not token:
            return _unauthorized("Missing or malformed Authorization header.")

        try:
            payload = decode_token(token, expected_type="access")
        except pyjwt.ExpiredSignatureError:
            return _unauthorized("Access token has expired. Please refresh.")
        except (pyjwt.InvalidTokenError, ValueError) as exc:
            return _unauthorized(f"Invalid token: {exc}")

        user = User.query.get(payload["sub"])
        if not user:
            return _unauthorized("Token refers to a non-existent user.")
        if not user.is_active:
            return _unauthorized("User account is disabled.", 403)

        g.current_user = user
        return fn(*args, **kwargs)

    return wrapper


# ── @admin_required ───────────────────────────────────────────

def admin_required(fn):
    """
    Decorator: like @jwt_required but also enforces role == 'admin'.

    Returns 403 Forbidden for authenticated viewers.
    """
    @wraps(fn)
    @jwt_required
    def wrapper(*args, **kwargs):
        if g.current_user.role != "admin":
            return _unauthorized(
                "Admin role required to perform this action.", 403
            )
        return fn(*args, **kwargs)

    return wrapper
