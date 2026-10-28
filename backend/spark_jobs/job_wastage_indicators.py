"""
Spark Job: Wastage Indicators — Campus Energy Analysis
=======================================================

Reads HDFS energy data and computes per-building energy wastage:
  - off_hours_kwh  : consumption during off-hours (unoccupied hours)
  - weekend_kwh    : consumption on weekends during work hours
  - wastage_kwh    : off_hours_kwh + weekend_kwh
  - wastage_pct    : total wastage as % of building's total consumption
  - severity       : "high" (>25%) | "medium" (>15%) | "low"
  - recommendation : actionable suggestion per severity × building type

Rule-based potential wastage detection using Apache Spark aggregation patterns.
No machine learning.
"""
from __future__ import annotations

import logging
import pandas as pd

from spark_jobs.base_job import BaseSparkJob
from spark_jobs.building_normalizer import canonicalize_building, CANONICAL_BUILDINGS
from spark_jobs.hostel_closure_manager import calculate_hostel_wastage, load_closure_config

log = logging.getLogger(__name__)

# Actionable recommendation lookup (deterministic rule table)
_RECOMMENDATIONS: dict[tuple[str, str], str] = {
    ("high",   "hostel"):     "Hostel closure period: High excess draw detected. Audit baseline equipment.",
    ("high",   "laboratory"): "Review lab equipment shutdown schedules. Significant off-hours load.",
    ("high",   "classroom"):  "Automated lighting/AC shutoff recommended during off-hours.",
    ("high",   "library"):    "Consider motion-sensor lighting and scheduled HVAC timers.",
    ("medium", "hostel"):     "Hostel closure period: Standby threshold exceeded. Verify refrigeration/pumps.",
    ("medium", "laboratory"): "Verify refrigeration/incubator necessity during weekends.",
    ("medium", "classroom"):  "Enable power-saving mode on projectors and PCs after hours.",
    ("medium", "library"):    "Review extended-hours energy patterns.",
    ("low",    "hostel"):     "Standby consumption within acceptable limits during closure.",
    ("low",    "laboratory"): "Good energy discipline. Periodic audits recommended.",
    ("low",    "classroom"):  "Optimal off-hours usage. Maintain current practices.",
    ("low",    "library"):    "Energy profile is healthy. Continue good practices.",
    ("n/a",    "hostel"):     "Hostel operates 24/7. Continuous occupancy during academic semester — no off-hours wastage flagged.",
}


def _classify_severity(wastage_pct: float | None) -> str:
    if wastage_pct is None:
        return "n/a"
    if wastage_pct >= 25.0:
        return "high"
    if wastage_pct >= 15.0:
        return "medium"
    return "low"


