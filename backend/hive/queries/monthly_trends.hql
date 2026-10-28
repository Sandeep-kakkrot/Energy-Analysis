-- =============================================================
-- monthly_trends.hql
-- Campus Energy Analysis — Monthly Aggregation Queries
-- =============================================================
-- Mirrors: job_monthly_trends.py
-- Leverages Hive partition pruning: queries on year_num/month_num
-- skip irrelevant HDFS directories automatically (zero extra I/O)
-- =============================================================

USE campus_energy;

-- ──────────────────────────────────────────────────────────────
-- Q1: Monthly totals per building (full dataset)
--     Mirrors PySpark: groupBy(year,month,building).agg(sum)
-- ──────────────────────────────────────────────────────────────
SELECT
    year_num,
    month_num,
    building_name,
    ROUND(SUM(consumption_kwh), 2) AS total_kwh,
    ROUND(AVG(consumption_kwh), 4) AS avg_kwh_per_hour
FROM campus_energy.energy_records
GROUP BY year_num, month_num, building_name
ORDER BY year_num, month_num, building_name;


-- ──────────────────────────────────────────────────────────────
-- Q2: Monthly campus-wide totals with month-over-month delta
--     Window function: LAG() for previous month comparison
-- ──────────────────────────────────────────────────────────────
SELECT
    year_num,
    month_num,
    ROUND(SUM(consumption_kwh), 2)                      AS total_kwh,
    ROUND(SUM(consumption_kwh)
          - LAG(SUM(consumption_kwh)) OVER (
              ORDER BY year_num, month_num
            ), 2)                                       AS mom_change_kwh,
    ROUND((SUM(consumption_kwh)
           - LAG(SUM(consumption_kwh)) OVER (
               ORDER BY year_num, month_num
             )) / LAG(SUM(consumption_kwh)) OVER (
               ORDER BY year_num, month_num
             ) * 100, 2)                                AS mom_pct_change
FROM campus_energy.energy_records
GROUP BY year_num, month_num
ORDER BY year_num, month_num;


-- ──────────────────────────────────────────────────────────────
-- Q3: Seasonal pattern — average monthly consumption by month-number
--     (collapse across years to see 12-month seasonal profile)
-- ──────────────────────────────────────────────────────────────
SELECT
    month_num,
    CASE month_num
        WHEN  1 THEN 'January'   WHEN  2 THEN 'February'
        WHEN  3 THEN 'March'     WHEN  4 THEN 'April'
        WHEN  5 THEN 'May'       WHEN  6 THEN 'June'
        WHEN  7 THEN 'July'      WHEN  8 THEN 'August'
        WHEN  9 THEN 'September' WHEN 10 THEN 'October'
        WHEN 11 THEN 'November'  WHEN 12 THEN 'December'
    END                                              AS month_name,
    ROUND(AVG(consumption_kwh), 4)                   AS avg_kwh_per_hour,
    ROUND(SUM(consumption_kwh) / COUNT(DISTINCT year_num), 2) AS avg_monthly_total
FROM campus_energy.energy_records
GROUP BY month_num
ORDER BY month_num;


-- ──────────────────────────────────────────────────────────────
-- Q4: Partition-pruned single-year query example
--     Hive skips all partitions where year_num != 2025
-- ──────────────────────────────────────────────────────────────
SELECT
    month_num,
    building_name,
    ROUND(SUM(consumption_kwh), 2) AS total_kwh
FROM campus_energy.energy_records
WHERE year_num = 2025          -- PARTITION PRUNING applied here
GROUP BY month_num, building_name
ORDER BY month_num, total_kwh DESC;


-- ──────────────────────────────────────────────────────────────
-- Q5: Monthly trends VIEW for Spark SQL access
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW campus_energy.vw_monthly_trends AS
SELECT
    year_num,
    month_num,
    building_name,
    ROUND(SUM(consumption_kwh), 2) AS total_kwh
FROM campus_energy.energy_records
GROUP BY year_num, month_num, building_name;
