"""
Flask application factory.
"""
from flask import Flask
from flask_cors import CORS

from .config     import get_config
from .extensions import db, bcrypt
from .routes     import register_routes


def create_app(env: str = "development") -> Flask:
    app = Flask(__name__)
    app.config.from_object(get_config(env))

    # If using /tmp SQLite (e.g. on Vercel), copy pre-seeded database if present
    db_uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
    if "sqlite:////tmp/campus_energy.db" in db_uri:
        import os, shutil
        tmp_db = "/tmp/campus_energy.db"
        if not os.path.exists(tmp_db):
            seed_db = os.path.join(os.path.dirname(__file__), "..", "data", "campus_energy_seed.db")
            if os.path.exists(seed_db):
                try:
                    shutil.copyfile(seed_db, tmp_db)
                except Exception:
                    pass

    # If configured for MySQL on localhost, verify connection; fallback to SQLite seed if offline
    if "mysql" in db_uri and "localhost" in db_uri:
        from sqlalchemy import create_engine
        import os
        try:
            test_engine = create_engine(db_uri, connect_args={"connect_timeout": 2})
            with test_engine.connect():
                pass
        except Exception:
            seed_db = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "campus_energy_seed.db"))
            if os.path.exists(seed_db):
                app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{seed_db}"

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
