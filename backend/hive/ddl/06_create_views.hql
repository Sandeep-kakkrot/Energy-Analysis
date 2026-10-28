-- =============================================================
-- 06_create_views.hql
-- Campus Energy Analysis — Hive Views
-- =============================================================
-- Run with:
--   beeline -u jdbc:hive2://localhost:10000 -f hive/ddl/06_create_views.hql
--   OR
--   hive -f hive/ddl/06_create_views.hql
--
-- Prerequisites: DDL scripts 01–05 must have been executed first.
--   The energy_records (Parquet, partitioned) table must exist and
--   be populated before these views will return data.
--
-- Views created:
--   vw_wastage_summary   Off-hours + weekend wastage summary per building
--   vw_heatmap           24h × 7-day average kWh grid per building
--   vw_monthly_trends    Monthly aggregated kWh per building
--   vw_daily_trends      Daily aggregated kWh per building
-- =============================================================

USE campus_energy;

-- =============================================================
-- 1. vw_wastage_summary
-- Pre-grouped off-hours wastage per building.
--
-- Off-hours  = hour_of_day < 6 OR hour_of_day >= 22
-- Weekend    = is_weekend = TRUE AND NOT off-hours (avoid double-count)
-- Severity   = 'high' if wastage_pct >= 35, 'medium' >= 20, else 'low'
--
-- Consumed by:
--   Spark: spark.sql("SELECT * FROM campus_energy.vw_wastage_summary")
--   Python: reader.read_view("vw_wastage_summary")
-- =============================================================
DROP VIEW IF EXISTS vw_wastage_summary;

CREATE VIEW vw_wastage_summary AS
SELECT
    building_name,
    building_code,

    -- Total energy consumed
    ROUND(SUM(consumption_kwh), 4)                                   AS total_kwh,

    -- Off-hours energy (midnight–05:59, 22:00–23:59)
    ROUND(SUM(CASE
        WHEN hour_of_day < 6 OR hour_of_day >= 22
        THEN consumption_kwh
        ELSE 0
    END), 4)                                                         AS off_hours_kwh,

    -- Weekend energy NOT already counted in off-hours
    ROUND(SUM(CASE
        WHEN is_weekend = TRUE
         AND NOT (hour_of_day < 6 OR hour_of_day >= 22)
        THEN consumption_kwh
        ELSE 0
    END), 4)                                                         AS weekend_kwh,

    -- Total wastage = off-hours + weekend (no double-counting)
    ROUND(SUM(CASE WHEN hour_of_day < 6 OR hour_of_day >= 22
                   THEN consumption_kwh ELSE 0 END)
        + SUM(CASE WHEN is_weekend = TRUE
                    AND NOT (hour_of_day < 6 OR hour_of_day >= 22)
                   THEN consumption_kwh ELSE 0 END), 4)              AS total_wastage_kwh,

    -- Wastage percentage
    ROUND(
        (   SUM(CASE WHEN hour_of_day < 6 OR hour_of_day >= 22
                     THEN consumption_kwh ELSE 0 END)
          + SUM(CASE WHEN is_weekend = TRUE
                      AND NOT (hour_of_day < 6 OR hour_of_day >= 22)
                     THEN consumption_kwh ELSE 0 END)
        ) / NULLIF(SUM(consumption_kwh), 0) * 100,
    4)                                                               AS wastage_pct,

    -- Severity tier
    CASE
        WHEN (   SUM(CASE WHEN hour_of_day < 6 OR hour_of_day >= 22
                          THEN consumption_kwh ELSE 0 END)
               + SUM(CASE WHEN is_weekend = TRUE
                           AND NOT (hour_of_day < 6 OR hour_of_day >= 22)
                          THEN consumption_kwh ELSE 0 END)
             ) / NULLIF(SUM(consumption_kwh), 0) * 100 >= 35.0
        THEN 'high'
        WHEN (   SUM(CASE WHEN hour_of_day < 6 OR hour_of_day >= 22
                          THEN consumption_kwh ELSE 0 END)
               + SUM(CASE WHEN is_weekend = TRUE
                           AND NOT (hour_of_day < 6 OR hour_of_day >= 22)
                          THEN consumption_kwh ELSE 0 END)
             ) / NULLIF(SUM(consumption_kwh), 0) * 100 >= 20.0
        THEN 'medium'
        ELSE 'low'
    END                                                              AS severity

