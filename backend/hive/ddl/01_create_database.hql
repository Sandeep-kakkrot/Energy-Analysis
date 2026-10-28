-- =============================================================
-- 01_create_database.hql
-- Campus Energy Analysis — Hive Database Setup
-- =============================================================
-- Run with:
--   beeline -u jdbc:hive2://localhost:10000 -f hive/ddl/01_create_database.hql
--   OR
--   hive -f hive/ddl/01_create_database.hql
-- =============================================================

-- Create the campus_energy Hive database.
-- The LOCATION clause points to a directory on HDFS that will
-- act as the root for all managed tables in this database.
-- External tables specify their own LOCATION independently.

CREATE DATABASE IF NOT EXISTS campus_energy
  COMMENT 'Campus electricity consumption analytics — Big Data Platform'
  LOCATION 'hdfs://namenode:9000/hive/warehouse/campus_energy.db'
  WITH DBPROPERTIES (
    'created_by' = 'campus-energy-analysis',
    'version'    = '1.0',
    'purpose'    = 'Energy analytics using Hadoop HDFS + Apache Hive + Spark'
  );

-- Confirm creation
SHOW DATABASES LIKE 'campus_energy';
DESCRIBE DATABASE EXTENDED campus_energy;
