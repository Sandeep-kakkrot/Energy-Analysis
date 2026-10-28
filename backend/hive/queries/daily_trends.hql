-- =============================================================
-- daily_trends.hql
-- Campus Energy Analysis — Daily Time-Series Queries
-- =============================================================
-- Mirrors: job_daily_trends.py
-- =============================================================

USE campus_energy;

-- ──────────────────────────────────────────────────────────────
-- Q1: Daily total per building
--     Mirrors PySpark: groupBy(year,month,day,building).agg(sum) → pivot
-- ──────────────────────────────────────────────────────────────
SELECT
    CONCAT(LPAD(CAST(year_num     AS STRING), 4, '0'), '-',
           LPAD(CAST(month_num    AS STRING), 2, '0'), '-',
           LPAD(CAST(day_of_month AS STRING), 2, '0')) AS rec_date,
    building_name,
    ROUND(SUM(consumption_kwh), 2) AS total_kwh
FROM campus_energy.energy_records
GROUP BY year_num, month_num, day_of_month, building_name
ORDER BY rec_date, building_name;


-- ──────────────────────────────────────────────────────────────
-- Q2: Campus-wide daily total with 7-day rolling average
--     ROWS BETWEEN 6 PRECEDING AND CURRENT ROW = rolling window
-- ──────────────────────────────────────────────────────────────
SELECT
    rec_date,
    ROUND(daily_total, 2)                             AS total_kwh,
    ROUND(AVG(daily_total) OVER (
        ORDER BY rec_date
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ), 2)                                             AS rolling_7d_avg
FROM (
    SELECT
        CONCAT(LPAD(CAST(year_num     AS STRING), 4, '0'), '-',
               LPAD(CAST(month_num    AS STRING), 2, '0'), '-',
               LPAD(CAST(day_of_month AS STRING), 2, '0')) AS rec_date,
        SUM(consumption_kwh) AS daily_total
    FROM campus_energy.energy_records
    GROUP BY year_num, month_num, day_of_month
) daily
ORDER BY rec_date;


-- ──────────────────────────────────────────────────────────────
-- Q3: Last 30 days (partition-pruned approximation)
--     In a live system, replace the year/month literals with
--     dynamic values computed at runtime.
-- ──────────────────────────────────────────────────────────────
SELECT
    CONCAT(LPAD(CAST(year_num     AS STRING), 4, '0'), '-',
           LPAD(CAST(month_num    AS STRING), 2, '0'), '-',
           LPAD(CAST(day_of_month AS STRING), 2, '0')) AS rec_date,
    building_name,
    ROUND(SUM(consumption_kwh), 2) AS total_kwh
FROM campus_energy.energy_records
WHERE year_num  = 2025
  AND month_num IN (7, 8)          -- Partition pruning: only 2 partitions scanned
GROUP BY year_num, month_num, day_of_month, building_name
ORDER BY rec_date, building_name;


-- ──────────────────────────────────────────────────────────────
-- Q4: Daily trends VIEW for Spark SQL
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW campus_energy.vw_daily_trends AS
SELECT
    CONCAT(LPAD(CAST(year_num     AS STRING), 4, '0'), '-',
           LPAD(CAST(month_num    AS STRING), 2, '0'), '-',
           LPAD(CAST(day_of_month AS STRING), 2, '0')) AS rec_date,
    building_name,
    ROUND(SUM(consumption_kwh), 2)                     AS total_kwh
FROM campus_energy.energy_records
GROUP BY year_num, month_num, day_of_month, building_name;