FROM campus_energy.energy_records
GROUP BY building_name, building_code
ORDER BY wastage_pct DESC;


-- =============================================================
-- 2. vw_heatmap
-- Average kWh per hour_of_day × day_of_week cell, per building.
-- Produces a 24 × 7 grid suitable for a heat-map visualisation.
--
-- day_of_week: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
-- =============================================================
DROP VIEW IF EXISTS vw_heatmap;

CREATE VIEW vw_heatmap AS
SELECT
    building_name,
    building_code,
    hour_of_day,
    day_of_week,
    ROUND(AVG(consumption_kwh), 6)   AS avg_kwh,
    ROUND(SUM(consumption_kwh), 4)   AS total_kwh,
    COUNT(1)                         AS sample_count
FROM campus_energy.energy_records
GROUP BY building_name, building_code, hour_of_day, day_of_week
ORDER BY building_name, day_of_week, hour_of_day;


-- =============================================================
-- 3. vw_monthly_trends
-- Monthly total kWh per building, with month-over-month delta.
--
-- mom_delta_kwh = current month total − previous month total
--                 (NULL for the first month in the dataset)
-- =============================================================
DROP VIEW IF EXISTS vw_monthly_trends;

CREATE VIEW vw_monthly_trends AS
WITH monthly_base AS (
    SELECT
        year_num,
        month_num,
        building_name,
        building_code,
        ROUND(SUM(consumption_kwh), 4)   AS total_kwh,
        ROUND(AVG(consumption_kwh), 6)   AS avg_kwh_per_hour,
        COUNT(1)                         AS record_count
    FROM campus_energy.energy_records
    GROUP BY year_num, month_num, building_name, building_code
)
SELECT
    mb.year_num,
    mb.month_num,
    mb.building_name,
    mb.building_code,
    mb.total_kwh,
    mb.avg_kwh_per_hour,
    mb.record_count,
    -- Month-over-month delta (LAG window function)
    ROUND(
        mb.total_kwh -
        LAG(mb.total_kwh) OVER (
            PARTITION BY mb.building_name
            ORDER BY mb.year_num, mb.month_num
        ),
    4)                                   AS mom_delta_kwh
FROM monthly_base mb
ORDER BY mb.building_name, mb.year_num, mb.month_num;


-- =============================================================
-- 4. vw_daily_trends
-- Daily total kWh per building, with 7-day rolling average.
--
-- Uses a constructed rec_date (YYYY-MM-DD) as the time axis.
-- rolling_avg_7d is the mean of the current day + previous 6 days
-- within the same building's partition (requires 7+ days of data).
-- =============================================================
DROP VIEW IF EXISTS vw_daily_trends;

CREATE VIEW vw_daily_trends AS
WITH daily_base AS (
    SELECT
        CONCAT(
            LPAD(CAST(year_num     AS STRING), 4, '0'), '-',
            LPAD(CAST(month_num    AS STRING), 2, '0'), '-',
            LPAD(CAST(day_of_month AS STRING), 2, '0')
        )                                AS rec_date,
        building_name,
        building_code,
        ROUND(SUM(consumption_kwh), 4)   AS total_kwh,
        ROUND(AVG(consumption_kwh), 6)   AS avg_kwh_per_hour,
        COUNT(1)                         AS record_count,
        MAX(is_weekend)                  AS is_weekend
    FROM campus_energy.energy_records
    GROUP BY year_num, month_num, day_of_month, building_name, building_code
)
SELECT
    db.rec_date,
    db.building_name,
    db.building_code,
    db.total_kwh,
    db.avg_kwh_per_hour,
    db.record_count,
    db.is_weekend,
    -- 7-day rolling average (current row + 6 preceding rows)
    ROUND(
        AVG(db.total_kwh) OVER (
            PARTITION BY db.building_name
            ORDER BY db.rec_date
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        ),
    4)                                   AS rolling_avg_7d
FROM daily_base db
ORDER BY db.building_name, db.rec_date;


-- =============================================================
-- Confirm all views exist
-- =============================================================
SHOW TABLES IN campus_energy LIKE 'vw_*';
