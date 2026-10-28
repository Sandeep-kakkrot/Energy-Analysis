"""
Analytics Service — Campus Energy Analysis
==========================================
ARCHITECTURE NOTE
-----------------
This service NO LONGER performs live SQL aggregations against
energy_records, and it NEVER reads from HDFS.

All analytics data is pre-computed by Spark jobs (backend/spark_jobs/)
which read historical CSV files from HDFS, run groupBy / agg
transformations, and write JSON payloads to the spark_summaries table.

This service is a thin read layer:
    SELECT payload FROM spark_summaries WHERE job_name = <name>

The six public functions below match the exact API contract that existed
before this refactor, so all Flask routes and the React frontend are
completely unaware of the underlying change.

To populate the spark_summaries table, run:
    cd backend
    python spark_jobs/spark_runner.py --all --local
"""
from __future__ import annotations

from typing import Any

from sqlalchemy import text

from ..extensions import db
from ..models.energy import SparkSummary


# ─────────────────────────────────────────────────────────────
#  Internal helpers
# ─────────────────────────────────────────────────────────────

class NoSummaryAvailable(RuntimeError):
    """
    Raised when the requested Spark summary does not yet exist.

    This happens when spark_runner.py has never been run, or when
    a specific job failed. The Flask routes catch this and return
    a descriptive 503 response.
    """


def _fetch_payload(job_name: str) -> Any:
    """
    Retrieve the pre-computed payload for a given Spark job.

    Raises
    ------
    NoSummaryAvailable
        If no row exists for job_name in spark_summaries.
    """
    row: SparkSummary | None = (
        SparkSummary.query.filter_by(job_name=job_name).first()
    )
    if row is None:
        raise NoSummaryAvailable(
            f"No Spark summary found for '{job_name}'. "
            "Run:  python spark_jobs/spark_runner.py --all --local"
        )
    return row.payload


# ─────────────────────────────────────────────────────────────
#  Public API — one function per dashboard page
#  (identical signatures to the old aggregation functions)
# ─────────────────────────────────────────────────────────────

def get_dashboard_summary() -> dict[str, Any]:
    """
    Return pre-computed KPI cards payload.

    Spark job: job_dashboard_summary.DashboardSummaryJob
    Payload keys: total_kwh, avg_daily_kwh, peak_hour, wastage_pct,
                  total_records, date_range
    """
    return _fetch_payload("dashboard_summary")


def get_building_comparison() -> list[dict]:
    """
    Return pre-computed per-building aggregate stats.

    Spark job: job_building_comparison.BuildingComparisonJob
    Payload: list of building dicts with total_kwh, avg_kwh,
             pct_share, intensity_kwh_per_sqft
    """
    return _fetch_payload("building_comparison")


def get_daily_trends(days: int = 30) -> list[dict]:
    """
    Return pre-computed daily consumption time-series.

    NOTE: The ``days`` parameter is accepted for API compatibility but
    the full date range is stored by the Spark job. Client-side
    filtering is applied in the React frontend.

    Spark job: job_daily_trends.DailyTrendsJob
    Payload: list of {date, building_col…, total}
    """
    return _fetch_payload("daily_trends")


def get_monthly_trends(year: int | None = None) -> list[dict]:
    """
    Return pre-computed monthly consumption time-series.

    NOTE: The ``year`` parameter is accepted for API compatibility;
    the full multi-year dataset is stored. The React frontend
    applies year filtering client-side.

    Spark job: job_monthly_trends.MonthlyTrendsJob
    Payload: list of {month, building_col…, total}
    """
    return _fetch_payload("monthly_trends")


def get_peak_usage() -> dict[str, Any]:
    """
    Return pre-computed heatmap and ranked peak hours / days.

    Spark job: job_peak_usage.PeakUsageJob
    Payload keys: heatmap, top_hours, top_days, peak_building
    """
    return _fetch_payload("peak_usage")


def get_wastage_indicators() -> list[dict]:
    """
    Return pre-computed off-hours wastage analysis per building.

    Spark job: job_wastage_indicators.WastageIndicatorsJob
    Payload: list of building wastage dicts with severity + recommendation
    """
    return _fetch_payload("wastage_indicators")


# ─────────────────────────────────────────────────────────────
#  Spark status helper (used by /api/spark/status endpoint)
# ─────────────────────────────────────────────────────────────

def get_spark_job_statuses() -> list[dict]:
    """
    Return status rows for all Spark jobs in spark_summaries.
    Excludes the large payload field for brevity.
    """
    rows: list[SparkSummary] = SparkSummary.query.order_by(SparkSummary.job_name).all()
    return [r.status_dict() for r in rows]
