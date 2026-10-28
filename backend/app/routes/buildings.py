"""
Building / block comparison endpoint.
GET /api/buildings/comparison
"""
from flask import Blueprint
from ..auth.decorators import jwt_required
from ..services import get_building_comparison
from ..services.analytics_service import NoSummaryAvailable
from ..utils import success, error

bp = Blueprint("buildings", __name__, url_prefix="/api/buildings")


@bp.get("/comparison")
@jwt_required
def comparison():
    """
    Returns per-building aggregated stats for block-wise bar chart.
    Each item includes: total_kwh, avg_kwh, pct_share, intensity_kwh_per_sqft.
    """
    try:
        data = get_building_comparison()
        return success(data, "Building comparison fetched successfully")
    except NoSummaryAvailable as exc:
        return error(
            "Building comparison not yet computed.",
            503,
            details={
                "reason": str(exc),
                "run_hint": "python spark_jobs/spark_runner.py --job building_comparison --local",
            },
        )
    except Exception as exc:
        return error(f"Failed to fetch building comparison: {str(exc)}", 500)
