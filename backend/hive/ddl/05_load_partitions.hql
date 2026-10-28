-- =============================================================
-- 05_load_partitions.hql
-- Campus Energy Analysis — Load Partitioned Parquet Table
-- =============================================================
-- Transfers data from the raw CSV external table into the
-- partitioned Parquet analytics table using dynamic partitioning.
--
-- Run AFTER:
--   01_create_database.hql
--   02_create_external_table_raw.hql
--   03_create_partitioned_table.hql
--
-- Dynamic partitioning automatically creates one HDFS directory
-- per (year_num, month_num) combination found in the source data.
-- No manual PARTITION clause needed — Hive infers the values.
--
-- Runtime: ~2–5 min on a 3-node cluster for 70,000 rows
-- =============================================================

USE campus_energy;

-- ── Enable dynamic partitioning ───────────────────────────────
-- Required for INSERT ... PARTITION (year_num, month_num) without
-- specifying exact partition values.
SET hive.exec.dynamic.partition        = true;
SET hive.exec.dynamic.partition.mode   = nonstrict;
SET hive.exec.max.dynamic.partitions   = 500;
SET hive.exec.max.dynamic.partitions.pernode = 200;

-- ── Performance settings ──────────────────────────────────────
SET hive.vectorized.execution.enabled  = true;
SET hive.vectorized.execution.reduce.enabled = true;
SET mapreduce.job.reduces              = 4;
SET parquet.compression                = SNAPPY;

-- ── Load from raw CSV → partitioned Parquet ───────────────────
-- IMPORTANT: Partition columns (year_num, month_num) must appear
-- LAST in the SELECT list, matching the PARTITIONED BY clause order.
INSERT OVERWRITE TABLE campus_energy.energy_records
PARTITION (year_num, month_num)
SELECT
    timestamp,
    building_code,
    building_name,
    consumption_kwh,
    hour_of_day,
    day_of_week,
    day_of_month,
    is_weekend,
    is_holiday,
    year_num,    -- partition key (last)
    month_num    -- partition key (last)
FROM campus_energy.energy_records_raw
WHERE consumption_kwh IS NOT NULL
  AND building_code   IS NOT NULL;

-- ── Discover partitions & repair metadata ─────────────────────
-- Required if files were added directly to HDFS bypassing Hive DDL
MSCK REPAIR TABLE campus_energy.energy_records;

-- ── Validate result ───────────────────────────────────────────
SHOW PARTITIONS campus_energy.energy_records;

SELECT
    year_num,
    month_num,
    COUNT(*)             AS row_count,
    ROUND(SUM(consumption_kwh), 2) AS total_kwh
FROM campus_energy.energy_records
GROUP BY year_num, month_num
ORDER BY year_num, month_num;
