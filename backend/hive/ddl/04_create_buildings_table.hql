-- =============================================================
-- 04_create_buildings_table.hql
-- Campus Energy Analysis — Building Metadata External Table
-- =============================================================
-- Small lookup table containing building reference data.
-- Used as a broadcast join target in Spark jobs to avoid
-- repeatedly querying MySQL for metadata.
--
-- Concept: Hive small-table broadcast (equivalent to Spark's
-- broadcast() hint on a small DataFrame).
--
-- HDFS Location:
--   /energy/buildings/buildings.csv
--
-- Generate the CSV with:
--   python scripts/generate_buildings_csv.py
-- Then upload:
--   hdfs dfs -mkdir -p /energy/buildings/
--   hdfs dfs -put data/buildings/buildings.csv /energy/buildings/
-- =============================================================

USE campus_energy;

CREATE EXTERNAL TABLE IF NOT EXISTS buildings_meta (
    building_code  STRING  COMMENT 'Short code: CB-A, LB-B, LIB, HST',
    building_name  STRING  COMMENT 'Full building name',
    building_type  STRING  COMMENT 'classroom | laboratory | library | hostel',
    capacity       INT     COMMENT 'Approximate occupant capacity',
    area_sqft      INT     COMMENT 'Floor area in square feet'
)
COMMENT 'Campus building reference data — broadcast join target for Spark analytics'
ROW FORMAT DELIMITED
    FIELDS TERMINATED BY ','
    LINES  TERMINATED BY '\n'
STORED AS TEXTFILE
LOCATION 'hdfs://namenode:9000/energy/buildings/'
TBLPROPERTIES (
    'skip.header.line.count' = '1'
);

-- ── Usage in Hive / Spark SQL ─────────────────────────────────
-- Hive join:
--   SELECT e.building_name, b.building_type, SUM(e.consumption_kwh)
--   FROM campus_energy.energy_records e
--   JOIN campus_energy.buildings_meta b ON e.building_code = b.building_code
--   GROUP BY e.building_name, b.building_type;
--
-- Spark SQL (with broadcast hint):
--   spark.sql("""
--       SELECT /*+ BROADCAST(b) */
--           e.building_name, b.building_type, SUM(e.consumption_kwh)
--       FROM campus_energy.energy_records e
--       JOIN campus_energy.buildings_meta b ON e.building_code = b.building_code
--       GROUP BY e.building_name, b.building_type
--   """)

DESCRIBE campus_energy.buildings_meta;
SELECT * FROM campus_energy.buildings_meta;
