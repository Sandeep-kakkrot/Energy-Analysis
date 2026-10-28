-- =============================================================
-- 03_create_partitioned_table.hql
-- Campus Energy Analysis — Partitioned Analytics Table
-- =============================================================
-- This is the PRIMARY table that Spark reads from.
-- It is partitioned by (year_num, month_num) so Spark and Hive
-- can apply partition pruning — e.g. querying only year=2025
-- skips all 2024 data at the HDFS file level, not just at scan time.
--
-- Stored as PARQUET instead of CSV for:
--   - Columnar compression (typically 3–10× smaller)
--   - Predicate pushdown (Hive/Spark only read relevant column chunks)
--   - Faster aggregations on numeric columns
--
-- Data is loaded from energy_records_raw via script 05_load_partitions.hql
--
-- HDFS Layout created by this table:
--   /hive/warehouse/campus_energy.db/energy_records/
--     year_num=2024/month_num=1/part-00000.parquet
--     year_num=2024/month_num=2/part-00000.parquet
--     ...
--     year_num=2025/month_num=12/part-00000.parquet
-- =============================================================

USE campus_energy;

CREATE EXTERNAL TABLE IF NOT EXISTS energy_records (
    timestamp        STRING    COMMENT 'ISO-8601 timestamp of hourly measurement',
    building_code    STRING    COMMENT 'Short code: CB-A, LB-B, LIB, HST',
    building_name    STRING    COMMENT 'Full building name',
    consumption_kwh  DOUBLE    COMMENT 'Electricity consumed in that hour (kWh)',
    hour_of_day      INT       COMMENT 'Hour 0..23',
    day_of_week      INT       COMMENT '0=Monday ... 6=Sunday',
    day_of_month     INT       COMMENT '1..31',
    is_weekend       BOOLEAN   COMMENT 'True if Saturday or Sunday',
    is_holiday       BOOLEAN   COMMENT 'True if national/institutional holiday'
)
COMMENT 'Partitioned Parquet analytics table — primary source for Spark SQL queries'
PARTITIONED BY (
    year_num   INT  COMMENT 'Partition key: calendar year (2024, 2025 ...)',
    month_num  INT  COMMENT 'Partition key: calendar month (1..12)'
)
STORED AS PARQUET
LOCATION 'hdfs://namenode:9000/hive/warehouse/campus_energy.db/energy_records'
TBLPROPERTIES (
    'parquet.compression'          = 'SNAPPY',
    'hive.exec.dynamic.partition'  = 'true'
);

-- ── Partition statistics ───────────────────────────────────────
-- After loading, run:
-- MSCK REPAIR TABLE campus_energy.energy_records;   -- discover partitions
-- SHOW PARTITIONS campus_energy.energy_records;

-- ── Index hints for Spark ──────────────────────────────────────
-- Spark accesses this table via:
--   spark.sql("SELECT * FROM campus_energy.energy_records WHERE year_num = 2025")
-- Partition pruning eliminates all other year directories at the storage layer.
DESCRIBE EXTENDED campus_energy.energy_records;
