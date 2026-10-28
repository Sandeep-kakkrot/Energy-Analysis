"""
User SQLAlchemy model with bcrypt password hashing.
"""
from __future__ import annotations

from datetime import datetime, timezone

from ..extensions import db, bcrypt


class User(db.Model):
    """Application user — supports admin and viewer roles."""

    __tablename__ = "users"

    id            = db.Column(db.Integer,     primary_key=True, autoincrement=True)
    username      = db.Column(db.String(50),  nullable=False, unique=True,
                              comment="Login handle")
    email         = db.Column(db.String(120), nullable=False, unique=True)
    password_hash = db.Column(db.String(256), nullable=False)
    role          = db.Column(
        db.Enum("admin", "viewer"),
        nullable=False,
        default="viewer",
        comment="admin = full access; viewer = read-only analytics",
    )
    is_active     = db.Column(db.Boolean, nullable=False, default=True)
    created_at    = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    last_login    = db.Column(db.DateTime, nullable=True)

    # ── Password helpers ─────────────────────────────────────

    def set_password(self, raw_password: str) -> None:
        """Hash and store *raw_password* using bcrypt."""
        self.password_hash = bcrypt.generate_password_hash(raw_password).decode("utf-8")

    def check_password(self, raw_password: str) -> bool:
        """Return True if *raw_password* matches the stored hash."""
        return bcrypt.check_password_hash(self.password_hash, raw_password)

    def record_login(self) -> None:
        """Stamp last_login with the current UTC time."""
        self.last_login = datetime.now(timezone.utc)

    # ── Serialisation ────────────────────────────────────────

    def to_dict(self) -> dict:
        """Safe representation — never includes password_hash."""
        return {
            "id":         self.id,
            "username":   self.username,
            "email":      self.email,
            "role":       self.role,
            "is_active":  self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_login": self.last_login.isoformat() if self.last_login else None,
        }

    def __repr__(self) -> str:
        return f"<User {self.username!r} role={self.role!r}>"
