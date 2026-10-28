"""
Energy wastage indicators & hostel closure policy routes.
==========================================================
GET  /api/wastage/indicators      — per-building wastage analysis
GET  /api/wastage/hostel-closure  — retrieve hostel closure configuration
POST /api/wastage/hostel-closure  — update closure dates, status & threshold
"""
import logging
from flask import Blueprint, request

from ..auth.decorators import jwt_required
from ..services import get_wastage_indicators
from ..services.analytics_service import NoSummaryAvailable
from ..utils import success, error
from spark_jobs.hostel_closure_manager import load_closure_config, save_closure_config
from spark_jobs.job_wastage_indicators import WastageIndicatorsJob
from spark_jobs.job_dashboard_summary import DashboardSummaryJob

log = logging.getLogger(__name__)

bp = Blueprint("wastage", __name__, url_prefix="/api/wastage")


@bp.get("/indicators")
@jwt_required
def indicators():
    """
    Returns per-building wastage analysis:
    off_hours_kwh, weekend_kwh, wastage_pct, severity, recommendation
    Includes 24/7 normal operation status for Hostel Complex.
    """
    try:
        data = get_wastage_indicators()
        return success(data, "Wastage indicators fetched successfully")
    except NoSummaryAvailable as exc:
        return error(
            "Wastage analysis not yet computed.",
            503,
            details={
                "reason": str(exc),
                "run_hint": "python spark_jobs/spark_runner.py --job wastage_indicators --local",
            },
        )
    except Exception as exc:
        log.exception("[routes.wastage] Error fetching indicators: %s", exc)
        return error(f"Failed to fetch wastage indicators: {str(exc)}", 500)


@bp.get("/hostel-closure")
@jwt_required
def get_hostel_closure():
    """
    Returns current hostel closure configuration:
    is_active, start_date, end_date, standby_threshold_kwh, closure_reason
    """
    try:
        config = load_closure_config()
        return success(config, "Hostel closure configuration fetched successfully")
    except Exception as exc:
        log.exception("[routes.wastage] Error reading hostel closure config: %s", exc)
        return error(f"Failed to fetch closure config: {str(exc)}", 500)


@bp.post("/hostel-closure")
@jwt_required
def update_hostel_closure():
    """
    Update hostel closure policy and trigger Spark re-aggregation.

    Request Body (JSON):
    {
        "is_active": bool,
        "start_date": "YYYY-MM-DD" | null,
        "end_date": "YYYY-MM-DD" | null,
        "standby_threshold_kwh": float,
        "closure_reason": str
    }
    """
    try:
        body = request.get_json() or {}
        saved_config = save_closure_config(body)

        # Trigger Spark jobs to recalculate and refresh MySQL spark_summaries
        log.info("[routes.wastage] Re-running WastageIndicatorsJob and DashboardSummaryJob with updated closure policy")
        w_job = WastageIndicatorsJob()
        w_job.execute()

        d_job = DashboardSummaryJob()
        d_job.execute()

        # Fetch fresh indicators
        fresh_indicators = get_wastage_indicators()

        return success(
            {
                "config": saved_config,
                "indicators": fresh_indicators,
            },
            "Hostel closure configuration saved and wastage metrics recalculated successfully"
        )
    except Exception as exc:
        log.exception("[routes.wastage] Error updating hostel closure config: %s", exc)
        return error(f"Failed to update hostel closure config: {str(exc)}", 500)
