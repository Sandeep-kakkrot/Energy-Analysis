"""
Spark Job: Dashboard Summary — Campus Energy Analysis
=======================================================

Reads the full HDFS energy dataset and computes the KPI values:
  - total_kwh        Total electricity consumed across all buildings
  - avg_daily_kwh    Average electricity consumed per calendar day (if timestamped)
  - peak_hour        Hour of day (0–23) with highest total consumption (if timestamped)
  - wastage_pct      Share (%) of potential energy wastage
  - has_timestamps   Boolean flag indicating if genuine timestamped data exists
"""
from __future__ import annotations

import logging
import pandas as pd

from spark_jobs.base_job import BaseSparkJob
from spark_jobs.building_normalizer import canonicalize_building

log = logging.getLogger(__name__)


class DashboardSummaryJob(BaseSparkJob):
    """Spark job that computes dashboard KPI metrics from HDFS data."""

    JOB_NAME = "dashboard_summary"

    def transform(self, df: pd.DataFrame) -> dict:
        if df.empty:
            return {
                "total_kwh": 0, "avg_daily_kwh": 0,
                "peak_hour": None, "wastage_pct": 0,
                "total_records": 0, "has_timestamps": False,
                "date_range": {}
            }

        df = df.copy()

        # Canonicalize buildings
        canon_names = [canonicalize_building(r.get("building_name"), r.get("building_code"))[0] for _, r in df.iterrows()]
        df["canonical_name"] = canon_names

        total_kwh = round(float(df["consumption_kwh"].sum()), 2)

        # Check for genuine timestamped data
        has_timestamps = False
        date_range: dict = {}
        distinct_dates_count = 0

        if "timestamp" in df.columns:
            ts = pd.to_datetime(df["timestamp"], errors="coerce").dropna()
            if not ts.empty:
                distinct_dates = ts.dt.normalize().nunique()
                if distinct_dates > 1:
                    has_timestamps = True
                    distinct_dates_count = distinct_dates
                    date_range = {
                        "from": str(ts.min()),
                        "to":   str(ts.max()),
                    }
        elif all(c in df.columns for c in ("year_num", "month_num", "day_of_month")):
            date_col = (
                df["year_num"].astype(str) + "-" +
                df["month_num"].astype(str).str.zfill(2) + "-" +
                df["day_of_month"].astype(str).str.zfill(2)
            )
            distinct_dates = date_col.nunique()
            if distinct_dates > 1:
                has_timestamps = True
                distinct_dates_count = distinct_dates
                date_range = {
                    "from": str(date_col.min()),
                    "to":   str(date_col.max()),
                }

        # Daily usage
        if has_timestamps and distinct_dates_count > 0:
            if "timestamp" in df.columns:
                daily_totals = df.groupby(pd.to_datetime(df["timestamp"], errors="coerce").dt.date)["consumption_kwh"].sum()
            else:
                daily_totals = df.groupby(["year_num", "month_num", "day_of_month"])["consumption_kwh"].sum()
            avg_daily_kwh = round(float(daily_totals.mean()), 2)
        else:
            avg_daily_kwh = None

        # Peak hour
        peak_hour = None
        if "hour_of_day" in df.columns:
            hour_counts = df["hour_of_day"].nunique()
            if hour_counts > 1:
                hour_totals = df.groupby("hour_of_day")["consumption_kwh"].sum()
                peak_hour = int(hour_totals.idxmax())

        # Wastage calculation
        # Load hostel closure configuration
        from spark_jobs.hostel_closure_manager import calculate_hostel_wastage, load_closure_config
        closure_cfg = load_closure_config()

        is_academic = df["canonical_name"].isin([
            "Classroom Block A", "Central Library", "Laboratory Block B"
        ])
        has_hours = "hour_of_day" in df.columns and df["hour_of_day"].nunique() > 1
        has_days = "day_of_week" in df.columns and df["day_of_week"].nunique() > 1

        # 1. Academic wastage (Classroom Block A, Laboratory Block B, Central Library)
        has_explicit_total_waste = "total_wastage_kwh" in df.columns
        if has_explicit_total_waste:
            academic_waste = float(
                pd.to_numeric(df.loc[is_academic, "total_wastage_kwh"], errors="coerce").fillna(0).sum()
            )
        elif has_hours:
            is_academic_off = is_academic & ((df["hour_of_day"] < 6) | (df["hour_of_day"] >= 19))
            is_sunday = df["day_of_week"].isin([0, 6, 7]) if has_days else False
            is_academic_sunday = is_academic & is_sunday & ~is_academic_off
            academic_mask = is_academic_off | is_academic_sunday
            academic_waste = float(df.loc[academic_mask, "consumption_kwh"].sum())
        else:
            academic_waste = 0.0

        # 2. Hostel Complex: 24/7 normal operation + closure rule
        hostel_profile = calculate_hostel_wastage(df, closure_cfg)
        hostel_waste = float(hostel_profile.get("wastage_kwh", 0.0))

        # 3. Overall campus wastage
        total_waste = academic_waste + hostel_waste
        wastage_pct = round(total_waste / total_kwh * 100, 2) if total_kwh else 0.0

        log.info(
            "[DashboardSummaryJob] total=%.2f kWh | avg_daily=%s | peak_hour=%s | wastage=%.2f%% | has_timestamps=%s",
            total_kwh, str(avg_daily_kwh), str(peak_hour), wastage_pct, has_timestamps
        )

        return {
            "total_kwh":      total_kwh,
            "avg_daily_kwh":  avg_daily_kwh,
            "peak_hour":      peak_hour,
            "wastage_pct":    wastage_pct,
            "total_records":  len(df),
            "has_timestamps": has_timestamps,
            "date_range":     date_range,
        }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    result = DashboardSummaryJob().execute()
    print(result)
