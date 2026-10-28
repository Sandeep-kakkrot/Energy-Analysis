"""
API tests for protected analytics routes (/api/dashboard/*, /api/buildings/*, etc.).
"""

def test_dashboard_summary_requires_jwt(client):
    res = client.get("/api/dashboard/summary")
    assert res.status_code == 401


def test_dashboard_summary_authenticated(client, admin_token):
    res = client.get("/api/dashboard/summary", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    # Either 200 OK or 503 if summary job hasn't run yet
    assert res.status_code in (200, 503)


def test_building_comparison_authenticated(client, viewer_token):
    res = client.get("/api/buildings/comparison", headers={
        "Authorization": f"Bearer {viewer_token}"
    })
    assert res.status_code in (200, 503)


def test_trends_daily_authenticated(client, admin_token):
    res = client.get("/api/trends/daily?days=14", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code in (200, 503)


def test_peaks_usage_authenticated(client, viewer_token):
    res = client.get("/api/peaks/usage", headers={
        "Authorization": f"Bearer {viewer_token}"
    })
    assert res.status_code in (200, 503)


def test_wastage_indicators_authenticated(client, admin_token):
    res = client.get("/api/wastage/indicators", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code in (200, 503)