class WastageIndicatorsJob(BaseSparkJob):
    """Spark job: off-hours wastage for academic buildings and closure-based wastage for 24/7 hostel."""

    JOB_NAME = "wastage_indicators"

    def transform(self, df: pd.DataFrame) -> list:
        if df.empty:
            return []

        df = df.copy()

        # Canonicalize buildings
        canon_info = [
            canonicalize_building(r.get("building_name"), r.get("building_code"))
            for _, r in df.iterrows()
        ]
        df["canonical_name"] = [t[0] for t in canon_info]
        df["canonical_type"] = [t[2] for t in canon_info]

        total_df = df.groupby("canonical_name")["consumption_kwh"].sum().rename("total_kwh")

        # Load hostel closure configuration
        closure_cfg = load_closure_config()

        # ─────────────────────────────────────────────────────────────
        # 1. Academic buildings: rule-based off-hours & curfew wastage
        #    Classroom Block A, Laboratory Block B, Central Library
        # ─────────────────────────────────────────────────────────────
        is_academic = df["canonical_name"].isin([
            "Classroom Block A", "Central Library", "Laboratory Block B"
        ])
        has_hours = "hour_of_day" in df.columns and df["hour_of_day"].nunique() > 1
        has_days = "day_of_week" in df.columns and df["day_of_week"].nunique() > 1

        # Check for explicit wastage columns for academic buildings
        has_explicit_waste = "total_wastage_kwh" in df.columns and ("off_hours_kwh" in df.columns or "off-hours_kwh" in df.columns)
        off_col = "off_hours_kwh" if "off_hours_kwh" in df.columns else ("off-hours_kwh" if "off-hours_kwh" in df.columns else None)

        if has_explicit_waste:
            academic_df = df[is_academic].copy()
            if not academic_df.empty:
                acad_totals = academic_df.groupby("canonical_name")["consumption_kwh"].sum().rename("total_kwh")
                acad_off = academic_df.groupby("canonical_name")[off_col].sum().rename("off_hours_kwh") if off_col else pd.Series(0.0, index=acad_totals.index)
                acad_wknd = academic_df.groupby("canonical_name")["weekend_kwh"].sum().rename("weekend_kwh") if "weekend_kwh" in academic_df.columns else pd.Series(0.0, index=acad_totals.index)
                acad_waste = academic_df.groupby("canonical_name")["total_wastage_kwh"].sum().rename("wastage_kwh")
                acad_agg = pd.concat([acad_totals, acad_off, acad_wknd, acad_waste], axis=1).fillna(0.0).reset_index()
            else:
                acad_agg = pd.DataFrame()
        elif has_hours:
            # Rule 1: Global academic off-hours (22:00–05:59)
            # Rule 2: Academic after-7-PM curfew (19:00+)
            df["is_academic_off_hours"] = is_academic & ((df["hour_of_day"] < 6) | (df["hour_of_day"] >= 19))
            is_sunday = df["day_of_week"].isin([0, 6, 7]) if has_days else False
            df["is_academic_sunday"] = is_academic & is_sunday & ~df["is_academic_off_hours"]

            acad_df = df[is_academic]
            acad_totals = acad_df.groupby("canonical_name")["consumption_kwh"].sum().rename("total_kwh")
            acad_off = df[df["is_academic_off_hours"]].groupby("canonical_name")["consumption_kwh"].sum().rename("off_hours_kwh")
            acad_wknd = df[df["is_academic_sunday"]].groupby("canonical_name")["consumption_kwh"].sum().rename("weekend_kwh")

            acad_agg = pd.concat([acad_totals, acad_off, acad_wknd], axis=1).fillna(0.0).reset_index()
            acad_agg["wastage_kwh"] = acad_agg["off_hours_kwh"] + acad_agg["weekend_kwh"]
        else:
            acad_df = df[is_academic]
            acad_totals = acad_df.groupby("canonical_name")["consumption_kwh"].sum().rename("total_kwh")
            acad_agg = acad_totals.to_frame().reset_index()
            acad_agg["off_hours_kwh"] = 0.0
            acad_agg["weekend_kwh"] = 0.0
            acad_agg["wastage_kwh"] = 0.0

        output = []

        # Populate academic results
        if not acad_agg.empty:
            for _, row in acad_agg.iterrows():
                bname = str(row["canonical_name"])
                total = float(row["total_kwh"])
                off_hrs = float(row.get("off_hours_kwh", 0.0))
                wknd = float(row.get("weekend_kwh", 0.0))
                wastage = float(row.get("wastage_kwh", off_hrs + wknd))

                w_pct = round(wastage / total * 100, 2) if total > 0 else 0.0
                severity = _classify_severity(w_pct)

                default_meta = CANONICAL_BUILDINGS.get(bname, {})
                btype = default_meta.get("type", "classroom")

                output.append({
                    "building_name":  bname,
                    "building_type":  btype,
                    "total_kwh":      round(total, 2),
                    "off_hours_kwh":  round(off_hrs, 2),
                    "weekend_kwh":    round(wknd, 2),
                    "wastage_kwh":    round(wastage, 2),
                    "wastage_pct":    w_pct,
                    "display_pct":    f"{w_pct:.1f}%",
                    "is_na":          False,
                    "status_text":    "Standard Audit",
                    "severity":       severity,
                    "recommendation": _RECOMMENDATIONS.get(
                        (severity, btype), "Conduct an energy audit for further insights."
                    ),
                })

        # ─────────────────────────────────────────────────────────────
        # 2. Hostel Complex: 24/7 normal operation + closure rule
        #    Never flag night or weekend consumption during normal semester
        # ─────────────────────────────────────────────────────────────
        hostel_profile = calculate_hostel_wastage(df, closure_cfg)
        output.append(hostel_profile)

        # ─────────────────────────────────────────────────────────────
        # 3. Sort: real wastage first (descending), N/A buildings at end
        # ─────────────────────────────────────────────────────────────
        def _sort_key(item: dict) -> tuple[int, float]:
            if item.get("is_na") or item.get("severity") == "n/a" or item.get("wastage_pct") is None:
                return (1, 0.0)
            return (0, -float(item.get("wastage_pct", 0.0)))

        output.sort(key=_sort_key)
        log.info("[WastageIndicatorsJob] %d buildings classified (Hostel status: %s)",
                 len(output), hostel_profile.get("status_text"))
        return output


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    print(WastageIndicatorsJob().execute())
