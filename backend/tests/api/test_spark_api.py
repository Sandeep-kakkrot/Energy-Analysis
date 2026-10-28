"""
API tests for Spark Admin endpoints (/api/spark/*) and RBAC rules.
"""

def test_spark_status_unauthorized(client):
    res = client.get("/api/spark/status")
    assert res.status_code == 401


def test_spark_status_viewer_allowed(client, viewer_token):
    res = client.get("/api/spark/status", headers={
        "Authorization": f"Bearer {viewer_token}"
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert "jobs" in data


def test_spark_run_viewer_forbidden(client, viewer_token):
    res = client.post("/api/spark/run", json={"local": True}, headers={
        "Authorization": f"Bearer {viewer_token}"
    })
    assert res.status_code == 403
    data = res.get_json()
    assert data["success"] is False
    assert "Admin role required" in data["error"]


def test_spark_run_admin_allowed(client, admin_token):
    res = client.post("/api/spark/run", json={"local": True, "job": "dashboard_summary"}, headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 202
    data = res.get_json()
    assert data["success"] is True
    assert "Spark job(s) triggered" in data["message"]
