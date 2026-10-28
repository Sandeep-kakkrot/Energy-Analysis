"""
Generate Sample CSV Files — Campus Energy Analysis
====================================================
Creates local energy consumption CSV files that replicate what would
be stored on HDFS at hdfs://namenode:9000/energy/raw/.

In a real Hadoop deployment these CSVs would be uploaded to HDFS and
Spark jobs would read them via:
    spark.read.csv("hdfs://namenode:9000/energy/raw/", header=True)

For local development and demos, this script generates the same data
into data/raw/ and the Spark jobs read from there when SPARK_LOCAL_MODE=true.

Output files
------------
  data/raw/CB-A_energy.csv      Classroom Block A  (~17,520 rows — 2 years hourly)
  data/raw/LB-B_energy.csv      Laboratory Block B
  data/raw/LIB_energy.csv       Central Library
  data/raw/HST_energy.csv       Hostel Complex

CSV schema (mirrors HDFS files)
--------------------------------
  timestamp, building_code, building_name, consumption_kwh,
  hour_of_day, day_of_week, day_of_month, month_num, year_num,
  is_weekend, is_holiday

Usage
-----
  # From backend/ directory:
  python scripts/generate_sample_csv.py

  # Specify output directory:
  python scripts/generate_sample_csv.py --out-dir data/raw

  # Generate only 1 year instead of 2:
  python scripts/generate_sample_csv.py --years 2024
"""
from __future__ import annotations

import argparse
import math
import os
import random
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd

# ── Building definitions ──────────────────────────────────────
BUILDINGS = [
    {
        "code":       "CB-A",
        "name":       "Classroom Block A",
        "type":       "classroom",
        # kWh profile: high during class hours, near-zero at night
        "peak_base":  55.0,
        "off_peak":   5.0,
        "peak_hours": range(8, 20),   # 08:00–19:00 weekdays
    },
    {
        "code":       "LB-B",
        "name":       "Laboratory Block B",
        "type":       "laboratory",
        "peak_base":  80.0,
        "off_peak":   18.0,           # labs keep equipment running overnight
        "peak_hours": range(7, 22),
    },
    {
        "code":       "LIB",
        "name":       "Central Library",
        "type":       "library",
        "peak_base":  38.0,
        "off_peak":   4.0,
        "peak_hours": range(8, 21),
    },
    {
        "code":       "HST",
        "name":       "Hostel Complex",
        "type":       "hostel",
        "peak_base":  65.0,
        "off_peak":   30.0,           # hostel always has some load (24h)
        "peak_hours": range(6, 23),
    },
]

# ── Seasonal multipliers (month → factor) ────────────────────
SEASONAL = {
    1: 0.85, 2: 0.88, 3: 0.95, 4: 1.00, 5: 1.08, 6: 1.20,
    7: 1.25, 8: 1.22, 9: 1.10, 10: 1.00, 11: 0.90, 12: 0.80,
}

# ── National holidays (MM-DD) ─────────────────────────────────
HOLIDAYS = {
    "01-26", "08-15", "10-02", "11-01", "12-25",
}


def _is_holiday(dt: datetime) -> bool:
    return dt.strftime("%m-%d") in HOLIDAYS


def _kwh(building: dict, dt: datetime, rng: random.Random) -> float:
    """Simulate realistic hourly consumption for a building."""
    hour     = dt.hour
    weekend  = dt.weekday() >= 5
    holiday  = _is_holiday(dt)
    seasonal = SEASONAL.get(dt.month, 1.0)

    is_peak = (hour in building["peak_hours"]) and not weekend and not holiday

    base  = building["peak_base"] if is_peak else building["off_peak"]
    noise = rng.gauss(0, base * 0.08)   # ±8% Gaussian noise
    value = max(0.5, (base + noise) * seasonal)
    return round(value, 4)


def generate_csv(building: dict, years: list[int], rng: random.Random) -> pd.DataFrame:
    """Generate hourly rows for one building across the given years."""
    rows = []
    for year in years:
        start = datetime(year, 1, 1, 0, 0)
        end   = datetime(year, 12, 31, 23, 0)
        current = start
        while current <= end:
            is_wknd = current.weekday() >= 5
            is_hol  = _is_holiday(current)
            rows.append({
                "timestamp":       current.strftime("%Y-%m-%d %H:%M:%S"),
                "building_code":   building["code"],
                "building_name":   building["name"],
                "consumption_kwh": _kwh(building, current, rng),
                "hour_of_day":     current.hour,
                "day_of_week":     current.weekday(),   # 0=Mon, 6=Sun
                "day_of_month":    current.day,
                "month_num":       current.month,
                "year_num":        current.year,
                "is_weekend":      is_wknd,
                "is_holiday":      is_hol,
            })
            current += timedelta(hours=1)
    return pd.DataFrame(rows)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate HDFS-replica CSV files for local dev"
    )
    parser.add_argument(
        "--out-dir", default="data/raw",
        help="Output directory (default: data/raw)",
    )
    parser.add_argument(
        "--years", nargs="+", type=int, default=[2024, 2025],
        help="Years to generate data for (default: 2024 2025)",
    )
    parser.add_argument(
        "--seed", type=int, default=42,
        help="Random seed for reproducibility (default: 42)",
    )
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    rng = random.Random(args.seed)

    total_rows = 0
    print(f"\n{'='*60}")
    print(f"  Generating HDFS-replica CSV files")
    print(f"  Output: {out_dir.resolve()}")
    print(f"  Years:  {args.years}   Seed: {args.seed}")
    print(f"{'='*60}")

    for building in BUILDINGS:
        df  = generate_csv(building, args.years, rng)
        out = out_dir / f"{building['code']}_energy.csv"
        df.to_csv(out, index=False)
        total_rows += len(df)
        print(f"  [OK] {building['name']:<25} {len(df):>7,} rows -> {out.name}")

    print(f"{'='*60}")
    print(f"  Total: {total_rows:,} rows across {len(BUILDINGS)} buildings")
    print(f"\n  Next step: run Spark jobs to populate spark_summaries")
    print(f"  $ python spark_jobs/spark_runner.py --all --local")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
