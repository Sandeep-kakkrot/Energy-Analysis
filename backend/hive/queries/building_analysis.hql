-- =============================================================
-- building_analysis.hql
-- Campus Energy Analysis — Building Comparison Queries
-- =============================================================
-- These queries mirror the Spark job: job_building_comparison.py
-- They can be run standalone via beeline/hive for ad-hoc analysis,
-- or used as Hive Views that Spark reads via spark.sql().
--
-- Run: beeline -u jdbc:hive2://localhost:10000 \
--              -f hive/queries/building_analysis.hql
-- =============================================================

USE campus_energy;

-- ──────────────────────────────────────────────────────────────
-- Q1: Per-building total and average consumption
--     Mirrors: job_building_comparison.py → groupBy("building_name").agg()
-- ──────────────────────────────────────────────────────────────
SELECT
    e.building_name,
    b.building_type,
    b.capacity,
    b.area_sqft,
    COUNT(*)                                  AS record_count,
    ROUND(SUM(e.consumption_kwh),       2)    AS total_kwh,
    ROUND(AVG(e.consumption_kwh),       4)    AS avg_kwh_per_hour,
    ROUND(SUM(e.consumption_kwh)
          / b.area_sqft,               4)    AS intensity_kwh_per_sqft
FROM campus_energy.energy_records e
    -- Broadcast join hint: buildings_meta is tiny (~4 rows)
    JOIN campus_energy.buildings_meta b
      ON e.building_code = b.building_code
GROUP BY
    e.building_name, b.building_type, b.capacity, b.area_sqft
ORDER BY total_kwh DESC;


-- ──────────────────────────────────────────────────────────────
-- Q2: Per-building percentage share of campus-wide total
--     Uses Hive window function to compute grand total in one pass
-- ──────────────────────────────────────────────────────────────
SELECT
    building_name,
    ROUND(total_kwh, 2)                              AS total_kwh,
    ROUND(total_kwh / SUM(total_kwh) OVER () * 100, 2) AS pct_share
FROM (
    SELECT
        building_name,
        SUM(consumption_kwh) AS total_kwh
    FROM campus_energy.energy_records
    GROUP BY building_name
) t
ORDER BY total_kwh DESC;


-- ──────────────────────────────────────────────────────────────
-- Q3: Building performance rank by energy intensity
--     Lower kWh/sqft = more efficient use of space
-- ──────────────────────────────────────────────────────────────
SELECT
    e.building_name,
    b.building_type,
    b.area_sqft,
    ROUND(SUM(e.consumption_kwh), 2)          AS total_kwh,
    ROUND(SUM(e.consumption_kwh) / b.area_sqft, 4) AS intensity_kwh_per_sqft,
    RANK() OVER (ORDER BY SUM(e.consumption_kwh) / b.area_sqft ASC)
        AS efficiency_rank
FROM campus_energy.energy_records e
JOIN campus_energy.buildings_meta b ON e.building_code = b.building_code
GROUP BY e.building_name, b.building_type, b.area_sqft
ORDER BY efficiency_rank;


-- ──────────────────────────────────────────────────────────────
-- Q4: Year-over-year comparison per building
-- ──────────────────────────────────────────────────────────────
SELECT
    building_name,
    year_num,
    ROUND(SUM(consumption_kwh), 2) AS total_kwh,
    ROUND(SUM(consumption_kwh)
          - LAG(SUM(consumption_kwh)) OVER (
              PARTITION BY building_name ORDER BY year_num
          ), 2)                             AS yoy_change_kwh
FROM campus_energy.energy_records
GROUP BY building_name, year_num
ORDER BY building_name, year_num;
