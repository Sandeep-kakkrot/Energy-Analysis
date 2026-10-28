-- =============================================================
-- 02_create_external_table_raw.hql
-- Campus Energy Analysis — Raw Energy Records External Table
-- =============================================================
-- This is an EXTERNAL table. Hive only manages the metadata
-- (schema, column names, SerDe). The actual data files remain
-- in their original HDFS location: hdfs://namenode:9000/energy/raw/
--
-- Dropping this table does NOT delete the HDFS files.
-- Any new CSV files added to the HDFS directory are automatically
-- included in subsequent queries (no ALTER TABLE required).
--
-- HDFS Layout expected:
--   /energy/raw/CB-A_energy.csv
--   /energy/raw/LB-B_energy.csv
--   /energy/raw/LIB_energy.csv
--   /energy/raw/HST_energy.csv
--
-- CSV Schema (header row in each file):
--   timestamp, building_code, building_name, consumption_kwh,
--   hour_of_day, day_of_week, day_of_month, month_num, year_num,
--   is_weekend, is_holiday
-- =============================================================

USE campus_energy;

CREATE EXTERNAL TABLE IF NOT EXISTS energy_records_raw (
    timestamp        STRING    COMMENT 'ISO-8601 timestamp of hourly measurement',
    building_code    STRING    COMMENT 'Short code: CB-A, LB-B, LIB, HST',
    building_name    STRING    COMMENT 'Full building name',
    consumption_kwh  DOUBLE    COMMENT 'Electricity consumed in that hour (kWh)',
    hour_of_day      INT       COMMENT 'Hour 0..23',
    day_of_week      INT       COMMENT '0=Monday ... 6=Sunday',
    day_of_month     INT       COMMENT '1..31',
    month_num        INT       COMMENT '1..12',
    year_num         INT       COMMENT 'e.g. 2024',
    is_weekend       BOOLEAN   COMMENT 'True if Saturday or Sunday',
    is_holiday       BOOLEAN   COMMENT 'True if national/institutional holiday'
)
COMMENT 'Raw hourly energy consumption — external table over HDFS CSV files'
ROW FORMAT DELIMITED
    FIELDS TERMINATED BY ','
    LINES  TERMINATED BY '\n'
STORED AS TEXTFILE
LOCATION 'hdfs://namenode:9000/energy/raw/'
TBLPROPERTIES (
    'skip.header.line.count' = '1',
    'serialization.null.format' = '',
    'immutable'              = 'false'
);

-- ── Validate ──────────────────────────────────────────────────
SHOW TABLES IN campus_energy;
DESCRIBE EXTENDED campus_energy.energy_records_raw;

-- Quick row-count sanity check (runs a MapReduce / Tez job)
-- SELECT COUNT(*) FROM campus_energy.energy_records_raw;
