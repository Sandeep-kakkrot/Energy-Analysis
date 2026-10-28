"""
API integration tests for authentication endpoints (/api/auth/*).
"""

def test_login_success(client):
    res = client.post("/api/auth/login", json={
        "username": "test_admin",
        "password": "Admin@123"
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["username"] == "test_admin"
    assert data["user"]["role"] == "admin"


def test_login_invalid_password(client):
    res = client.post("/api/auth/login", json={
        "username": "test_admin",
        "password": "WrongPassword"
    })
    assert res.status_code == 401
    data = res.get_json()
    assert data["success"] is False
    assert "Invalid" in data["error"]


def test_login_missing_fields(client):
    res = client.post("/api/auth/login", json={})
    assert res.status_code == 400
    data = res.get_json()
    assert data["success"] is False


def test_get_me_success(client, admin_token):
    res = client.get("/api/auth/me", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["user"]["username"] == "test_admin"


def test_get_me_unauthorized(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_logout(client, admin_token):
    login_res = client.post("/api/auth/login", json={
        "username": "test_admin",
        "password": "Admin@123"
    }).get_json()

    res = client.post("/api/auth/logout", json={
        "refresh_token": login_res["refresh_token"]
    }, headers={
        "Authorization": f"Bearer {login_res['access_token']}"
    })
    assert res.status_code == 200
    assert res.get_json()["success"] is True
