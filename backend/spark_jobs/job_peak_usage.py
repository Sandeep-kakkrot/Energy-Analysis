"""
Spark Job: Peak Usage — Campus Energy Analysis
===============================================

Reads HDFS energy data and produces:
  - heatmap       : 24h × 7-day grid of average kWh (hour × day_of_week)
  - top_hours     : ranked list of peak consumption hours (0–23)
  - top_days      : ranked list of peak consumption days (Mon–Sun)
  - peak_building : canonical building contributing most to peak hours
"""
from __future__ import annotations

import logging
import pandas as pd

from spark_jobs.base_job import BaseSparkJob
from spark_jobs.building_normalizer import canonicalize_building

log = logging.getLogger(__name__)

DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


class PeakUsageJob(BaseSparkJob):
    """Spark job: 24h × 7-day heatmap + ranked peak hours/days."""

    JOB_NAME = "peak_usage"

    def transform(self, df: pd.DataFrame) -> dict:
        if df.empty:
            return {"heatmap": [], "top_hours": [], "top_days": [], "peak_building": None, "has_hourly_data": False}

        df = df.copy()

        # Check if genuine hourly & day variance exists
        has_hours = "hour_of_day" in df.columns and df["hour_of_day"].nunique() > 1
        has_days = "day_of_week" in df.columns and df["day_of_week"].nunique() > 1

        if not has_hours or not has_days:
            log.info("[PeakUsageJob] No genuine hourly or day-of-week variance present — returning empty peak usage")
            return {
                "heatmap": [],
                "top_hours": [],
                "top_days": [],
                "peak_building": None,
                "has_hourly_data": False,
            }

        # Canonicalize building names
        df["canonical_name"] = [
            canonicalize_building(r.get("building_name"), r.get("building_code"))[0]
            for _, r in df.iterrows()
        ]

        # Per-building hourly/day avg
        per_building = (
            df.groupby(["hour_of_day", "day_of_week", "canonical_name"])["consumption_kwh"]
            .mean()
            .round(4)
            .reset_index()
            .rename(columns={"consumption_kwh": "avg_kwh"})
        )

        # Sum across canonical buildings per (hour, day) for heatmap
        heatmap_df = (
            per_building
            .groupby(["hour_of_day", "day_of_week"])["avg_kwh"]
            .sum()
            .reset_index()
        )
        heatmap = [
            {
                "hour":     int(r["hour_of_day"]),
                "day":      int(r["day_of_week"]),
                "day_name": DAY_NAMES[int(r["day_of_week"]) % 7],
                "avg_kwh":  round(float(r["avg_kwh"]), 2),
            }
            for _, r in heatmap_df.iterrows()
        ]

        # Top hours
        top_hours_df = (
            df.groupby("hour_of_day")["consumption_kwh"]
            .mean()
            .sort_values(ascending=False)
            .round(2)
            .reset_index()
        )
        top_hours = [
            {"hour": int(r["hour_of_day"]), "avg_kwh": round(float(r["consumption_kwh"]), 2)}
            for _, r in top_hours_df.iterrows()
        ]

        # Top days
        top_days_df = (
            df.groupby("day_of_week")["consumption_kwh"]
            .mean()
            .sort_values(ascending=False)
            .round(2)
            .reset_index()
        )
        top_days = [
            {
                "day":      int(r["day_of_week"]),
                "day_name": DAY_NAMES[int(r["day_of_week"]) % 7],
                "avg_kwh":  round(float(r["consumption_kwh"]), 2),
            }
            for _, r in top_days_df.iterrows()
        ]

        # Peak building at top peak hours
        top3_hours = [h["hour"] for h in top_hours[:3]]
        peak_df = per_building[per_building["hour_of_day"].isin(top3_hours)]
        peak_building = None
        if not peak_df.empty:
            peak_building = str(
                peak_df.groupby("canonical_name")["avg_kwh"].sum().idxmax()
            )

        log.info(
            "[PeakUsageJob] %d heatmap cells | peak_hour=%s | peak_building=%s",
            len(heatmap), top_hours[0]["hour"] if top_hours else "?", peak_building,
        )

        return {
            "heatmap":       heatmap,
            "top_hours":     top_hours,
            "top_days":      top_days,
            "peak_building": peak_building,
            "has_hourly_data": True,
        }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    print(PeakUsageJob().execute())
