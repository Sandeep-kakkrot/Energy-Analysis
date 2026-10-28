"""
Pytest configuration and global fixtures for Campus Energy Analysis.
"""
import os
import sys
import pytest

# Ensure backend root is on sys.path
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app import create_app
from app.extensions import db as _db
from app.models.user import User


@pytest.fixture(scope="session")
def app():
    """Create Flask application configured for testing."""
    os.environ["SECRET_KEY"] = "test-secret-key-123"
    os.environ["JWT_SECRET_KEY"] = "test-jwt-secret-key-123"

    _app = create_app("testing")
    _app.config["TESTING"] = True
    _app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"

    with _app.app_context():
        _db.create_all()
        # Seed test admin & viewer
        admin = User(username="test_admin", email="test_admin@campus.edu", role="admin")
        admin.set_password("Admin@123")
        
        viewer = User(username="test_viewer", email="test_viewer@campus.edu", role="viewer")
        viewer.set_password("Viewer@123")

        _db.session.add_all([admin, viewer])
        _db.session.commit()

        yield _app

        _db.drop_all()


@pytest.fixture
def client(app):
    """Flask test client."""
    return app.test_client()


@pytest.fixture
def db_session(app):
    """Provides a clean database session for database tests."""
    with app.app_context():
        connection = _db.engine.connect()
        transaction = connection.begin()

        yield _db.session

        transaction.rollback()
        connection.close()


@pytest.fixture
def admin_token(client):
    """Obtain a valid admin JWT access token."""
    res = client.post("/api/auth/login", json={
        "username": "test_admin",
        "password": "Admin@123"
    })
    data = res.get_json()
    return data["access_token"]


@pytest.fixture
def viewer_token(client):
    """Obtain a valid viewer JWT access token."""
    res = client.post("/api/auth/login", json={
        "username": "test_viewer",
        "password": "Viewer@123"
    })
    data = res.get_json()
    return data["access_token"]
