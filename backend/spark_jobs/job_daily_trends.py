"""
Spark Job: Daily Trends — Campus Energy Analysis
==================================================

Reads HDFS energy data and computes daily aggregated consumption
broken down by canonical building, for all available dates.
Only computes trends if genuine timestamped / multi-day data exists;
otherwise returns an empty list.
"""
from __future__ import annotations

import logging
import pandas as pd

from spark_jobs.base_job import BaseSparkJob
from spark_jobs.building_normalizer import canonicalize_building

log = logging.getLogger(__name__)

CANONICAL_BUILDING_NAMES = [
    "Classroom Block A",
    "Laboratory Block B",
    "Central Library",
    "Hostel Complex",
]


class DailyTrendsJob(BaseSparkJob):
    """Spark job: daily consumption time-series broken down by building."""

    JOB_NAME = "daily_trends"

    def transform(self, df: pd.DataFrame) -> list:
        if df.empty:
            return []

        df = df.copy()

        # Check for genuine date information
        has_dates = False
        if "timestamp" in df.columns:
            ts = pd.to_datetime(df["timestamp"], errors="coerce")
            valid_ts = ts.dropna()
            if not valid_ts.empty and valid_ts.dt.normalize().nunique() > 1:
                df["date"] = ts.dt.strftime("%Y-%m-%d")
                has_dates = True
        elif all(c in df.columns for c in ("year_num", "month_num", "day_of_month")):
            date_col = (
                df["year_num"].astype(str) + "-"
                + df["month_num"].astype(str).str.zfill(2) + "-"
                + df["day_of_month"].astype(str).str.zfill(2)
            )
            if date_col.nunique() > 1:
                df["date"] = date_col
                has_dates = True

        if not has_dates:
            log.info("[DailyTrendsJob] No genuine timestamped multi-day data present — returning empty trends")
            return []

        # Canonicalize building names
        df["canonical_name"] = [
            canonicalize_building(r.get("building_name"), r.get("building_code"))[0]
            for _, r in df.iterrows()
        ]

        # Group by date and canonical building
        daily = (
            df.groupby(["date", "canonical_name"])["consumption_kwh"]
            .sum()
            .round(2)
            .reset_index()
            .rename(columns={"consumption_kwh": "total_kwh"})
        )

        pivot = (
            daily.pivot_table(
                index="date",
                columns="canonical_name",
                values="total_kwh",
                fill_value=0.0,
            )
            .reset_index()
        )
        pivot.columns.name = None

        # Ensure all canonical buildings exist as columns
        for bname in CANONICAL_BUILDING_NAMES:
            if bname not in pivot.columns:
                pivot[bname] = 0.0

        b_cols = [c for c in pivot.columns if c != "date"]
        pivot["total"] = pivot[b_cols].sum(axis=1).round(2)
        pivot["rec_date"] = pivot["date"]  # compatibility
        pivot = pivot.sort_values("date").reset_index(drop=True)

        records = pivot.to_dict(orient="records")
        log.info("[DailyTrendsJob] %d date rows computed", len(records))
        return records


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    r = DailyTrendsJob().execute()
    print(r)
