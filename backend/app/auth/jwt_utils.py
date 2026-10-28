"""
JWT utility functions — generate and decode tokens.

Token structure
---------------
Access token  (short-lived, 60 min by default)
  payload: { sub: user_id, username, role, type: "access",  iat, exp }

Refresh token (long-lived, 7 days by default)
  payload: { sub: user_id, type: "refresh", iat, exp }

Both tokens are signed with the application's SECRET_KEY using HS256.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import jwt
from flask import current_app


# ── Token TTLs (overridable via env vars) ────────────────────
_ACCESS_MINUTES  = int(os.getenv("JWT_ACCESS_EXPIRES_MINUTES", "60"))
_REFRESH_DAYS    = int(os.getenv("JWT_REFRESH_EXPIRES_DAYS",   "7"))
_ALGORITHM       = "HS256"


def _secret() -> str:
    """Return the signing secret, preferring JWT_SECRET_KEY over SECRET_KEY."""
    return current_app.config.get("JWT_SECRET_KEY") or current_app.config["SECRET_KEY"]


def generate_tokens(user) -> dict:
    """
    Generate an access token + refresh token pair for *user*.

    Parameters
    ----------
    user : User
        SQLAlchemy User model instance.

    Returns
    -------
    dict with keys: access_token, refresh_token, expires_in (seconds),
                    token_type, user (safe dict)
    """
    now = datetime.now(timezone.utc)

    access_payload = {
        "sub":      str(user.id),
        "username": user.username,
        "email":    user.email,
        "role":     user.role,
        "type":     "access",
        "iat":      now,
        "exp":      now + timedelta(minutes=_ACCESS_MINUTES),
    }

    refresh_payload = {
        "sub":  str(user.id),
        "type": "refresh",
        "iat":  now,
        "exp":  now + timedelta(days=_REFRESH_DAYS),
    }

    secret = _secret()
    access_token  = jwt.encode(access_payload,  secret, algorithm=_ALGORITHM)
    refresh_token = jwt.encode(refresh_payload, secret, algorithm=_ALGORITHM)

    return {
        "access_token":  access_token,
        "refresh_token": refresh_token,
        "expires_in":    _ACCESS_MINUTES * 60,
        "token_type":    "Bearer",
        "user":          user.to_dict(),
    }


def decode_token(token: str, expected_type: str | None = None) -> dict:
    """
    Decode and validate *token*.

    Parameters
    ----------
    token         : str  — raw JWT string
    expected_type : str  — "access" or "refresh" (None = no check)

    Returns
    -------
    Decoded payload dict.

    Raises
    ------
    jwt.ExpiredSignatureError   — token has expired
    jwt.InvalidTokenError       — signature invalid / malformed
    ValueError                  — wrong token type
    """
    payload = jwt.decode(token, _secret(), algorithms=[_ALGORITHM])

    if expected_type and payload.get("type") != expected_type:
        raise ValueError(
            f"Expected token type '{expected_type}', got '{payload.get('type')}'"
        )

    return payload
