"""
API tests for Data Ingestion Upload Endpoint (POST /api/upload).
"""
import io
import pytest


def test_upload_unauthorized(client):
    res = client.post("/api/upload")
    assert res.status_code == 401


def test_upload_viewer_forbidden(client, viewer_token):
    data = {"file": (io.BytesIO(b"recorded_at,consumption_kwh\n2024-01-01 00:00:00,50.0"), "test.csv")}
    res = client.post("/api/upload", data=data, content_type="multipart/form-data", headers={
        "Authorization": f"Bearer {viewer_token}"
    })
    assert res.status_code == 403


def test_upload_invalid_extension(client, admin_token):
    data = {"file": (io.BytesIO(b"dummy data"), "test.pdf")}
    res = client.post("/api/upload", data=data, content_type="multipart/form-data", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 400
    assert "Invalid file format" in res.get_json()["error"]


def test_upload_csv_success(client, admin_token):
    csv_bytes = b"recorded_at,building_code,building_name,consumption_kwh\n2024-01-01 00:00:00,CB-A,Classroom Block A,105.4\n2024-01-01 01:00:00,CB-A,Classroom Block A,98.2\n"
    data = {"file": (io.BytesIO(csv_bytes), "campus_data_test.csv")}

    res = client.post("/api/upload", data=data, content_type="multipart/form-data", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert res.status_code == 200
    json_data = res.get_json()
    assert json_data["success"] is True
    assert json_data["data"]["record_count"] == 2
    assert "hdfs_path" in json_data["data"]
