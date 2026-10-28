"""
User seeder — called once at application startup.

Creates the default admin and viewer accounts with real bcrypt hashes
if they don't already exist. Placeholder rows from the SQL migration
are replaced atomically.
"""
from __future__ import annotations

import logging

from ..extensions import db, bcrypt
from ..models.user import User

log = logging.getLogger(__name__)

_SEED_USERS = [
    {"username": "admin",  "email": "admin@campus.edu",  "password": "Admin@123",  "role": "admin"},
    {"username": "viewer", "email": "viewer@campus.edu", "password": "Viewer@123", "role": "viewer"},
]


def seed_default_users() -> None:
    """
    Idempotent: insert default users only if they are absent or still
    have the placeholder password hash from the SQL migration file.
    """
    for data in _SEED_USERS:
        user = User.query.filter_by(username=data["username"]).first()
        if user is None:
            user = User(
                username=data["username"],
                email=data["email"],
                role=data["role"],
            )
            user.set_password(data["password"])
            db.session.add(user)
            log.info("[seed] Created user '%s' (%s)", user.username, user.role)
        elif user.password_hash.startswith("$2b$12$placeholder"):
            # Migration inserted a placeholder — replace with real hash
            user.set_password(data["password"])
            log.info("[seed] Updated placeholder hash for '%s'", user.username)

    db.session.commit()
