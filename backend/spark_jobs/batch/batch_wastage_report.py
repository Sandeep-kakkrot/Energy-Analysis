"""
Batch Job 6: Energy Wastage Report
=====================================
Reads from Hive, computes off-hours (22:00–05:59) and weekend wastage
per building, assigns a severity tier, and writes to batch_wastage_report.

Off-hours definition
--------------------
    hour_of_day < 6   (midnight–05:59)
    hour_of_day >= 22  (22:00–23:59)

Weekend definition
------------------
    is_weekend = TRUE  (day_of_week in {5, 6} — Sat/Sun)
    AND NOT off-hours  (avoid double-counting)

Severity thresholds
-------------------
    high   : wastage_pct >= 35 %
    medium : wastage_pct >= 20 %
    low    : wastage_pct  < 20 %

HiveQL equivalent:
    SELECT
        building_name,
        ROUND(SUM(consumption_kwh), 4)                          AS total_kwh,
        ROUND(SUM(CASE WHEN hour_of_day < 6
                        OR hour_of_day >= 22
                       THEN consumption_kwh ELSE 0 END), 4)     AS off_hours_kwh,
        ROUND(SUM(CASE WHEN is_weekend = TRUE
                        AND NOT (hour_of_day < 6 OR hour_of_day >= 22)
                       THEN consumption_kwh ELSE 0 END), 4)     AS weekend_kwh,
        ROUND((off_hours_kwh + weekend_kwh) / total_kwh * 100, 4) AS wastage_pct,
        CASE WHEN wastage_pct >= 35 THEN 'high'
             WHEN wastage_pct >= 20 THEN 'medium'
             ELSE 'low' END                                     AS severity
    FROM campus_energy.energy_records
    GROUP BY building_name
    ORDER BY wastage_pct DESC;

PySpark equivalent:
    from pyspark.sql import functions as F

    off_cond     = (F.col("hour_of_day") < 6) | (F.col("hour_of_day") >= 22)
    weekend_cond = F.col("is_weekend") & ~off_cond

    result = (
        sdf.groupBy("building_name")
           .agg(
               F.round(F.sum("consumption_kwh"), 4).alias("total_kwh"),
               F.round(F.sum(F.when(off_cond,     F.col("consumption_kwh")).otherwise(0)), 4)
                .alias("off_hours_kwh"),
               F.round(F.sum(F.when(weekend_cond, F.col("consumption_kwh")).otherwise(0)), 4)
                .alias("weekend_kwh"),
           )
           .withColumn("total_wastage_kwh",
               F.round(F.col("off_hours_kwh") + F.col("weekend_kwh"), 4))
           .withColumn("wastage_pct",
               F.round(F.col("total_wastage_kwh") / F.col("total_kwh") * 100, 4))
    )
"""
from __future__ import annotations

import pandas as pd
from .base_batch_job import BaseBatchJob


# ── Severity thresholds ──────────────────────────────────────
_HIGH_PCT   = 35.0
_MEDIUM_PCT = 20.0

# ── Recommendation templates ─────────────────────────────────
_RECOMMENDATIONS = {
    "high": (
        "Implement automated shut-off schedules for non-critical systems "
        "during off-hours and weekends. Consider occupancy-sensor controls "
        "and energy audits to identify major wastage sources."
    ),
    "medium": (
        "Review HVAC and lighting schedules to reduce off-hours consumption. "
        "Deploy smart timers or a building management system (BMS) to "
        "automate equipment shutdown outside operational hours."
    ),
    "low": (
        "Wastage is within acceptable limits. Continue monitoring and "
        "consider minor schedule optimisations to further reduce baseline "
        "idle consumption."
    ),
}


