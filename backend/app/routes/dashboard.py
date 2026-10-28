"""
Dashboard summary endpoint.
GET /api/dashboard/summary
"""
from flask import Blueprint
from ..auth.decorators import jwt_required
from ..services import get_dashboard_summary
from ..services.analytics_service import NoSummaryAvailable
from ..utils import success, error

bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")


@bp.get("/summary")
@jwt_required
def summary():
    """
    Returns top-level KPI data for the dashboard cards:
    - total_kwh, avg_daily_kwh, peak_hour, wastage_pct
    """
    try:
        data = get_dashboard_summary()
        return success(data, "Dashboard summary fetched successfully")
    except NoSummaryAvailable as exc:
        return error(
            "Dashboard summary not yet computed.",
            503,
            details={
                "reason": str(exc),
                "run_hint": "python spark_jobs/spark_runner.py --all --local",
            },
        )
    except Exception as exc:
        return error(f"Failed to fetch dashboard summary: {str(exc)}", 500)
