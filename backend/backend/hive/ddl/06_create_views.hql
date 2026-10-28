-- =============================================================
-- 06_create_views.hql
-- Campus Energy Analysis — Hive Views (all four)
-- =============================================================
-- Creates all pre-aggregated Hive Views in one pass.
-- These views are the data sources that Spark reads via:
--     reader.read_view("vw_wastage_summary")
--     spark.sql("SELECT * FROM campus_energy.vw_heatmap")
--
-- Run AFTER 05_load_partitions.hql
--
-- Views created:
--   vw_wastage_summary   — per-building off-hours + weekend wastage %
--   vw_heatmap           — 24h x 7-day avg kWh per building cell
--   vw_monthly_trends    — monthly totals per building
--   vw_daily_trends      — daily totals per building
-- =============================================================

USE campus_energy;

-- ──────────────────────────────────────────────────────────────
-- 1. Wastage Summary
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW campus_energy.vw_wastage_summary AS
SELECT
    building_name,
    building_code,
    COUNT(*)                                                                   AS record_count,
    ROUND(SUM(consumption_kwh), 4)                                             AS total_kwh,
    ROUND(SUM(CASE
                  WHEN hour_of_day < 6 OR hour_of_day >= 22
                  THEN consumption_kwh ELSE 0
              END), 4)                                                          AS off_hours_kwh,
    ROUND(SUM(CASE
                  WHEN is_weekend = true
                   AND NOT (hour_of_day < 6 OR hour_of_day >= 22)
                  THEN consumption_kwh ELSE 0
              END), 4)                                                          AS weekend_kwh,
    ROUND(SUM(CASE
                  WHEN hour_of_day < 6 OR hour_of_day >= 22
                    OR is_weekend = true
                  THEN consumption_kwh ELSE 0
              END), 4)                                                          AS total_wastage_kwh,
    ROUND(SUM(CASE
                  WHEN hour_of_day < 6 OR hour_of_day >= 22
                    OR is_weekend = true
                  THEN consumption_kwh ELSE 0
              END) / SUM(consumption_kwh) * 100, 4)                            AS wastage_pct,
    CASE
        WHEN SUM(CASE
                     WHEN hour_of_day < 6 OR hour_of_day >= 22
                       OR is_weekend = true
                     THEN consumption_kwh ELSE 0
                 END) / SUM(consumption_kwh) * 100 > 25 THEN 'high'
        WHEN SUM(CASE
                     WHEN hour_of_day < 6 OR hour_of_day >= 22
                       OR is_weekend = true
                     THEN consumption_kwh ELSE 0
                 END) / SUM(consumption_kwh) * 100 > 15 THEN 'medium'
        ELSE 'low'
    END                                                                         AS severity
FROM campus_energy.energy_records
GROUP BY building_name, building_code;

-- ──────────────────────────────────────────────────────────────
-- 2. Heatmap (24h x 7-day)
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW campus_energy.vw_heatmap AS
SELECT
    hour_of_day,
    day_of_week,
    CASE day_of_week
        WHEN 0 THEN 'Monday'    WHEN 1 THEN 'Tuesday'
        WHEN 2 THEN 'Wednesday' WHEN 3 THEN 'Thursday'
        WHEN 4 THEN 'Friday'    WHEN 5 THEN 'Saturday'
        WHEN 6 THEN 'Sunday'
    END                                   AS day_name,
    building_name,
    ROUND(AVG(consumption_kwh), 6)        AS avg_kwh,
    ROUND(SUM(consumption_kwh), 4)        AS total_kwh,
    COUNT(*)                              AS observation_count
FROM campus_energy.energy_records
GROUP BY hour_of_day, day_of_week, building_name;

-- ──────────────────────────────────────────────────────────────
-- 3. Monthly Trends
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW campus_energy.vw_monthly_trends AS
SELECT
    year_num,
    month_num,
    CASE month_num
        WHEN  1 THEN 'January'   WHEN  2 THEN 'February'
        WHEN  3 THEN 'March'     WHEN  4 THEN 'April'
        WHEN  5 THEN 'May'       WHEN  6 THEN 'June'
        WHEN  7 THEN 'July'      WHEN  8 THEN 'August'
        WHEN  9 THEN 'September' WHEN 10 THEN 'October'
        WHEN 11 THEN 'November'  WHEN 12 THEN 'December'
    END                                   AS month_name,
    building_name,
    building_code,
    ROUND(SUM(consumption_kwh), 4)        AS total_kwh,
    ROUND(AVG(consumption_kwh), 6)        AS avg_kwh_per_hour,
    COUNT(*)                              AS record_count
FROM campus_energy.energy_records
GROUP BY year_num, month_num, building_name, building_code;

-- ──────────────────────────────────────────────────────────────
-- 4. Daily Trends
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW campus_energy.vw_daily_trends AS
SELECT
    CONCAT(
        LPAD(CAST(year_num     AS STRING), 4, '0'), '-',
        LPAD(CAST(month_num    AS STRING), 2, '0'), '-',
        LPAD(CAST(day_of_month AS STRING), 2, '0')
    )                                     AS rec_date,
    year_num,
    month_num,
    day_of_month,
    building_name,
    building_code,
    ROUND(SUM(consumption_kwh), 4)        AS total_kwh,
    ROUND(AVG(consumption_kwh), 6)        AS avg_kwh_per_hour,
    COUNT(*)                              AS record_count
FROM campus_energy.energy_records
GROUP BY year_num, month_num, day_of_month, building_name, building_code;

-- ── Confirm ───────────────────────────────────────────────────
SHOW VIEWS IN campus_energy;