class BatchWastageReport(BaseBatchJob):
    """
    Computes off-hours and weekend energy wastage per building.

    Output table: batch_wastage_report
    Columns: building_name, total_kwh, off_hours_kwh, weekend_kwh,
             total_wastage_kwh, wastage_pct, severity, recommendation
    """

    TABLE_NAME = "batch_wastage_report"
    JOB_LABEL  = "WastageReport"

    def hive_sql(self) -> str:
        """
        Full conditional SUM pushed into Hive/Spark as a single-pass
        distributed aggregation — avoids multiple scans of the dataset.
        """
        return """
            SELECT
                building_name,
                ROUND(SUM(consumption_kwh), 4)
                    AS total_kwh,
                ROUND(SUM(CASE
                    WHEN hour_of_day < 6 OR hour_of_day >= 22
                      OR (building_name IN ('Classroom Block A', 'Central Library', 'Laboratory Block B') AND hour_of_day >= 19)
                    THEN consumption_kwh ELSE 0 END), 4)
                    AS off_hours_kwh,
                ROUND(SUM(CASE
                    WHEN (is_weekend = TRUE
                          OR (building_name IN ('Classroom Block A', 'Central Library', 'Laboratory Block B') AND day_of_week IN (1, 6)))
                     AND NOT (hour_of_day < 6 OR hour_of_day >= 22
                              OR (building_name IN ('Classroom Block A', 'Central Library', 'Laboratory Block B') AND hour_of_day >= 19))
                    THEN consumption_kwh ELSE 0 END), 4)
                    AS weekend_kwh
            FROM campus_energy.energy_records
            GROUP BY building_name
            ORDER BY building_name
        """

    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        PySpark: conditional F.when() inside .agg() — single dataset pass.

        Mirrors:
            sdf.groupBy("building_name")
               .agg(
                   F.sum("consumption_kwh"),
                   F.sum(F.when(off_cond,     col).otherwise(0)),
                   F.sum(F.when(weekend_cond, col).otherwise(0)),
               )
        """
        from spark_jobs.building_normalizer import canonicalize_building
        from spark_jobs.hostel_closure_manager import calculate_hostel_wastage, load_closure_config

        df = df.copy()
        canon = [canonicalize_building(r.get("building_name"), r.get("building_code")) for _, r in df.iterrows()]
        df["building_name"] = [c[0] for c in canon]
        df["building_code"] = [c[1] for c in canon]

        closure_cfg = load_closure_config()

        # ── Academic buildings conditional masks ──
        is_academic = df["building_name"].isin([
            "Classroom Block A", "Central Library", "Laboratory Block B"
        ])
        has_hours = "hour_of_day" in df.columns and df["hour_of_day"].nunique() > 1
        has_days = "day_of_week" in df.columns and df["day_of_week"].nunique() > 1

        # Check if dataset has explicit wastage columns for academic buildings
        has_explicit = "total_wastage_kwh" in df.columns and ("off_hours_kwh" in df.columns or "off-hours_kwh" in df.columns)

        if has_explicit:
            off_col = "off_hours_kwh" if "off_hours_kwh" in df.columns else "off-hours_kwh"
            acad_df = df[is_academic].copy()
            acad_agg = (
                acad_df.groupby("building_name", sort=True)
                .agg(
                    total_kwh        = ("consumption_kwh", "sum"),
                    off_hours_kwh    = (off_col,           "sum"),
                    weekend_kwh      = ("weekend_kwh",     "sum") if "weekend_kwh" in df.columns else ("consumption_kwh", lambda x: 0.0),
                    total_wastage_kwh= ("total_wastage_kwh","sum"),
                )
                .reset_index()
            )
        else:
            if has_hours:
                is_sunday = df["day_of_week"].isin([0, 6, 7]) if has_days else False
                off_mask     = is_academic & ((df["hour_of_day"] < 6) | (df["hour_of_day"] >= 19))
                weekend_mask = is_academic & is_sunday & ~off_mask

                df["_off_kwh"]     = df["consumption_kwh"].where(off_mask,     other=0.0)
                df["_weekend_kwh"] = df["consumption_kwh"].where(weekend_mask, other=0.0)
            else:
                df["_off_kwh"] = 0.0
                df["_weekend_kwh"] = 0.0

            acad_df = df[is_academic]
            acad_agg = (
                acad_df.groupby("building_name", sort=True)
                .agg(
                    total_kwh    = ("consumption_kwh", "sum"),
                    off_hours_kwh= ("_off_kwh",        "sum"),
                    weekend_kwh  = ("_weekend_kwh",    "sum"),
                )
                .reset_index()
            )
            acad_agg["total_wastage_kwh"] = acad_agg["off_hours_kwh"] + acad_agg["weekend_kwh"]

        acad_agg["total_wastage_kwh"] = acad_agg["total_wastage_kwh"].round(4)
        acad_agg["wastage_pct"] = (
            acad_agg["total_wastage_kwh"] / acad_agg["total_kwh"].replace(0, float("nan")) * 100
        ).fillna(0.0).round(4)
        acad_agg["total_kwh"]     = acad_agg["total_kwh"].round(4)
        acad_agg["off_hours_kwh"] = acad_agg["off_hours_kwh"].round(4)
        acad_agg["weekend_kwh"]   = acad_agg["weekend_kwh"].round(4)

        def _severity(pct: float) -> str:
            if pct >= _HIGH_PCT:
                return "high"
            if pct >= _MEDIUM_PCT:
                return "medium"
            return "low"

        acad_agg["severity"] = acad_agg["wastage_pct"].apply(_severity)
        acad_agg["recommendation"] = acad_agg["severity"].map(_RECOMMENDATIONS)
        acad_agg["is_na"] = False
        acad_agg["status_text"] = "Standard Audit"

        # ── Hostel Complex profile ──
        hostel_prof = calculate_hostel_wastage(df, closure_cfg)
        hostel_row = pd.DataFrame([{
            "building_name":    "Hostel Complex",
            "total_kwh":        round(float(hostel_prof.get("total_kwh", 0.0)), 4),
            "off_hours_kwh":    round(float(hostel_prof.get("off_hours_kwh", 0.0)), 4),
            "weekend_kwh":      0.0,
            "total_wastage_kwh":round(float(hostel_prof.get("wastage_kwh", 0.0)), 4),
            "wastage_pct":      round(float(hostel_prof.get("wastage_pct") or 0.0), 4),
            "severity":         hostel_prof.get("severity", "n/a"),
            "recommendation":   hostel_prof.get("recommendation", ""),
            "is_na":            hostel_prof.get("is_na", True),
            "status_text":      hostel_prof.get("status_text", "N/A – Hostel Operates 24/7"),
        }])

        combined = pd.concat([acad_agg, hostel_row], ignore_index=True)

        # Sort: academic buildings by wastage_pct descending, N/A at end
        def _sort_score(row):
            if row["severity"] == "n/a" or row.get("is_na"):
                return -1.0
            return float(row["wastage_pct"])

        combined["_score"] = combined.apply(_sort_score, axis=1)
        combined = combined.sort_values("_score", ascending=False).drop(columns=["_score"]).reset_index(drop=True)

        return combined
