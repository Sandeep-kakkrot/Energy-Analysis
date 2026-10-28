"""
Hostel Closure Configuration & Wastage Manager — Campus Energy Analysis
=======================================================================
Manages officially declared hostel closure periods (vacations, semester breaks)
and standby load threshold for the 24/7 Hostel Complex.

Rules:
1. Hostels operate 24/7 during normal semesters — nighttime, after-7-PM,
   Sunday, and weekend usage is normal student activity, NOT wastage.
2. Wastage is only evaluated during confirmed closure periods when students
   have vacated the building.
3. During closure, only consumption exceeding the configurable standby threshold
   is flagged as potential wastage: max(0.0, consumption_kwh - standby_threshold_kwh).
4. If closure is not active or data lacks timestamps, returns N/A indicators.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, date
from pathlib import Path
from typing import Any

import pandas as pd

log = logging.getLogger(__name__)

# File-based fallback path for standalone Spark jobs and persistence
CONFIG_FILE_PATH = Path(__file__).resolve().parent.parent / "data" / "hostel_closure_config.json"

DEFAULT_CONFIG: dict[str, Any] = {
    "is_active": False,
    "start_date": None,               # e.g. "2024-06-01"
    "end_date": None,                 # e.g. "2024-07-31"
    "standby_threshold_kwh": 50.0,     # Baseline essential standby load (security, fridge, pumps)
    "closure_reason": "Semester Vacation / Holiday Break",
    "updated_at": datetime.utcnow().isoformat(),
}


def load_closure_config() -> dict[str, Any]:
    """
    Load hostel closure configuration from file.
    Creates default configuration file if none exists.
    """
    if not CONFIG_FILE_PATH.exists():
        save_closure_config(DEFAULT_CONFIG)
        return dict(DEFAULT_CONFIG)

    try:
        with open(CONFIG_FILE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Ensure all default keys exist
            merged = {**DEFAULT_CONFIG, **data}
            return merged
    except Exception as exc:
        log.warning("[HostelClosureManager] Error reading config file %s: %s", CONFIG_FILE_PATH, exc)
        return dict(DEFAULT_CONFIG)


def save_closure_config(cfg: dict[str, Any]) -> dict[str, Any]:
    """
    Save hostel closure configuration to file.
    Ensures directory exists and timestamps the update.
    """
    CONFIG_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    clean_cfg = {
        "is_active": bool(cfg.get("is_active", False)),
        "start_date": str(cfg.get("start_date")).strip() if cfg.get("start_date") else None,
        "end_date": str(cfg.get("end_date")).strip() if cfg.get("end_date") else None,
        "standby_threshold_kwh": max(0.0, float(cfg.get("standby_threshold_kwh", 50.0))),
        "closure_reason": str(cfg.get("closure_reason", "Semester Vacation")).strip() or "Semester Vacation",
        "updated_at": datetime.utcnow().isoformat(),
    }

    # Normalize empty date strings to None
    if not clean_cfg["start_date"] or clean_cfg["start_date"].lower() in ("null", "none", ""):
        clean_cfg["start_date"] = None
    if not clean_cfg["end_date"] or clean_cfg["end_date"].lower() in ("null", "none", ""):
        clean_cfg["end_date"] = None

    with open(CONFIG_FILE_PATH, "w", encoding="utf-8") as f:
        json.dump(clean_cfg, f, indent=2)

    log.info("[HostelClosureManager] Saved closure configuration: %s", clean_cfg)
    return clean_cfg


def calculate_hostel_wastage(df: pd.DataFrame, config: dict[str, Any] | None = None) -> dict[str, Any]:
    """
    Calculate hostel energy wastage based on 24/7 normal operation and closure rules.

    Parameters
    ----------
    df : pd.DataFrame
        Records for the hostel (or all records containing canonical_name == 'Hostel Complex').
    config : dict, optional
        Closure configuration dict. If None, loads from file.

    Returns
    -------
    dict
        Hostel wastage profile with:
        - is_closure_active: bool
        - is_na: bool
        - status_text: str (e.g. "N/A – Hostel Operates 24/7" or "Closure Active")
        - off_hours_kwh: float (0.0 during normal operation, or excess during closure)
        - weekend_kwh: float (always 0.0 for hostel)
        - wastage_kwh: float
        - wastage_pct: float | None
        - display_pct: str
        - severity: "n/a" | "low" | "medium" | "high"
        - recommendation: str
    """
    if config is None:
        config = load_closure_config()

    is_active = bool(config.get("is_active", False))
    start_date_str = config.get("start_date")
    end_date_str = config.get("end_date")
    standby_threshold = float(config.get("standby_threshold_kwh", 50.0))
    reason = config.get("closure_reason", "Semester Vacation")

    # Filter df for hostel records if full campus df is passed
    if "canonical_name" in df.columns:
        hostel_df = df[df["canonical_name"] == "Hostel Complex"].copy()
    elif "building_name" in df.columns:
        hostel_df = df[df["building_name"].str.contains("Hostel", case=False, na=False)].copy()
    else:
        hostel_df = df.copy()

    total_kwh = float(hostel_df["consumption_kwh"].sum()) if not hostel_df.empty and "consumption_kwh" in hostel_df.columns else 0.0

    # ─────────────────────────────────────────────────────────────
    # CASE 1: Normal Operation (Closure is INACTIVE or dates not set)
    # ─────────────────────────────────────────────────────────────
    if not is_active or not start_date_str or not end_date_str:
        return {
            "building_name": "Hostel Complex",
            "building_type": "hostel",
            "is_closure_active": False,
            "is_na": True,
            "status_text": "N/A – Hostel Operates 24/7",
            "total_kwh": round(total_kwh, 2),
            "off_hours_kwh": 0.0,
            "weekend_kwh": 0.0,
            "wastage_kwh": 0.0,
            "wastage_pct": None,
            "display_pct": "N/A – Hostel Operates 24/7",
            "severity": "n/a",
            "standby_threshold_kwh": standby_threshold,
            "closure_window": None,
            "recommendation": (
                "Hostel operates 24/7 with continuous student residency. "
                "Nighttime, after-7-PM and weekend consumption reflects normal student living — "
                "no off-hours wastage flagged during normal operation."
            ),
        }

    # ─────────────────────────────────────────────────────────────
    # CASE 2: Closure is ACTIVE — verify date/timestamp support
    # ─────────────────────────────────────────────────────────────
    # Extract date series from dataset
    date_series = None
    if "timestamp" in hostel_df.columns:
        try:
            date_series = pd.to_datetime(hostel_df["timestamp"], errors="coerce").dt.date
        except Exception:
            date_series = None
    elif "date" in hostel_df.columns:
        try:
            date_series = pd.to_datetime(hostel_df["date"], errors="coerce").dt.date
        except Exception:
            date_series = None
    elif {"year_num", "month_num", "day_of_month"}.issubset(hostel_df.columns):
        try:
            date_series = pd.to_datetime(
                hostel_df["year_num"].astype(str) + "-" +
                hostel_df["month_num"].astype(str).str.zfill(2) + "-" +
                hostel_df["day_of_month"].astype(str).str.zfill(2),
                errors="coerce"
            ).dt.date
        except Exception:
            date_series = None

    # Check if dates could be extracted and have more than 1 distinct value
    if date_series is None or date_series.dropna().nunique() <= 1:
        log.info("[HostelClosureManager] Closure active but dataset has no timestamped dates")
        return {
            "building_name": "Hostel Complex",
            "building_type": "hostel",
            "is_closure_active": True,
            "is_na": True,
            "status_text": "N/A – Closure Data Unavailable",
            "total_kwh": round(total_kwh, 2),
            "off_hours_kwh": 0.0,
            "weekend_kwh": 0.0,
            "wastage_kwh": 0.0,
            "wastage_pct": None,
            "display_pct": "N/A – Closure Data Unavailable",
            "severity": "n/a",
            "standby_threshold_kwh": standby_threshold,
            "closure_window": f"{start_date_str} to {end_date_str}",
            "recommendation": (
                f"Hostel closure declared ({reason} from {start_date_str} to {end_date_str}). "
                "However, the active dataset lacks timestamped readings to isolate the closure window. "
                "Upload timestamped data to evaluate closure-period standby wastage."
            ),
        }

    try:
        start_d = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        end_d = datetime.strptime(end_date_str, "%Y-%m-%d").date()
    except Exception as exc:
        log.warning("[HostelClosureManager] Invalid closure date format: %s", exc)
        return {
            "building_name": "Hostel Complex",
            "building_type": "hostel",
            "is_closure_active": False,
            "is_na": True,
            "status_text": "N/A – Invalid Closure Dates",
            "total_kwh": round(total_kwh, 2),
            "off_hours_kwh": 0.0,
            "weekend_kwh": 0.0,
            "wastage_kwh": 0.0,
            "wastage_pct": None,
            "display_pct": "N/A",
            "severity": "n/a",
            "standby_threshold_kwh": standby_threshold,
            "closure_window": None,
            "recommendation": "Correct the closure start and end dates format (YYYY-MM-DD).",
        }

    # Mask records that fall within the confirmed closure window
    hostel_df["_rec_date"] = date_series
    closure_mask = (hostel_df["_rec_date"] >= start_d) & (hostel_df["_rec_date"] <= end_d)
    closure_records = hostel_df[closure_mask]

    if closure_records.empty:
        return {
            "building_name": "Hostel Complex",
            "building_type": "hostel",
            "is_closure_active": True,
            "is_na": True,
            "status_text": "N/A – No Closure in Data Period",
            "total_kwh": round(total_kwh, 2),
            "off_hours_kwh": 0.0,
            "weekend_kwh": 0.0,
            "wastage_kwh": 0.0,
            "wastage_pct": None,
            "display_pct": "N/A – No Closure in Data Period",
            "severity": "n/a",
            "standby_threshold_kwh": standby_threshold,
            "closure_window": f"{start_date_str} to {end_date_str}",
            "recommendation": (
                f"Hostel operates 24/7 during semester. Configured closure ({start_date_str} to {end_date_str}) "
                "does not overlap with the date range of the active dataset."
            ),
        }

    # ─────────────────────────────────────────────────────────────
    # CASE 3: Confirmed closure records found — calculate excess load
    # ─────────────────────────────────────────────────────────────
    closure_kwh = float(closure_records["consumption_kwh"].sum())
    # Potential wastage = consumption above essential standby threshold
    excess_series = closure_records["consumption_kwh"].apply(lambda v: max(0.0, float(v) - standby_threshold))
    wastage_kwh = float(excess_series.sum())

    # Wastage percentage relative to building total
    w_pct = round(wastage_kwh / total_kwh * 100, 2) if total_kwh > 0 else 0.0

    if w_pct >= 25.0:
        severity = "high"
    elif w_pct >= 15.0:
        severity = "medium"
    else:
        severity = "low"

    return {
        "building_name": "Hostel Complex",
        "building_type": "hostel",
        "is_closure_active": True,
        "closure_active": True,
        "is_na": False,
        "status_text": f"Closure Active ({start_date_str} to {end_date_str})",
        "total_kwh": round(total_kwh, 2),
        "off_hours_kwh": round(wastage_kwh, 2),
        "weekend_kwh": 0.0,
        "wastage_kwh": round(wastage_kwh, 2),
        "wastage_pct": w_pct,
        "display_pct": f"{w_pct}%",
        "severity": severity,
        "standby_threshold_kwh": standby_threshold,
        "closure_window": f"{start_date_str} to {end_date_str}",
        "closure_period": f"{start_date_str} to {end_date_str}",
        "closure_records_count": len(closure_records),
        "closure_kwh": round(closure_kwh, 2),
        "recommendation": (
            f"Hostel officially closed ({reason} from {start_date_str} to {end_date_str}). "
            f"Electricity draw exceeded essential standby threshold ({standby_threshold:.1f} kWh) "
            f"by {wastage_kwh:,.1f} kWh ({w_pct}% of block total). Audit unoccupied floor lighting and HVAC."
        ),
    }
