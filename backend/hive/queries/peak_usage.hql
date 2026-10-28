-- =============================================================
-- peak_usage.hql
-- Campus Energy Analysis — Peak Hour & Heatmap Queries
-- =============================================================
-- Mirrors: job_peak_usage.py
-- Produces data for the 24h × 7-day heatmap and ranked peak hours
-- =============================================================

USE campus_energy;

-- ──────────────────────────────────────────────────────────────
-- Q1: Average consumption per hour-of-day (ranked)
--     Mirrors PySpark: df.groupBy("hour_of_day").agg(F.avg(...)).orderBy(desc)
-- ──────────────────────────────────────────────────────────────
SELECT
    hour_of_day,
    ROUND(AVG(consumption_kwh), 4)  AS avg_kwh,
    ROUND(SUM(consumption_kwh), 2)  AS total_kwh,
    COUNT(*)                        AS observations,
    RANK() OVER (ORDER BY AVG(consumption_kwh) DESC) AS peak_rank
FROM campus_energy.energy_records
GROUP BY hour_of_day
ORDER BY avg_kwh DESC;


-- ──────────────────────────────────────────────────────────────
-- Q2: 24h × 7-day heatmap — total avg kWh per cell
--     Mirrors: groupBy(hour, day).agg(sum of avg per building)
-- ──────────────────────────────────────────────────────────────
SELECT
    hour_of_day,
    day_of_week,
    CASE day_of_week
        WHEN 0 THEN 'Monday'
        WHEN 1 THEN 'Tuesday'
        WHEN 2 THEN 'Wednesday'
        WHEN 3 THEN 'Thursday'
        WHEN 4 THEN 'Friday'
        WHEN 5 THEN 'Saturday'
        WHEN 6 THEN 'Sunday'
    END                              AS day_name,
    ROUND(AVG(consumption_kwh), 4)   AS avg_kwh,
    ROUND(SUM(consumption_kwh), 2)   AS total_kwh
FROM campus_energy.energy_records
GROUP BY hour_of_day, day_of_week
ORDER BY hour_of_day, day_of_week;


-- ──────────────────────────────────────────────────────────────
-- Q3: Peak hour per building
--     Which hour does each building consume most?
-- ──────────────────────────────────────────────────────────────
SELECT building_name, hour_of_day, avg_kwh
FROM (
    SELECT
        building_name,
        hour_of_day,
        ROUND(AVG(consumption_kwh), 4) AS avg_kwh,
        ROW_NUMBER() OVER (
            PARTITION BY building_name
            ORDER BY AVG(consumption_kwh) DESC
        ) AS rn
    FROM campus_energy.energy_records
    GROUP BY building_name, hour_of_day
) ranked
WHERE rn = 1
ORDER BY avg_kwh DESC;


-- ──────────────────────────────────────────────────────────────
-- Q4: Top 5 busiest days of the week across all buildings
-- ──────────────────────────────────────────────────────────────
SELECT
    day_of_week,
    CASE day_of_week
        WHEN 0 THEN 'Monday'    WHEN 1 THEN 'Tuesday'
        WHEN 2 THEN 'Wednesday' WHEN 3 THEN 'Thursday'
        WHEN 4 THEN 'Friday'    WHEN 5 THEN 'Saturday'
        WHEN 6 THEN 'Sunday'
    END                               AS day_name,
    ROUND(AVG(consumption_kwh), 4)    AS avg_kwh,
    ROUND(SUM(consumption_kwh), 2)    AS total_kwh
FROM campus_energy.energy_records
GROUP BY day_of_week
ORDER BY avg_kwh DESC;


-- ──────────────────────────────────────────────────────────────
-- Q5: Heatmap VIEW for Spark SQL access
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW campus_energy.vw_heatmap AS
SELECT
    hour_of_day,
    day_of_week,
    building_name,
    ROUND(AVG(consumption_kwh), 4) AS avg_kwh
FROM campus_energy.energy_records
GROUP BY hour_of_day, day_of_week, building_name;

-- Spark: spark.sql("SELECT * FROM campus_energy.vw_heatmap")
