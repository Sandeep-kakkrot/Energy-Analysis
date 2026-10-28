"""
HDFS Reader — Campus Energy Analysis
======================================
.. deprecated::
    HDFSReader has been superseded by HiveReader (spark_jobs/hive_reader.py).

    Spark jobs no longer import this module directly.
    BaseSparkJob now instantiates HiveReader which provides three modes:
        1. Local CSV  (SPARK_LOCAL_MODE=true)         — development
        2. Hive       (SPARK_LOCAL_MODE=false, USE_HIVE=true)  — production
        3. HDFS raw   (SPARK_LOCAL_MODE=false, USE_HIVE=false) — fallback

    This file is retained because HiveReader._read_hdfs_fallback() delegates
    to the same PySpark read.csv() pattern documented here, and as a reference
    for the original raw-HDFS-only approach.

Original modes (now handled by HiveReader)
-------------------------------------------
SPARK_LOCAL_MODE=true  (default for dev)
    Reads local CSV files from LOCAL_CSV_DIR (default: data/raw/).
    No Hadoop or PySpark installation required.

SPARK_LOCAL_MODE=false
    Uses PySpark to read from the real HDFS cluster at HDFS_NAMENODE.
    Requires: PySpark, a running NameNode, and HADOOP_CONF_DIR set.

Environment variables (set in backend/.env)
-------------------------------------------
  HDFS_NAMENODE     hdfs://localhost:9000          HDFS NameNode URI
  HDFS_DATA_PATH    /energy/raw/                   Base path on HDFS
  SPARK_LOCAL_MODE  true                           Use local CSVs?
  LOCAL_CSV_DIR     data/raw                       Path to local CSVs

See also: spark_jobs/hive_reader.py (current implementation)
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────
HDFS_NAMENODE    = os.getenv("HDFS_NAMENODE",    "hdfs://localhost:9000")
HDFS_DATA_PATH   = os.getenv("HDFS_DATA_PATH",   "/energy/raw/")
SPARK_LOCAL_MODE = os.getenv("SPARK_LOCAL_MODE",  "true").lower() == "true"
LOCAL_CSV_DIR    = os.getenv("LOCAL_CSV_DIR",     "data/raw")

# Expected CSV columns and their dtypes
CSV_SCHEMA: dict[str, str] = {
    "timestamp":        "str",
    "building_code":    "str",
    "building_name":    "str",
    "consumption_kwh":  "float64",
    "hour_of_day":      "int32",
    "day_of_week":      "int32",
    "day_of_month":     "int32",
    "month_num":        "int32",
    "year_num":         "int32",
    "is_weekend":       "bool",
    "is_holiday":       "bool",
}


class HDFSReader:
    """
    Abstraction layer for reading energy CSV data.

    In local mode  → reads from LOCAL_CSV_DIR on the filesystem.
    In cluster mode → reads from HDFS via PySpark.

    All Spark job modules call:
        reader = HDFSReader()
        df = reader.read()          # returns pd.DataFrame
        source, count = reader.source, len(df)
    """

    def __init__(self, local: bool | None = None):
        """
        Parameters
        ----------
        local : bool | None
            Override SPARK_LOCAL_MODE env var if provided.
        """
        self._local = local if local is not None else SPARK_LOCAL_MODE
        self.source: str = ""        # populated after read()
        self._df:    pd.DataFrame | None = None

    # ── Public API ────────────────────────────────────────────

    def read(self) -> pd.DataFrame:
        """Return a cleaned DataFrame of all energy records."""
        if self._local:
            df = self._read_local()
        else:
            df = self._read_hdfs()
        df = self._cast_types(df)
        self._df = df
        return df

    # ── Local CSV (dev / demo) ────────────────────────────────

    def _read_local(self) -> pd.DataFrame:
        """
        Read all *.csv files inside LOCAL_CSV_DIR.

        The CSV files are an exact local replica of what would live
        on HDFS at hdfs://<namenode><HDFS_DATA_PATH>.
        In production these files would not exist locally; Spark would
        read them directly from HDFS using _read_hdfs().
        """
        csv_dir = Path(LOCAL_CSV_DIR)
        if not csv_dir.exists():
            raise FileNotFoundError(
                f"LOCAL_CSV_DIR '{csv_dir.resolve()}' not found. "
                "Run: python scripts/generate_sample_csv.py"
            )

        csv_files = sorted(csv_dir.glob("*.csv"))
        if not csv_files:
            raise FileNotFoundError(
                f"No CSV files found in '{csv_dir.resolve()}'. "
                "Run: python scripts/generate_sample_csv.py"
            )

        frames = []
        for f in csv_files:
            log.info("[HDFSReader] LOCAL  reading %s", f)
            frames.append(pd.read_csv(f))

        self.source = f"LOCAL:{csv_dir.resolve()}"
        df = pd.concat(frames, ignore_index=True)
        log.info("[HDFSReader] LOCAL  loaded %d rows from %d file(s)", len(df), len(csv_files))
        return df

    # ── Real HDFS via PySpark ─────────────────────────────────

    def _read_hdfs(self) -> pd.DataFrame:
        """
        Read CSV files from HDFS using PySpark.

        PySpark equivalent (what this simulates):
            spark = SparkSession.builder \\
                        .appName("CampusEnergyReader") \\
                        .getOrCreate()
            sdf = spark.read.csv(
                f"{HDFS_NAMENODE}{HDFS_DATA_PATH}",
                header=True, inferSchema=True
            )
            df = sdf.toPandas()

        In production each Spark job would keep the data as a Spark
        DataFrame and run distributed transformations before collecting.
        Here we convert to pandas after reading so the simulation jobs
        can share the same transformation logic as the local-mode jobs.
        """
        try:
            from pyspark.sql import SparkSession  # type: ignore
        except ImportError as exc:
            raise ImportError(
                "PySpark is not installed. Install pyspark or set "
                "SPARK_LOCAL_MODE=true to use local CSV files."
            ) from exc

        hdfs_path = f"{HDFS_NAMENODE}{HDFS_DATA_PATH}"
        log.info("[HDFSReader] HDFS   reading %s", hdfs_path)

        spark = (
            SparkSession.builder
            .appName("CampusEnergyReader")
            .config("spark.hadoop.fs.defaultFS", HDFS_NAMENODE)
            .getOrCreate()
        )

        sdf = spark.read.csv(hdfs_path, header=True, inferSchema=True)
        df = sdf.toPandas()

        self.source = hdfs_path
        log.info("[HDFSReader] HDFS   loaded %d rows", len(df))
        return df

    # ── Type casting ──────────────────────────────────────────

    @staticmethod
    def _cast_types(df: pd.DataFrame) -> pd.DataFrame:
        """Enforce expected dtypes; fill nulls sensibly."""
        if df.empty:
            return df

        df = df.copy()

        numeric_int = ["hour_of_day", "day_of_week", "day_of_month", "month_num", "year_num"]
        for col in numeric_int:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).astype("int32")

        if "consumption_kwh" in df.columns:
            df["consumption_kwh"] = pd.to_numeric(df["consumption_kwh"], errors="coerce").fillna(0.0)

        for bool_col in ("is_weekend", "is_holiday"):
            if bool_col in df.columns:
                df[bool_col] = df[bool_col].astype(str).str.lower().isin(("true", "1", "yes"))

        return df
