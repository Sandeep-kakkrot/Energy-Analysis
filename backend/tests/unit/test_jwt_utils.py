"""
Unit tests for JWT generation, validation, and token blacklist.
"""
import pytest
from app.auth.jwt_utils import generate_tokens, decode_token
from app.auth.token_blacklist import add as blacklist_add, is_blacklisted
from app.models.user import User


def test_generate_and_decode_tokens(app):
    with app.app_context():
        user = User.query.filter_by(username="test_admin").first()
        tokens = generate_tokens(user)

        assert "access_token" in tokens
        assert "refresh_token" in tokens
        assert tokens["token_type"] == "Bearer"
        assert tokens["expires_in"] == 3600

        # Decode access token
        access_payload = decode_token(tokens["access_token"], expected_type="access")
        assert access_payload["sub"] == str(user.id)
        assert access_payload["username"] == "test_admin"
        assert access_payload["role"] == "admin"
        assert access_payload["type"] == "access"

        # Decode refresh token
        refresh_payload = decode_token(tokens["refresh_token"], expected_type="refresh")
        assert refresh_payload["sub"] == str(user.id)
        assert refresh_payload["type"] == "refresh"


def test_decode_token_type_mismatch(app):
    with app.app_context():
        user = User.query.filter_by(username="test_viewer").first()
        tokens = generate_tokens(user)

        # Expecting access token but passing refresh token
        with pytest.raises(ValueError) as exc:
            decode_token(tokens["refresh_token"], expected_type="access")
        assert "Expected token type 'access'" in str(exc.value)


def test_token_blacklist():
    sample_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_sample_token"
    assert is_blacklisted(sample_token) is False

    blacklist_add(sample_token)
    assert is_blacklisted(sample_token) is True
