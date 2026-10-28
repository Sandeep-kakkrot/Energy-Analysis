"""
Configuration classes for different environments.
Values are loaded from .env file via python-dotenv.
"""
import os
from dotenv import load_dotenv

load_dotenv()


class BaseConfig:
    SECRET_KEY = os.getenv("SECRET_KEY", "campus-energy-secret")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_SORT_KEYS = False

    # ── JWT Configuration ───────────────────────────────────────
    JWT_SECRET_KEY             = os.getenv("JWT_SECRET_KEY", SECRET_KEY)
    JWT_ACCESS_EXPIRES_MINUTES = int(os.getenv("JWT_ACCESS_EXPIRES_MINUTES", "60"))
    JWT_REFRESH_EXPIRES_DAYS   = int(os.getenv("JWT_REFRESH_EXPIRES_DAYS",   "7"))

    # Build MySQL URI from individual env vars
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "3306")
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "root")
    DB_NAME = os.getenv("DB_NAME", "campus_energy")

    _IS_SERVERLESS = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
    _EXPLICIT_DB = os.getenv("DATABASE_URL") or os.getenv("SQLALCHEMY_DATABASE_URI")
    _DEFAULT_MYSQL_URI = (
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
        "?charset=utf8mb4"
    )

    if _EXPLICIT_DB:
        SQLALCHEMY_DATABASE_URI = _EXPLICIT_DB
        if SQLALCHEMY_DATABASE_URI.startswith("postgres://"):
            SQLALCHEMY_DATABASE_URI = SQLALCHEMY_DATABASE_URI.replace("postgres://", "postgresql://", 1)
    elif _IS_SERVERLESS or os.getenv("USE_SQLITE", "false").lower() in ("1", "true"):
        SQLALCHEMY_DATABASE_URI = "sqlite:////tmp/campus_energy.db"
    else:
        SQLALCHEMY_DATABASE_URI = _DEFAULT_MYSQL_URI

    # ── HDFS + Spark Configuration ─────────────────────────────
    # The Flask API never reads these directly.
    # They are used exclusively by spark_jobs/ modules.
    #
    # SPARK_LOCAL_MODE=true  → Spark jobs read from LOCAL_CSV_DIR
    #                           (no Hadoop cluster required)
    # SPARK_LOCAL_MODE=false → Spark jobs read from Hive or raw HDFS
    HDFS_NAMENODE    = os.getenv("HDFS_NAMENODE",    "hdfs://localhost:9000")
    HDFS_DATA_PATH   = os.getenv("HDFS_DATA_PATH",   "/energy/raw/")
    SPARK_LOCAL_MODE = os.getenv("SPARK_LOCAL_MODE",  "true")
    LOCAL_CSV_DIR    = os.getenv("LOCAL_CSV_DIR",     "data/raw")

    # ── Apache Hive Configuration ───────────────────────────────
    # Only used when SPARK_LOCAL_MODE=false.
    #
    # USE_HIVE=true  (recommended for production)
    #     Spark reads via Hive Metastore:
    #         SparkSession.enableHiveSupport()
    #         spark.sql("SELECT * FROM campus_energy.energy_records")
    #     Benefits: partition pruning, schema governance, Parquet compression.
    #
    # USE_HIVE=false (fallback — bypasses Hive governance)
    #     Spark reads raw CSV directly from HDFS path.
    #     Equivalent to the old HDFSReader behaviour.
    USE_HIVE           = os.getenv("USE_HIVE",            "true")
    HIVE_METASTORE_URI = os.getenv("HIVE_METASTORE_URI",  "thrift://localhost:9083")
    HIVE_DATABASE      = os.getenv("HIVE_DATABASE",       "campus_energy")
    HIVE_TABLE         = os.getenv("HIVE_TABLE",          "energy_records")
    HIVE_WAREHOUSE_DIR = os.getenv("HIVE_WAREHOUSE_DIR",  "/hive/warehouse")


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    SQLALCHEMY_ECHO = False  # Set True to log SQL queries


class TestingConfig(BaseConfig):
    TESTING = True
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SQLALCHEMY_ECHO = False


class ProductionConfig(BaseConfig):
    DEBUG = False
    SQLALCHEMY_ECHO = False


_CONFIG_MAP = {
    "development": DevelopmentConfig,
    "production":  ProductionConfig,
    "testing":     TestingConfig,
}


def get_config(env: str = "development"):
    return _CONFIG_MAP.get(env, DevelopmentConfig)
