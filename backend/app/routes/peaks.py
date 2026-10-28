"""
Peak electricity usage endpoint.
GET /api/peaks/usage
"""
from flask import Blueprint
from ..auth.decorators import jwt_required
from ..services import get_peak_usage
from ..services.analytics_service import NoSummaryAvailable
from ..utils import success, error

bp = Blueprint("peaks", __name__, url_prefix="/api/peaks")


@bp.get("/usage")
@jwt_required
def usage():
    """
    Returns:
    - heatmap: 24h × 7-day avg kWh grid
    - top_hours: peak hours ranked
    - top_days: peak days ranked
    - peak_building: highest contributor at peak hours
    """
    try:
        data = get_peak_usage()
        return success(data, "Peak usage data fetched successfully")
    except NoSummaryAvailable as exc:
        return error(
            "Peak usage data not yet computed.",
            503,
            details={
                "reason": str(exc),
                "run_hint": "python spark_jobs/spark_runner.py --job peak_usage --local",
            },
        )
    except Exception as exc:
        return error(f"Failed to fetch peak usage: {str(exc)}", 500)
