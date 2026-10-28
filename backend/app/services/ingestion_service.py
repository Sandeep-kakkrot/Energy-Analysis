"""
Ingestion Service - Campus Energy Analysis
==========================================
Handles user dataset uploads (.csv, .xlsx, .xls).

Pipeline:
  1. Parse & validate (CSV/Excel via Pandas)
  2. Normalize columns using alias map
  3. Canonicalize building names into campus blocks:
     Laboratory Block B, Classroom Block A, Hostel Complex, Central Library
  4. Detect genuine timestamped data (never synthesize fake dates/times)
  5. Archive stale historical files to prevent duplicates
  6. Save active dataset to local raw store
  7. Trigger Spark pipeline (spark_runner + spark_batch_runner)
  8. Return result payload
"""
from __future__ import annotations

import logging
import os
import sys
import glob
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
import pandas as pd

from spark_jobs.building_normalizer import canonicalize_building

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Column alias map
# Maps real-world header variants -> canonical energy schema names.
# ---------------------------------------------------------------------------
COLUMN_MAP = {
    # timestamp
    "recorded_at":  "timestamp",  "datetime":     "timestamp",
    "date_time":    "timestamp",  "date":         "timestamp",
    "time":         "timestamp",  "ts":           "timestamp",
    "dt":           "timestamp",  "record_date":  "timestamp",
    "rec_date":     "timestamp",  "reading_time": "timestamp",
    # building_code
    "building":     "building_code", "block":     "building_code",
    "code":         "building_code", "block_code":"building_code",
    "bldg_code":    "building_code", "bldg":      "building_code",
    "building_id":  "building_code",
    # building_name
    "name":         "building_name", "bldg_name": "building_name",
    "block_name":   "building_name", "facility":  "building_name",
    # consumption
    "kwh":          "consumption_kwh", "units":   "consumption_kwh",
    "usage":        "consumption_kwh", "energy":  "consumption_kwh",
    "consumption":  "consumption_kwh", "power_kwh":"consumption_kwh",
    "electricity":  "consumption_kwh", "energy_kwh":"consumption_kwh",
    "load_kwh":     "consumption_kwh", "total_kwh":"consumption_kwh",
    "avg_kwh":      "consumption_kwh",
    # wastage fields
    "off_hours_kwh": "off_hours_kwh", "off-hours_kwh": "off_hours_kwh",
    "weekend_kwh":   "weekend_kwh",
    "total_wastage_kwh": "total_wastage_kwh", "total_waste_kwh": "total_wastage_kwh",
    "wastage_(%)":   "wastage_pct", "wastage_pct": "wastage_pct",
    "severity":      "severity",
    "ai_recommendation": "ai_recommendation", "recommendation": "ai_recommendation",
    # temporal
    "hour":         "hour_of_day",  "hour_num":  "hour_of_day",
    "day":          "day_of_week",  "weekday":   "day_of_week",
    "day_num":      "day_of_month",
    "month":        "month_num",    "year":      "year_num",
    "weekend":      "is_weekend",   "holiday":   "is_holiday",
    "is_wknd":      "is_weekend",   "is_hol":    "is_holiday",
}

# Dataset types -> frontend route mapping
DATASET_TYPES = {
    "energy":    {"label": "Energy Records (All Pages)", "route": "/"},
    "buildings": {"label": "Building Comparison",        "route": "/buildings"},
    "daily":     {"label": "Daily Trends",               "route": "/trends/daily"},
    "monthly":   {"label": "Monthly Trends",             "route": "/trends/monthly"},
    "peaks":     {"label": "Peak Usage",                 "route": "/peaks"},
    "wastage":   {"label": "Wastage Report",             "route": "/wastage"},
}


def _auto_detect_dataset_type(df: pd.DataFrame, filename: str) -> str:
    """Heuristically detect dataset type from column names and filename."""
    cols = set(df.columns.tolist())
    fname = filename.lower()

    if any(k in fname for k in ("wastage", "waste", "off_hour")):
        return "wastage"
    if any(k in fname for k in ("monthly", "month_")):
        return "monthly"
    if any(k in fname for k in ("daily", "day_", "trend")):
        return "daily"
    if any(k in fname for k in ("peak", "hourly", "hour_")):
        return "peaks"
    if any(k in fname for k in ("building", "block", "comparison")):
        return "buildings"

    if any(c in cols for c in ("total_wastage_kwh", "off_hours_kwh", "off-hours_kwh", "severity")):
        return "wastage"
    if "month_num" in cols or "month" in cols:
        return "monthly"
    if "hour_of_day" in cols or "hour" in cols:
        return "peaks"
    if "timestamp" in cols or "recorded_at" in cols:
        return "energy"

    return "energy"


