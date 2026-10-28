"""
Spark Job: Monthly Trends — Campus Energy Analysis
====================================================

Reads HDFS energy data and computes monthly aggregated consumption
grouped by (month, canonical building).
Returns an empty list if no genuine timestamped data exists.
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


class MonthlyTrendsJob(BaseSparkJob):
    """Spark job: monthly consumption aggregated and pivoted by building."""

    JOB_NAME = "monthly_trends"

    def transform(self, df: pd.DataFrame) -> list:
        if df.empty:
            return []

        df = df.copy()

        # Check for genuine date / month information
        has_dates = False
        if "timestamp" in df.columns:
            ts = pd.to_datetime(df["timestamp"], errors="coerce")
            valid_ts = ts.dropna()
            if not valid_ts.empty and valid_ts.dt.normalize().nunique() > 1:
                df["month"] = ts.dt.strftime("%Y-%m")
                has_dates = True
        elif all(c in df.columns for c in ("year_num", "month_num")):
            if df["month_num"].nunique() > 1 or df["year_num"].nunique() > 1:
                df["month"] = (
                    df["year_num"].astype(str) + "-"
                    + df["month_num"].astype(str).str.zfill(2)
                )
                has_dates = True

        if not has_dates:
            log.info("[MonthlyTrendsJob] No genuine timestamped multi-month data present — returning empty trends")
            return []

        # Canonicalize building names
        df["canonical_name"] = [
            canonicalize_building(r.get("building_name"), r.get("building_code"))[0]
            for _, r in df.iterrows()
        ]

        # Group by month and canonical building
        monthly = (
            df.groupby(["month", "canonical_name"])["consumption_kwh"]
            .sum()
            .round(2)
            .reset_index()
            .rename(columns={"consumption_kwh": "total_kwh"})
        )

        pivot = (
            monthly.pivot_table(
                index="month",
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

        b_cols = [c for c in pivot.columns if c != "month"]
        pivot["total"] = pivot[b_cols].sum(axis=1).round(2)
        pivot = pivot.sort_values("month").reset_index(drop=True)

        records = pivot.to_dict(orient="records")
        log.info("[MonthlyTrendsJob] %d month rows", len(records))
        return records


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    print(MonthlyTrendsJob().execute())
