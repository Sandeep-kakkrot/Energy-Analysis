"""
Base Spark Batch Job — Campus Energy Analysis
==============================================
Abstract base for all batch computation jobs.

Pipeline per job:
  1. HiveReader.read()    — DataFrame from Hive / HDFS / local CSV
  2. spark_transform(df)  — PySpark-style Hive SQL aggregation
  3. _write_results()     — INSERT rows into a dedicated MySQL table
  4. _register_batch()    — UPDATE batch_runs row with final status

Design
------
In PRODUCTION (SPARK_LOCAL_MODE=false, USE_HIVE=true):
    Spark reads from Hive, runs distributed DataFrame.groupBy().agg(),
    and writes to MySQL via Spark's built-in JDBC writer:
        result_sdf.write.jdbc(url, table, mode="append", properties=jdbc_props)

In LOCAL (SPARK_LOCAL_MODE=true):
    pandas simulates the same PySpark DataFrame operations.
    Results are written to MySQL via SQLAlchemy bulk INSERT.
    Zero code changes needed to switch to a real cluster.

All batch jobs store their results in DEDICATED normalised MySQL tables
(batch_building_totals, batch_daily_totals, etc.), NOT the generic
spark_summaries JSON blob table.

Key difference from BaseSparkJob (base_job.py)
-----------------------------------------------
BaseSparkJob   → generic spark_summaries (one JSON blob per job)
BaseBatchJob   → dedicated table per calculation type,
                 rows per building/date/hour (normalised),
                 linked to batch_run_id UUID,
                 historical runs preserved.
"""
from __future__ import annotations

import logging
import os
import sys
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
import sqlalchemy

# Ensure backend/ is on sys.path when run as spark-submit
_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

from spark_jobs.hive_reader import HiveReader

load_dotenv()
log = logging.getLogger(__name__)


# ── DB engine (standalone; no Flask context needed) ───────────
def _build_engine() -> sqlalchemy.Engine:
    host = os.getenv("DB_HOST",     "localhost")
    port = os.getenv("DB_PORT",     "3306")
    user = os.getenv("DB_USER",     "root")
    pwd  = os.getenv("DB_PASSWORD", "root")
    name = os.getenv("DB_NAME",     "campus_energy")
    url  = f"mysql+pymysql://{user}:{pwd}@{host}:{port}/{name}?charset=utf8mb4"
    return create_engine(url, pool_pre_ping=True)


class BaseBatchJob(ABC):
    """
    Abstract base for all Spark batch computation jobs.

    Subclasses implement:
        TABLE_NAME : str           — MySQL table to write into
        JOB_LABEL  : str           — human-readable name for logs
        compute(df)                — pandas-style transform returning pd.DataFrame
        hive_sql()  (optional)     — custom HiveQL used in cluster mode
        _recommend(row) (optional) — per-row recommendation string
    """

    #: MySQL table this job writes into
    TABLE_NAME: str = ""
    #: Human-readable label for logs and batch_runs notes
    JOB_LABEL:  str = ""

    def __init__(self, local: bool | None = None):
        if not self.TABLE_NAME:
            raise NotImplementedError("Subclasses must set TABLE_NAME")
        self._reader = HiveReader(local=local)
        self._engine = _build_engine()

    # ── Public entrypoint ─────────────────────────────────────

    def execute(self, batch_run_id: str) -> dict:
        """
        Run the full batch pipeline for this calculation.

        Parameters
        ----------
        batch_run_id : str
            UUID from the parent BatchRunner — links results to a run.

        Returns
        -------
        dict with keys: job_label, table, rows_written, elapsed_sec, status
        """
        log.info("[%s] Starting batch job -> %s", self.JOB_LABEL, self.TABLE_NAME)
        t0 = datetime.now(timezone.utc)

        # 1. Read from Hive / local CSV
        df = self._reader.read(hive_query=self.hive_sql())
        data_source = self._reader.source
        log.info("[%s] Read %d rows from %s", self.JOB_LABEL, len(df), data_source)

        # 2. Transform (pandas simulation of PySpark groupBy/agg)
        result_df = self.compute(df)
        result_df["batch_run_id"] = batch_run_id
        result_df["computed_at"]  = datetime.now(timezone.utc).replace(tzinfo=None)

        # 3. Write to MySQL
        rows = self._write_results(result_df)

        elapsed = round((datetime.now(timezone.utc) - t0).total_seconds(), 3)
        log.info("[%s] Done in %ss — %d rows written to %s",
                 self.JOB_LABEL, elapsed, rows, self.TABLE_NAME)

        return {
            "job_label":    self.JOB_LABEL,
            "table":        self.TABLE_NAME,
            "data_source":  data_source,
            "rows_written": rows,
            "elapsed_sec":  elapsed,
            "status":       "ok",
        }

    # ── Subclass contract ─────────────────────────────────────

    @abstractmethod
    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Transform raw energy DataFrame into result rows.

        This method mirrors what would be a Spark DataFrame transformation:
            sdf.groupBy(...).agg(F.sum(...), F.avg(...)).orderBy(...)

        Parameters
        ----------
        df : pd.DataFrame
            Full energy dataset (all buildings, all dates).

        Returns
        -------
        pd.DataFrame
            Result rows ready to INSERT into TABLE_NAME.
            Do NOT include batch_run_id or computed_at — the base adds those.
        """

    def hive_sql(self) -> str | None:
        """
        Optional custom HiveQL query for cluster mode.

        If None, HiveReader reads the full energy_records table.
        Override to use partition pruning or pre-aggregation in Hive.
        """
        return None

    # ── MySQL writer ──────────────────────────────────────────

    def _write_results(self, df: pd.DataFrame) -> int:
        """
        Bulk INSERT result rows into the batch table.

        Uses pandas DataFrame.to_sql() for simplicity.
        In production with PySpark, this would be:
            result_sdf.write.jdbc(url, TABLE_NAME, mode="append", properties=jdbc_props)
        """
        if df.empty:
            log.warning("[%s] No result rows to write", self.JOB_LABEL)
            return 0

        df.to_sql(
            self.TABLE_NAME,
            con=self._engine,
            if_exists="append",
            index=False,
            method="multi",
            chunksize=500,
        )
        return len(df)