def _infer_consumption_from_numerics(df: pd.DataFrame) -> pd.DataFrame:
    """Try to derive consumption_kwh from the first suitable numeric column."""
    if "consumption_kwh" in df.columns:
        return df
    skip = {
        "hour_of_day", "day_of_week", "day_of_month", "month_num", "year_num",
        "is_weekend", "is_holiday", "capacity", "area_sqft", "id", "wastage_pct"
    }
    for col in df.columns:
        if col in skip:
            continue
        try:
            candidate = pd.to_numeric(df[col], errors="coerce")
            if candidate.notna().sum() > len(df) * 0.5:
                df["consumption_kwh"] = candidate.abs()
                log.info("[Ingestion] Inferred consumption_kwh from column '%s'", col)
                return df
        except Exception:
            continue
    log.warning("[Ingestion] Could not infer consumption_kwh - filling 0.0")
    df["consumption_kwh"] = 0.0
    return df


def archive_existing_raw_files(raw_dir: str) -> None:
    """Move existing non-archived CSV files in raw_dir into raw_dir/archive."""
    arch_dir = os.path.join(raw_dir, "archive")
    os.makedirs(arch_dir, exist_ok=True)
    for f in glob.glob(os.path.join(raw_dir, "*.csv")):
        try:
            fname = os.path.basename(f)
            dest = os.path.join(arch_dir, fname)
            if os.path.exists(dest):
                base, ext = os.path.splitext(fname)
                dest = os.path.join(arch_dir, f"{base}_{datetime.now().strftime('%Y%m%d%H%M%S')}{ext}")
            shutil.move(f, dest)
            log.info("[Ingestion] Archived old raw file: %s -> %s", fname, dest)
        except Exception as err:
            log.warning("[Ingestion] Could not archive %s: %s", f, err)


