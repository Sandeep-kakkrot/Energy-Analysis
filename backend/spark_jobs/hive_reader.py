"""
Hive Reader — Campus Energy Analysis
======================================
Primary data source for all Spark jobs.

Replaces HDFSReader as the standard way Spark jobs obtain the raw
energy DataFrame. Three modes are supported, selected automatically
from environment variables:

  Mode 1 — local  (SPARK_LOCAL_MODE=true)
      Reads data/raw/*.csv with pandas.
      No Hadoop, Hive, or PySpark installation required.
      Used for development and CI.

  Mode 2 — hive_cluster  (SPARK_LOCAL_MODE=false, USE_HIVE=true)
      SparkSession.enableHiveSupport() connects to the Hive Metastore.
      Spark reads via:
          spark.sql("SELECT * FROM campus_energy.energy_records")
      Hive resolves HDFS partition paths; no raw HDFS path in code.
      This is the PRODUCTION mode.

  Mode 3 — hdfs_fallback  (SPARK_LOCAL_MODE=false, USE_HIVE=false)
      Reads directly from HDFS CSV via PySpark without Hive.
      Kept for compatibility with the old HDFSReader behaviour.
      Not recommended — bypasses Hive schema governance.

Architecture note
-----------------
The Flask API and analytics service NEVER import this module.
Only spark_jobs/ modules call HiveReader.

All Spark job modules use the identical call pattern:
    reader = HiveReader()
    df     = reader.read()          # always returns pd.DataFrame
    source = reader.source          # string label for logging
    count  = reader.record_count    # populated after read()

Environment variables  (backend/.env)
--------------------------------------
  SPARK_LOCAL_MODE    true | false        Use local CSVs (default: true)
  USE_HIVE            true | false        Use Hive when not local (default: true)
  HIVE_METASTORE_URI  thrift://host:9083  Hive Metastore Thrift URI
  HIVE_DATABASE       campus_energy       Hive database name
  HIVE_TABLE          energy_records      Hive table name (partitioned Parquet)
  HIVE_WAREHOUSE_DIR  /hive/warehouse     HDFS Hive warehouse root
  HDFS_NAMENODE       hdfs://host:9000    NameNode URI (hdfs_fallback mode only)
  HDFS_DATA_PATH      /energy/raw/        Raw CSV path (hdfs_fallback mode only)
  LOCAL_CSV_DIR       data/raw            Local CSV directory (local mode only)
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger(__name__)

# ── Environment config ────────────────────────────────────────
SPARK_LOCAL_MODE   = os.getenv("SPARK_LOCAL_MODE",   "true").lower() == "true"
USE_HIVE           = os.getenv("USE_HIVE",            "true").lower() == "true"
HIVE_METASTORE_URI = os.getenv("HIVE_METASTORE_URI",  "thrift://localhost:9083")
HIVE_DATABASE      = os.getenv("HIVE_DATABASE",       "campus_energy")
HIVE_TABLE         = os.getenv("HIVE_TABLE",          "energy_records")
HIVE_WAREHOUSE_DIR = os.getenv("HIVE_WAREHOUSE_DIR",  "/hive/warehouse")
HDFS_NAMENODE      = os.getenv("HDFS_NAMENODE",       "hdfs://localhost:9000")
HDFS_DATA_PATH     = os.getenv("HDFS_DATA_PATH",      "/energy/raw/")
LOCAL_CSV_DIR      = os.getenv("LOCAL_CSV_DIR",       "data/raw")

# Fully-qualified Hive table reference used in all SQL queries
HIVE_FULL_TABLE    = f"{HIVE_DATABASE}.{HIVE_TABLE}"


class HiveReader:
    """
    Unified data reader for Spark jobs.

    Selects the correct backend automatically:
      local mode        → pandas + local CSV
      hive_cluster mode → PySpark + Hive Metastore (production)
      hdfs_fallback     → PySpark + raw HDFS CSV (compatibility)

    All modes return an identical pd.DataFrame so job transform()
    methods remain completely unaware of the source backend.
    """

    def __init__(self, local: bool | None = None, use_hive: bool | None = None):
        """
        Parameters
        ----------
        local : bool | None
            Override SPARK_LOCAL_MODE env var if provided.
        use_hive : bool | None
            Override USE_HIVE env var if provided.
        """
        self._local    = local    if local    is not None else SPARK_LOCAL_MODE
        self._use_hive = use_hive if use_hive is not None else USE_HIVE

        self.source:       str = ""   # populated by read()
        self.record_count: int = 0    # populated by read()
        self._df: pd.DataFrame | None = None

    # ── Public API ────────────────────────────────────────────

    def read(self, hive_query: str | None = None) -> pd.DataFrame:
        """
        Read energy data and return a cleaned pd.DataFrame.

        Parameters
        ----------
        hive_query : str | None
            Optional custom HiveQL SELECT statement to run instead of
            the default  SELECT * FROM <HIVE_FULL_TABLE>.
            Only used in Hive cluster mode. Ignored in local/fallback mode.

        Returns
        -------
        pd.DataFrame
            Fully typed energy records DataFrame.
        """
        if self._local:
            df = self._read_local()
        elif self._use_hive:
            df = self._read_hive(custom_query=hive_query)
        else:
            df = self._read_hdfs_fallback()

        df = self._cast_types(df)
        self.record_count = len(df)
        self._df = df
        return df

    # ── Mode 1: Local CSV ─────────────────────────────────────

    def _read_local(self) -> pd.DataFrame:
        """
        Read all *.csv files from LOCAL_CSV_DIR using pandas.

        These files are an exact replica of what would live on HDFS.
        In production they would not exist locally; HiveReader would
        use _read_hive() instead.
        """
        csv_dir = Path(LOCAL_CSV_DIR)
        if not csv_dir.exists():
            raise FileNotFoundError(
                f"LOCAL_CSV_DIR '{csv_dir.resolve()}' not found.\n"
                "Run:  python scripts/generate_sample_csv.py"
            )

        csv_files = sorted(csv_dir.glob("*.csv"))
        if not csv_files:
            raise FileNotFoundError(
                f"No CSV files found in '{csv_dir.resolve()}'.\n"
                "Run:  python scripts/generate_sample_csv.py"
            )

        frames = []
        for f in csv_files:
            log.info("[HiveReader] LOCAL  reading %s", f.name)
            frames.append(pd.read_csv(f))

        self.source = f"LOCAL:{csv_dir.resolve()}"
        df = pd.concat(frames, ignore_index=True)
        log.info("[HiveReader] LOCAL  loaded %d rows from %d file(s)",
                 len(df), len(csv_files))
        return df

    # ── Mode 2: Hive Cluster (PRODUCTION) ────────────────────

    def _read_hive(self, custom_query: str | None = None) -> pd.DataFrame:
        """
        Read energy data from Hive via SparkSession.enableHiveSupport().

        Spark connects to the Hive Metastore (thrift protocol) to
        resolve the table location, schema, and partition metadata.
        No raw HDFS path is needed in the job code.

        PySpark pattern (what this implements):
        ----------------------------------------
            spark = (
                SparkSession.builder
                .appName("CampusEnergyHive")
                .config("hive.metastore.uris", HIVE_METASTORE_URI)
                .config("spark.sql.warehouse.dir", HIVE_WAREHOUSE_DIR)
                .enableHiveSupport()
                .getOrCreate()
            )
            sdf = spark.sql("SELECT * FROM campus_energy.energy_records")
            df  = sdf.toPandas()

        Partition pruning is automatic:
            spark.sql("SELECT * FROM campus_energy.energy_records
                       WHERE year_num = 2025")
            → Only 12 HDFS directories scanned, not all 24.
        """
        try:
            from pyspark.sql import SparkSession  # type: ignore
        except ImportError as exc:
            raise ImportError(
                "PySpark not installed. "
                "Run: pip install pyspark  OR  set SPARK_LOCAL_MODE=true"
            ) from exc

        query = custom_query or f"SELECT * FROM {HIVE_FULL_TABLE}"
        log.info("[HiveReader] HIVE   metastore=%s  query=%s",
                 HIVE_METASTORE_URI, query)

        spark = (
            SparkSession.builder
            .appName("CampusEnergyHive")
            # Hive Metastore connection
            .config("hive.metastore.uris",             HIVE_METASTORE_URI)
            .config("spark.sql.warehouse.dir",
                    f"{HDFS_NAMENODE}{HIVE_WAREHOUSE_DIR}")
            # Tell Spark to use Hive catalog implementation
            .config("spark.sql.catalogImplementation", "hive")
            # Parquet optimisations (matches Hive table settings)
            .config("spark.sql.parquet.filterPushdown",          "true")
            .config("spark.sql.parquet.mergeSchema",             "false")
            .config("spark.sql.hive.convertMetastoreParquet",    "true")
            # Enable Hive support (loads hive-site.xml from HIVE_CONF_DIR)
            .enableHiveSupport()
            .getOrCreate()
        )

        # Set active database so unqualified table names resolve correctly
        spark.sql(f"USE {HIVE_DATABASE}")

        sdf = spark.sql(query)
        df  = sdf.toPandas()

        self.source = f"HIVE:{HIVE_METASTORE_URI}/{HIVE_FULL_TABLE}"
        log.info("[HiveReader] HIVE   loaded %d rows from %s",
                 len(df), HIVE_FULL_TABLE)
        return df

    def read_view(self, view_name: str) -> pd.DataFrame:
        """
        Read a pre-defined Hive View directly.

        Example views (created by hive/queries/*.hql):
            campus_energy.vw_wastage_summary
            campus_energy.vw_heatmap
            campus_energy.vw_monthly_trends
            campus_energy.vw_daily_trends

        Usage:
            reader = HiveReader()
            df = reader.read_view("vw_wastage_summary")
        """
        full_view = f"{HIVE_DATABASE}.{view_name}"
        return self.read(hive_query=f"SELECT * FROM {full_view}")

    def read_partitioned(self, year: int | None = None,
                         month: int | None = None) -> pd.DataFrame:
        """
        Read with explicit partition pruning applied.

        Uses WHERE clause on partition columns (year_num, month_num)
        so Hive/Spark skips irrelevant HDFS directories entirely.

        Parameters
        ----------
        year : int | None
            If given, restrict to this calendar year.
        month : int | None
            If given, restrict to this month (1–12).
            Only used when year is also provided.

        Example:
            reader = HiveReader()
            df = reader.read_partitioned(year=2025, month=3)
            # → Scans only:
            #   /hive/warehouse/.../energy_records/year_num=2025/month_num=3/
        """
        filters = []
        if year:
            filters.append(f"year_num = {year}")
        if year and month:
            filters.append(f"month_num = {month}")

        where = f"WHERE {' AND '.join(filters)}" if filters else ""
        query = f"SELECT * FROM {HIVE_FULL_TABLE} {where}"

        log.info("[HiveReader] HIVE   partition-pruned query: %s", query)
        return self.read(hive_query=query)

    # ── Mode 3: HDFS Fallback (no Hive) ──────────────────────

    def _read_hdfs_fallback(self) -> pd.DataFrame:
        """
        Read raw CSV files directly from HDFS without Hive.

        Kept for compatibility with deployments that have HDFS but
        no Hive Metastore. Prefer _read_hive() for production.

        Bypasses Hive schema governance — column types are inferred
        by Spark, which may differ from the Hive DDL definitions.
        """
        try:
            from pyspark.sql import SparkSession  # type: ignore
        except ImportError as exc:
            raise ImportError(
                "PySpark not installed. "
                "Run: pip install pyspark  OR  set SPARK_LOCAL_MODE=true"
            ) from exc

        hdfs_path = f"{HDFS_NAMENODE}{HDFS_DATA_PATH}"
        log.info("[HiveReader] HDFS   (no-Hive fallback) reading %s", hdfs_path)

        spark = (
            SparkSession.builder
            .appName("CampusEnergyHDFS")
            .config("spark.hadoop.fs.defaultFS", HDFS_NAMENODE)
            .getOrCreate()
        )

        sdf = spark.read.csv(hdfs_path, header=True, inferSchema=True)
        df  = sdf.toPandas()

        self.source = f"HDFS:{hdfs_path}"
        log.info("[HiveReader] HDFS   loaded %d rows", len(df))
        return df

    # ── Type normalisation ────────────────────────────────────

    @staticmethod
    def _cast_types(df: pd.DataFrame) -> pd.DataFrame:
        """
        Enforce expected column types regardless of source backend.

        Hive / Parquet columns arrive with correct types when reading
        from the partitioned table. CSV and fallback paths may return
        string columns that need casting.
        """
        if df.empty:
            return df

        df = df.copy()

        int_cols = ["hour_of_day", "day_of_week", "day_of_month",
                    "month_num", "year_num"]
        for col in int_cols:
            if col in df.columns:
                df[col] = (
                    pd.to_numeric(df[col], errors="coerce")
                    .fillna(0).astype("int32")
                )

        if "consumption_kwh" in df.columns:
            df["consumption_kwh"] = (
                pd.to_numeric(df["consumption_kwh"], errors="coerce").fillna(0.0)
            )

        for bool_col in ("is_weekend", "is_holiday"):
            if bool_col in df.columns:
                # Handles: True/False objects (Hive/Parquet), "true"/"false"
                # strings (CSV), 1/0 integers
                col_data = df[bool_col]
                if col_data.dtype == bool:
                    pass  # already boolean from Parquet
                else:
                    df[bool_col] = (
                        col_data.astype(str).str.lower()
                        .isin(("true", "1", "yes"))
                    )

        return df
