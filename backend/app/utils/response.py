"""
Standardised API response helpers.
All endpoints use these to ensure consistent response shape.
"""
from flask import jsonify


def success(data, message: str = "OK", status_code: int = 200):
    """Return a successful JSON response."""
    return jsonify({
        "status":  "success",
        "message": message,
        "data":    data,
    }), status_code


def error(message: str, status_code: int = 400, details=None):
    """Return an error JSON response."""
    payload = {
        "status":  "error",
        "message": message,
    }
    if details:
        payload["details"] = details
    return jsonify(payload), status_code
