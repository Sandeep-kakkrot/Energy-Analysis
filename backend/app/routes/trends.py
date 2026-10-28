"""
Daily and Monthly trends endpoints.
GET /api/trends/daily?days=30
GET /api/trends/monthly?year=2025
"""
from flask import Blueprint, request
from ..auth.decorators import jwt_required
from ..services import get_daily_trends, get_monthly_trends
from ..services.analytics_service import NoSummaryAvailable
from ..utils import success, error

bp = Blueprint("trends", __name__, url_prefix="/api/trends")


@bp.get("/daily")
@jwt_required
def daily():
    """
    Returns daily consumption totals per building for the last N days.
    Query param: days (int, default 30, max 365)
    """
    try:
        days = min(int(request.args.get("days", 30)), 365)
        data = get_daily_trends(days)
        return success(data, f"Daily trends for last {days} days")
    except ValueError:
        return error("Parameter 'days' must be an integer.", 400)
    except NoSummaryAvailable as exc:
        return error(
            "Daily trends not yet computed.",
            503,
            details={
                "reason": str(exc),
                "run_hint": "python spark_jobs/spark_runner.py --job daily_trends --local",
            },
        )
    except Exception as exc:
        return error(f"Failed to fetch daily trends: {str(exc)}", 500)


@bp.get("/monthly")
@jwt_required
def monthly():
    """
    Returns monthly aggregated consumption broken down by building.
    Query param: year (int, optional)
    """
    try:
        year_param = request.args.get("year")
        year = int(year_param) if year_param else None
        data = get_monthly_trends(year)
        return success(data, "Monthly trends fetched successfully")
    except ValueError:
        return error("Parameter 'year' must be an integer.", 400)
    except NoSummaryAvailable as exc:
        return error(
            "Monthly trends not yet computed.",
            503,
            details={
                "reason": str(exc),
                "run_hint": "python spark_jobs/spark_runner.py --job monthly_trends --local",
            },
        )
    except Exception as exc:
        return error(f"Failed to fetch monthly trends: {str(exc)}", 500)
