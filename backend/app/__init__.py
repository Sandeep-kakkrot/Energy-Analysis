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

    # Extensions
    db.init_app(app)
    bcrypt.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Blueprints
    register_routes(app)

    # Create tables + seed default users on first startup
    with app.app_context():
        db.create_all()
        _seed_users()

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
