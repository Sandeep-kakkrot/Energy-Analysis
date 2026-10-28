"""
Base Spark Job — Campus Energy Analysis
=========================================
Abstract base class for all Spark job modules.

Data pipeline (per job run):
  1. HiveReader.read()  — returns pd.DataFrame from one of:
        • Hive Metastore (production, enableHiveSupport)
        • Local CSV files (development, SPARK_LOCAL_MODE=true)
        • Raw HDFS CSV   (compatibility fallback, USE_HIVE=false)
  2. transform(df)      — subclass applies Spark-style groupBy/agg
  3. _upsert_summary()  — result JSON written to MySQL spark_summaries

The Flask API never calls any job directly.  It reads the pre-computed
payloads from spark_summaries and returns them to the React frontend.

Usage (from spark_runner.py)
-----------------------------
    from spark_jobs.job_dashboard_summary import DashboardSummaryJob
    job = DashboardSummaryJob()
    job.execute()
"""
from __future__ import annotations

import json
import logging
import os
import sys
from abc import ABC, abstractmethod
from datetime import datetime, timezone

# Allow running jobs from inside backend/ directory
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

import pandas as pd
from dotenv import load_dotenv
import sqlalchemy
from sqlalchemy import create_engine, text

from spark_jobs.hive_reader import HiveReader

load_dotenv()

log = logging.getLogger(__name__)

# ── DB connection (separate from Flask's SQLAlchemy session) ──
def _build_engine() -> sqlalchemy.Engine:
    host = os.getenv("DB_HOST",     "localhost")
    port = os.getenv("DB_PORT",     "3306")
    user = os.getenv("DB_USER",     "root")
    pwd  = os.getenv("DB_PASSWORD", "root")
    name = os.getenv("DB_NAME",     "campus_energy")
    url  = f"mysql+pymysql://{user}:{pwd}@{host}:{port}/{name}?charset=utf8mb4"
    return create_engine(url, pool_pre_ping=True)


import math

def sanitize_for_json(obj: Any) -> Any:
    """Recursively convert NaN/Infinity to None to ensure strict valid JSON for MySQL."""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [sanitize_for_json(v) for v in obj]
    return obj


class BaseSparkJob(ABC):
    """
    Abstract base for all Spark job modules.

    Subclasses must implement:
        JOB_NAME : str   — unique identifier stored in spark_summaries
        transform(df)    — apply Spark-style groupBy/agg, return payload

    The base class handles HDFSReader, timing, logging, and the DB upsert.
    """

    #: Override in every subclass
    JOB_NAME: str = ""

    def __init__(self, local: bool | None = None, use_hive: bool | None = None):
        if not self.JOB_NAME:
            raise NotImplementedError("Subclasses must set JOB_NAME")
        # HiveReader selects the correct backend automatically:
        #   local=True           → pandas + local CSV (dev)
        #   local=False + hive   → SparkSession.enableHiveSupport() (prod)
        #   local=False + no hive→ raw HDFS CSV fallback
        self._reader = HiveReader(local=local, use_hive=use_hive)
        self._engine = _build_engine()

    # ── Public entrypoint ─────────────────────────────────────

    def execute(self) -> dict:
        """
        Full pipeline:
          read → transform → upsert → return status dict
        """
        log.info("[%s] Starting job", self.JOB_NAME)
        t0 = datetime.now(timezone.utc)

        # Step 1 — Read via HiveReader (Hive / HDFS / local CSV)
        df = self._reader.read()
        record_count = len(df)
        data_source  = self._reader.source   # e.g. HIVE:thrift://... or LOCAL:...

        log.info("[%s] Read %d rows from %s", self.JOB_NAME, record_count, data_source)

        # Step 2 — Spark-style transformations (implemented by subclass)
        payload = self.transform(df)

        # Step 3 — Upsert into spark_summaries
        computed_at = datetime.now(timezone.utc).replace(tzinfo=None)
        self._upsert_summary(
            job_name     = self.JOB_NAME,
            computed_at  = computed_at,
            hdfs_source  = data_source,   # HIVE:... | HDFS:... | LOCAL:...
            record_count = record_count,
            payload      = payload,
        )

        elapsed = (datetime.now(timezone.utc) - t0).total_seconds()
        log.info("[%s] Done in %.2fs — %d rows from %s",
                 self.JOB_NAME, elapsed, record_count, data_source)

        return {
            "job_name":     self.JOB_NAME,
            "computed_at":  computed_at.isoformat(),
            "data_source":  data_source,
            "record_count": record_count,
            "elapsed_sec":  round(elapsed, 3),
            "status":       "ok",
        }

    # ── Subclass contract ─────────────────────────────────────

    @abstractmethod
    def transform(self, df: pd.DataFrame) -> dict | list:
        """
        Perform Spark-style analytics on the raw DataFrame.

        Parameters
        ----------
        df : pd.DataFrame
            Full energy dataset read from HDFS / local CSVs.

        Returns
        -------
        dict or list
            JSON-serialisable payload to store in spark_summaries.payload.
        """

    # ── DB upsert ─────────────────────────────────────────────

    def _upsert_summary(
        self,
        job_name:     str,
        computed_at:  datetime,
        hdfs_source:  str,
        record_count: int,
        payload:      dict | list,
    ) -> None:
        """
        INSERT ... ON DUPLICATE KEY UPDATE into spark_summaries.

        Uses raw SQL for portability — no Flask app context needed,
        so jobs can run as standalone spark-submit processes.
        """
        clean_payload = sanitize_for_json(payload)
        payload_json = json.dumps(clean_payload, default=str)

        upsert_sql = text("""
            INSERT INTO spark_summaries (job_name, computed_at, hdfs_source, record_count, payload)
            VALUES (:job_name, :computed_at, :hdfs_source, :record_count, :payload)
            ON DUPLICATE KEY UPDATE
                computed_at  = VALUES(computed_at),
                hdfs_source  = VALUES(hdfs_source),
                record_count = VALUES(record_count),
                payload      = VALUES(payload)
        """)

        with self._engine.begin() as conn:
            conn.execute(upsert_sql, {
                "job_name":     job_name,
                "computed_at":  computed_at,
                "hdfs_source":  hdfs_source,
                "record_count": record_count,
                "payload":      payload_json,
            })

        log.info("[%s] Upserted spark_summaries row", job_name)
