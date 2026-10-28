"""
Unit tests for User ORM Model and bcrypt password hashing.
"""
from app.models.user import User


def test_user_password_hashing():
    user = User(username="alice", email="alice@campus.edu", role="viewer")
    user.set_password("SecretPassword123!")

    assert user.password_hash != "SecretPassword123!"
    assert user.check_password("SecretPassword123!") is True
    assert user.check_password("WrongPassword") is False


def test_user_to_dict_safety():
    user = User(id=42, username="bob", email="bob@campus.edu", role="admin")
    user.set_password("AdminPass789")

    d = user.to_dict()
    assert d["id"] == 42
    assert d["username"] == "bob"
    assert d["email"] == "bob@campus.edu"
    assert d["role"] == "admin"
    assert "password_hash" not in d
    assert "password" not in d


def test_user_default_role():
    user = User(username="charlie", email="charlie@campus.edu")
    assert user.role == "viewer" or user.role is None
