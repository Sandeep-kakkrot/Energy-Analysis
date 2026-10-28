"""
Spark Job: Building Comparison — Campus Energy Analysis
=========================================================

Reads HDFS energy data and computes per-building aggregate stats:
  total_kwh, avg_kwh, record_count, share (%), intensity (kWh/sqft)

Building metadata (capacity, area_sqft, type) is read from MySQL buildings
table and broadcast-joined onto the Spark result — mirroring Spark's
broadcastHashJoin for small lookup tables.
"""
from __future__ import annotations

import logging
import os
import sys

import pandas as pd
from dotenv import load_dotenv
import sqlalchemy
from sqlalchemy import create_engine

from spark_jobs.base_job import BaseSparkJob
from spark_jobs.building_normalizer import canonicalize_building, CANONICAL_BUILDINGS

load_dotenv()
log = logging.getLogger(__name__)


def _load_building_metadata() -> pd.DataFrame:
    """
    Read the buildings lookup table from MySQL.
    Mirrors a Spark broadcast variable / broadcastHashJoin.
    """
    host = os.getenv("DB_HOST",     "localhost")
    port = os.getenv("DB_PORT",     "3306")
    user = os.getenv("DB_USER",     "root")
    pwd  = os.getenv("DB_PASSWORD", "root")
    name = os.getenv("DB_NAME",     "campus_energy")
    url  = f"mysql+pymysql://{user}:{pwd}@{host}:{port}/{name}?charset=utf8mb4"
    engine = create_engine(url, pool_pre_ping=True)
    with engine.connect() as conn:
        return pd.read_sql("SELECT id, name, block_code, type, capacity, area_sqft FROM buildings", conn)


class BuildingComparisonJob(BaseSparkJob):
    """Spark job: per-building aggregate consumption statistics."""

    JOB_NAME = "building_comparison"

    def transform(self, df: pd.DataFrame) -> list:
        if df.empty:
            return []

        df = df.copy()

        # Canonicalize building names & codes across all rows
        canon_tuples = [
            canonicalize_building(r.get("building_name"), r.get("building_code"))
            for _, r in df.iterrows()
        ]
        df["canonical_name"] = [t[0] for t in canon_tuples]
        df["canonical_code"] = [t[1] for t in canon_tuples]
        df["canonical_type"] = [t[2] for t in canon_tuples]

        # Spark: df.groupBy("canonical_name").agg(F.sum("consumption_kwh"), F.avg(...), F.count(...))
        agg = (
            df.groupby("canonical_name")["consumption_kwh"]
            .agg(total_kwh="sum", avg_kwh="mean", record_count="count")
            .round({"total_kwh": 2, "avg_kwh": 4})
            .reset_index()
            .sort_values("total_kwh", ascending=False)
        )

        grand_total = float(agg["total_kwh"].sum())

        # Broadcast join with building metadata
        try:
            meta = _load_building_metadata()
            merged = agg.merge(meta, left_on="canonical_name", right_on="name", how="left")
        except Exception as exc:
            log.warning("[BuildingComparisonJob] Could not load building metadata from DB: %s", exc)
            merged = agg.copy()
            merged["id"] = None
            merged["name"] = merged["canonical_name"]
            merged["block_code"] = None
            merged["type"] = None
            merged["capacity"] = None
            merged["area_sqft"] = None

        result = []
        for _, row in merged.iterrows():
            bname = str(row["canonical_name"])
            default_meta = CANONICAL_BUILDINGS.get(bname, {})

            bid = int(row["id"]) if pd.notna(row.get("id")) else default_meta.get("id")
            bcode = str(row["block_code"]) if (pd.notna(row.get("block_code")) and str(row.get("block_code")).lower() != "nan") else default_meta.get("block_code", bname[:4].upper())
            btype = str(row["type"]) if (pd.notna(row.get("type")) and str(row.get("type")).lower() != "nan") else default_meta.get("type", "classroom")
            bcap = int(row["capacity"]) if pd.notna(row.get("capacity")) else default_meta.get("capacity", 500)
            barea = int(row["area_sqft"]) if pd.notna(row.get("area_sqft")) else default_meta.get("area_sqft", 25000)

            total = float(row["total_kwh"])
            avg_kwh = float(row["avg_kwh"])
            recs = int(row["record_count"])
            pct_share = round(total / grand_total * 100, 2) if grand_total else 0.0
            intensity = round(total / (barea if barea > 0 else 1), 4)

            result.append({
                "id":                    bid,
                "name":                  bname,
                "block_code":            bcode,
                "type":                  btype,
                "capacity":              bcap,
                "area_sqft":             barea,
                "total_kwh":             round(total, 2),
                "avg_kwh":               round(avg_kwh, 4),
                "record_count":          recs,
                "pct_share":             pct_share,
                "intensity_kwh_per_sqft": intensity,
            })

        log.info("[BuildingComparisonJob] %d buildings processed", len(result))
        return result


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    print(BuildingComparisonJob().execute())
