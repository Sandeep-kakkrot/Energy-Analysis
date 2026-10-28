"""
Authentication routes — Campus Energy Analysis
================================================
POST /api/auth/login    — issue tokens
POST /api/auth/refresh  — rotate access token using refresh token
POST /api/auth/logout   — blacklist the refresh token
GET  /api/auth/me       — return the authenticated user's profile
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

import jwt as pyjwt
from flask import Blueprint, g, jsonify, request

from ..auth.decorators  import jwt_required
from ..auth.jwt_utils   import decode_token, generate_tokens
from ..auth.token_blacklist import add as blacklist_add, is_blacklisted
from ..extensions       import db
from ..models.user      import User

log    = logging.getLogger(__name__)
auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


# ─────────────────────────────────────────────────────────────
#  POST /api/auth/login
# ─────────────────────────────────────────────────────────────

@auth_bp.post("/login")
def login():
    """
    Authenticate with username + password, return JWT tokens.

    Request  JSON : { "username": str, "password": str }
    Response 200  : { access_token, refresh_token, expires_in,
                      token_type, user: {...} }
    Response 400  : missing fields
    Response 401  : wrong credentials or inactive account
    """
    body = request.get_json(silent=True) or {}
    username = body.get("username", "").strip()
    password = body.get("password", "")

    if not username or not password:
        return jsonify({
            "success": False,
            "error":   "username and password are required.",
        }), 400

    user = User.query.filter_by(username=username).first()

    if not user or not user.check_password(password):
        log.warning("[auth] Failed login attempt for username=%r", username)
        return jsonify({
            "success": False,
            "error":   "Invalid username or password.",
        }), 401

    if not user.is_active:
        return jsonify({
            "success": False,
            "error":   "Your account has been disabled. Contact an administrator.",
        }), 403

    # Stamp last_login
    user.record_login()
    db.session.commit()

    tokens = generate_tokens(user)
    log.info("[auth] Login OK — username=%r role=%r", user.username, user.role)

    return jsonify({"success": True, **tokens}), 200


# ─────────────────────────────────────────────────────────────
#  POST /api/auth/refresh
# ─────────────────────────────────────────────────────────────

@auth_bp.post("/refresh")
def refresh():
    """
    Exchange a valid refresh token for a new access token.

    Request  JSON : { "refresh_token": str }
    Response 200  : { access_token, refresh_token, expires_in,
                      token_type, user: {...} }
    Response 401  : expired / blacklisted / invalid
    """
    body          = request.get_json(silent=True) or {}
    refresh_token = body.get("refresh_token", "").strip()

    if not refresh_token:
        return jsonify({"success": False, "error": "refresh_token is required."}), 400

    if is_blacklisted(refresh_token):
        return jsonify({"success": False, "error": "Token has been invalidated."}), 401

    try:
        payload = decode_token(refresh_token, expected_type="refresh")
    except pyjwt.ExpiredSignatureError:
        return jsonify({"success": False, "error": "Refresh token has expired. Please log in again."}), 401
    except (pyjwt.InvalidTokenError, ValueError) as exc:
        return jsonify({"success": False, "error": f"Invalid token: {exc}"}), 401

    user = User.query.get(payload["sub"])
    if not user or not user.is_active:
        return jsonify({"success": False, "error": "User not found or disabled."}), 401

    # Rotate: blacklist old refresh token, issue new pair
    blacklist_add(refresh_token)
    tokens = generate_tokens(user)
    return jsonify({"success": True, **tokens}), 200


# ─────────────────────────────────────────────────────────────
#  POST /api/auth/logout
# ─────────────────────────────────────────────────────────────

@auth_bp.post("/logout")
@jwt_required
def logout():
    """
    Blacklist the provided refresh token so it can no longer be used.

    Request  JSON : { "refresh_token": str }
    Response 200  : { success: true, message: "..." }
    """
    body          = request.get_json(silent=True) or {}
    refresh_token = body.get("refresh_token", "").strip()

    if refresh_token:
        blacklist_add(refresh_token)

    log.info("[auth] Logout — username=%r", g.current_user.username)
    return jsonify({"success": True, "message": "Logged out successfully."}), 200


# ─────────────────────────────────────────────────────────────
#  GET /api/auth/me
# ─────────────────────────────────────────────────────────────

@auth_bp.get("/me")
@jwt_required
def me():
    """
    Return the currently authenticated user's profile.

    Response 200 : { success: true, user: { id, username, email, role, ... } }
    """
    return jsonify({"success": True, "user": g.current_user.to_dict()}), 200
