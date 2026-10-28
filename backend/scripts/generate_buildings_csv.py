"""
Generate Buildings CSV — Campus Energy Analysis
================================================
Creates the building metadata CSV that backs the Hive external table
campus_energy.buildings_meta.

Used as a broadcast-join lookup in Spark jobs:
    df.merge(buildings_df, on="building_code", how="left")

In HiveQL:
    SELECT /*+ BROADCAST(b) */ e.*, b.building_type, b.area_sqft
    FROM campus_energy.energy_records e
    JOIN campus_energy.buildings_meta b ON e.building_code = b.building_code

Output
------
    data/buildings/buildings.csv

Then upload to HDFS:
    hdfs dfs -mkdir -p /energy/buildings/
    hdfs dfs -put data/buildings/buildings.csv /energy/buildings/

Usage
-----
    python scripts/generate_buildings_csv.py
"""
from __future__ import annotations

import os
from pathlib import Path

import pandas as pd

# ── Building reference data ───────────────────────────────────
# Matches building_code values used in generate_sample_csv.py
BUILDINGS = [
    {
        "building_code": "CB-A",
        "building_name": "Classroom Block A",
        "building_type": "classroom",
        "capacity":      800,
        "area_sqft":     25000,
        "floors":        4,
        "year_built":    2005,
        "ac_units":      20,
    },
    {
        "building_code": "LB-B",
        "building_name": "Laboratory Block B",
        "building_type": "laboratory",
        "capacity":      300,
        "area_sqft":     18000,
        "floors":        3,
        "year_built":    2010,
        "ac_units":      15,
    },
    {
        "building_code": "LIB",
        "building_name": "Central Library",
        "building_type": "library",
        "capacity":      500,
        "area_sqft":     22000,
        "floors":        5,
        "year_built":    1998,
        "ac_units":      18,
    },
    {
        "building_code": "HST",
        "building_name": "Hostel Complex",
        "building_type": "hostel",
        "capacity":      1200,
        "area_sqft":     40000,
        "floors":        6,
        "year_built":    2015,
        "ac_units":      35,
    },
]


def main() -> None:
    out_dir = Path("data/buildings")
    out_dir.mkdir(parents=True, exist_ok=True)

    df = pd.DataFrame(BUILDINGS)
    out_file = out_dir / "buildings.csv"
    df.to_csv(out_file, index=False)

    print("\n" + "=" * 55)
    print("  Buildings CSV Generator")
    print("=" * 55)
    print(f"  Output: {out_file.resolve()}")
    print(f"  Rows  : {len(df)}")
    print("\n  Building metadata:")
    for _, row in df.iterrows():
        print(f"    {row['building_code']:<8} {row['building_name']:<25}"
              f"  {row['area_sqft']:>6} sqft  cap={row['capacity']}")
    print("\n  Next: upload to HDFS")
    print("    hdfs dfs -mkdir -p /energy/buildings/")
    print("    hdfs dfs -put data/buildings/buildings.csv /energy/buildings/")
    print("\n  Hive table: campus_energy.buildings_meta")
    print("    (created by hive/ddl/04_create_buildings_table.hql)")
    print("=" * 55 + "\n")


if __name__ == "__main__":
    main()
