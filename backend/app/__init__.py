"""
Flask application factory.
"""
import os
import shutil
import logging

from flask import Flask
from flask_cors import CORS

from .config     import get_config
from .extensions import db, bcrypt
from .routes     import register_routes

log = logging.getLogger(__name__)

_IS_VERCEL = bool(os.getenv("VERCEL"))


def _resolve_db(app: Flask) -> None:
    """
    Resolve the database URI before extensions are initialised.

    Priority:
      1. DATABASE_URL / SQLALCHEMY_DATABASE_URI env vars  (set in Vercel dashboard)
      2. Vercel / serverless  → copy seed SQLite to /tmp and use that
      3. Local MySQL reachable → use MySQL as-is
      4. Local MySQL unreachable → fallback to seed SQLite file directly
    """
    db_uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")

    # ── Serverless / Vercel path ─────────────────────────────────────────────
    if "sqlite:////tmp/campus_energy.db" in db_uri:
        tmp_db  = "/tmp/campus_energy.db"
        seed_db = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "data", "campus_energy_seed.db")
        )
        if not os.path.exists(tmp_db) and os.path.exists(seed_db):
            try:
                shutil.copyfile(seed_db, tmp_db)
                log.info("[startup] Copied seed DB → %s", tmp_db)
            except Exception as exc:
                log.warning("[startup] Could not copy seed DB: %s", exc)
        return

    # ── Local MySQL reachability check ────────────────────────────────────────
    if "mysql" in db_uri and "localhost" in db_uri:
        from sqlalchemy import create_engine
        try:
            test_engine = create_engine(db_uri, connect_args={"connect_timeout": 2})
            with test_engine.connect():
                pass  # reachable
        except Exception:
            seed_db = os.path.abspath(
                os.path.join(os.path.dirname(__file__), "..", "data", "campus_energy_seed.db")
            )
            if os.path.exists(seed_db):
                app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{seed_db}"
                log.info("[startup] MySQL offline — using seed SQLite: %s", seed_db)


def create_app(env: str = "development") -> Flask:
    app = Flask(__name__)
    app.config.from_object(get_config(env))

    _resolve_db(app)

    # Extensions
    db.init_app(app)
    bcrypt.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Blueprints
    register_routes(app)

    # Create tables + seed default users on first startup (if DB is reachable)
    with app.app_context():
        try:
            db.create_all()
            _seed_users()
        except Exception as exc:  # pragma: no cover
            import logging
            logging.getLogger(__name__).warning(
                "[startup] DB initialization deferred or failed: %s", exc
            )

    return app


def _seed_users() -> None:
    """Seed default admin/viewer accounts if they don't exist yet."""
    try:
        from .auth.seed import seed_default_users
        seed_default_users()
    except Exception as exc:  # pragma: no cover
        import logging
        logging.getLogger(__name__).warning(
            "[startup] Could not seed users (DB might not be ready): %s", exc
        )