def process_and_ingest_file(
    file_storage,
    filename: str,
    local_mode: bool = True,
    dataset_type: str | None = None,
    archive_old: bool = True,
) -> dict:
    """Process uploaded dataset through HDFS -> Hive -> Spark -> MySQL.

    Args:
        file_storage: File-like stream from Flask request.files.
        filename:     Original filename.
        local_mode:   Skip actual HDFS/Hive when True.
        dataset_type: One of DATASET_TYPES keys, or None for auto-detection.
        archive_old:  Archive previous active files in data/raw to prevent accumulation.
    """
    log.info("[Ingestion] Processing '%s' (type=%s)", filename, dataset_type)

    # 1. Parse
    ext = Path(filename).suffix.lower()
    if ext == ".csv":
        df = pd.read_csv(file_storage)
    elif ext in (".xlsx", ".xls"):
        df = pd.read_excel(file_storage)
    else:
        raise ValueError(f"Unsupported format '{ext}'. Please upload .csv, .xlsx, or .xls")

    if df.empty:
        raise ValueError("Uploaded file is empty.")

    # 2. Normalise column names
    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
    df.rename(columns={c: COLUMN_MAP[c] for c in list(df.columns) if c in COLUMN_MAP}, inplace=True)

    # 3. Detect / validate dataset type
    detected_type = dataset_type or _auto_detect_dataset_type(df, filename)
    if detected_type not in DATASET_TYPES:
        detected_type = "energy"
    dataset_info = DATASET_TYPES[detected_type]

    # 4. Canonicalize building names into campus blocks
    raw_bldg_name = df["building_name"] if "building_name" in df.columns else (df["building_code"] if "building_code" in df.columns else None)
    raw_bldg_code = df["building_code"] if "building_code" in df.columns else None

    canon_tuples = [
        canonicalize_building(
            raw_bldg_name.iloc[i] if raw_bldg_name is not None else None,
            raw_bldg_code.iloc[i] if raw_bldg_code is not None else None,
        )
        for i in range(len(df))
    ]
    df["building_name"] = [t[0] for t in canon_tuples]
    df["building_code"] = [t[1] for t in canon_tuples]

    df = _infer_consumption_from_numerics(df)
    df["consumption_kwh"] = pd.to_numeric(df["consumption_kwh"], errors="coerce").fillna(0.0).abs()

    # 5. Check for genuine timestamped data (never fabricate fake dates/trends)
    has_genuine_timestamps = False
    if "timestamp" in df.columns:
        parsed_ts = pd.to_datetime(df["timestamp"], errors="coerce")
        valid_ts = parsed_ts.dropna()
        if not valid_ts.empty and valid_ts.dt.normalize().nunique() > 1:
            has_genuine_timestamps = True
            df["timestamp"] = parsed_ts
        else:
            # Drop invalid / single-value synthetic timestamp column
            df.drop(columns=["timestamp"], inplace=True, errors="ignore")
    elif all(c in df.columns for c in ("year_num", "month_num", "day_of_month", "hour_of_day")):
        parsed_ts = pd.to_datetime(
            dict(year=df["year_num"], month=df["month_num"], day=df["day_of_month"], hour=df["hour_of_day"]),
            errors="coerce"
        )
        valid_ts = parsed_ts.dropna()
        if not valid_ts.empty and valid_ts.dt.normalize().nunique() > 1:
            has_genuine_timestamps = True
            df["timestamp"] = parsed_ts

    if has_genuine_timestamps:
        if "hour_of_day" not in df.columns:
            df["hour_of_day"] = df["timestamp"].dt.hour
        if "day_of_week" not in df.columns:
            df["day_of_week"] = df["timestamp"].dt.dayofweek
        if "day_of_month" not in df.columns:
            df["day_of_month"] = df["timestamp"].dt.day
        if "month_num" not in df.columns:
            df["month_num"] = df["timestamp"].dt.month
        if "year_num" not in df.columns:
            df["year_num"] = df["timestamp"].dt.year
        if "is_weekend" not in df.columns:
            df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(int)
        if "is_holiday" not in df.columns:
            df["is_holiday"] = 0

    # 6. Save locally (cleanly archive old files to prevent duplicate records)
    ts_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    clean  = Path(filename).stem.replace(" ", "_").replace("-", "_").lower()
    out_fn = f"user_{clean}_{ts_str}.csv"

    backend_dir   = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    local_raw_dir = os.path.join(backend_dir, "data", "raw")
    os.makedirs(local_raw_dir, exist_ok=True)

    if archive_old:
        archive_existing_raw_files(local_raw_dir)

    target_path = os.path.join(local_raw_dir, out_fn)
    df.to_csv(target_path, index=False)
    log.info("[Ingestion] Saved active dataset: %d rows -> %s", len(df), target_path)

    # 7. HDFS upload (production only)
    hdfs_path = f"/energy/raw/{out_fn}"
    if not local_mode:
        try:
            subprocess.run(["hdfs", "dfs", "-mkdir", "-p", "/energy/raw/"], check=True)
            subprocess.run(["hdfs", "dfs", "-put", "-f", target_path, hdfs_path], check=True)
        except Exception as err:
            log.warning("[Ingestion] HDFS upload failed: %s", err)

    # 8. Hive partition refresh
    hive_status = "Skipped (Local Mode)"
    if not local_mode:
        try:
            subprocess.run(
                "hive -e \"USE campus_energy; MSCK REPAIR TABLE energy_records;\"",
                shell=True, check=True,
            )
            hive_status = "Refreshed Hive partitions"
        except Exception as err:
            hive_status = f"Hive refresh warning: {err}"

    # 9. Spark pipeline
    py_exec          = sys.executable
    spark_runner     = os.path.join(backend_dir, "spark_jobs", "spark_runner.py")
    spark_batch      = os.path.join(backend_dir, "spark_jobs", "batch", "spark_batch_runner.py")

    cmd1 = [py_exec, spark_runner, "--all"] + (["--local"] if local_mode else [])
    cmd2 = [py_exec, spark_batch,  "--all"] + (["--local"] if local_mode else [])

    proc1 = subprocess.run(cmd1, capture_output=True, text=True, cwd=backend_dir)
    proc2 = subprocess.run(cmd2, capture_output=True, text=True, cwd=backend_dir)

    if proc1.returncode != 0:
        log.error("[Ingestion] Spark summary runner error: %s", proc1.stderr or proc1.stdout)
    if proc2.returncode != 0:
        log.error("[Ingestion] Spark batch runner error: %s", proc2.stderr or proc2.stdout)

    spark_status = "Success" if (proc1.returncode == 0 and proc2.returncode == 0) else "Partial Error"

    date_range = {}
    if has_genuine_timestamps and "timestamp" in df.columns:
        date_range = {
            "from": str(df["timestamp"].min()),
            "to": str(df["timestamp"].max())
        }

    return {
        "filename":            filename,
        "out_filename":        out_fn,
        "record_count":        len(df),
        "building_count":      int(df["building_code"].nunique()),
        "dataset_type":        detected_type,
        "dataset_label":       dataset_info["label"],
        "route":               dataset_info["route"],
        "has_timestamps":      has_genuine_timestamps,
        "date_range":          date_range,
        "hdfs_path":           hdfs_path,
        "local_path":          target_path,
        "hive_status":         hive_status,
        "spark_status":        spark_status,
        "summary_runner_exit": proc1.returncode,
        "batch_runner_exit":   proc2.returncode,
    }
