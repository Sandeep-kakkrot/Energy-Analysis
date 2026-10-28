-- =============================================================
-- wastage_analysis.hql
-- Campus Energy Analysis — Energy Wastage Queries
-- =============================================================
-- Mirrors: job_wastage_indicators.py
-- Off-hours = 22:00–05:59 (buildings expected empty)
-- After-hours = 19:00 onwards (after 7 PM) — CLASSROOM, LIBRARY, LAB only
-- Sunday wastage = all-day for CLASSROOM, LIBRARY, LAB blocks
-- Weekends during work hours also counted as potential wastage
-- =============================================================

USE campus_energy;

-- ──────────────────────────────────────────────────────────────
-- WASTAGE RULE DEFINITIONS
-- ──────────────────────────────────────────────────────────────
-- Rule 1 (Global):   Off-hours     = 22:00–05:59   all buildings
-- Rule 2 (Specific): After 7 PM    = 19:00–21:59   Classroom Block A, Central Library, Laboratory Block B
-- Rule 3 (Specific): Sundays       = day_of_week=1  Classroom Block A, Central Library, Laboratory Block B
-- Rule 4 (Global):   Weekend work  = Sat/Sun during 06:00–21:59 (non-specific buildings)
-- ──────────────────────────────────────────────────────────────

-- Helper macro comment — building names that apply to rule 2 & 3:
--   'Classroom Block A', 'Central Library', 'Laboratory Block B'


-- ──────────────────────────────────────────────────────────────
-- Q1: Per-building off-hours & rule-specific wastage
--     Conditional aggregation using CASE WHEN (Hive SQL standard)
--     Mirrors PySpark: F.sum(F.when(condition, col).otherwise(0))
-- ──────────────────────────────────────────────────────────────
SELECT
    building_name,
    ROUND(SUM(consumption_kwh),                               2) AS total_kwh,

    -- Rule 1: Global off-hours (22:00–05:59)
    ROUND(SUM(CASE
                  WHEN hour_of_day < 6 OR hour_of_day >= 22
                  THEN consumption_kwh
                  ELSE 0
              END),                                           2) AS off_hours_kwh,

    -- Rule 2: After 7 PM (19:00–21:59) for Classroom / Library / Lab
    ROUND(SUM(CASE
                  WHEN building_name IN ('Classroom Block A', 'Central Library', 'Laboratory Block B')
                   AND hour_of_day >= 19
                   AND hour_of_day < 22
                  THEN consumption_kwh
                  ELSE 0
              END),                                           2) AS after_7pm_kwh,

    -- Rule 3: Sundays (day_of_week = 1 in most Hive configs; adjust if 0-indexed)
    --         Applied only to Classroom / Library / Lab blocks
    ROUND(SUM(CASE
                  WHEN building_name IN ('Classroom Block A', 'Central Library', 'Laboratory Block B')
                   AND day_of_week = 1   -- 1 = Sunday (ISO: 7; adjust per cluster config)
                  THEN consumption_kwh
                  ELSE 0
              END),                                           2) AS sunday_kwh,

    -- Rule 4: Weekend (Sat/Sun) during normal hours for generic buildings
    ROUND(SUM(CASE
                  WHEN is_weekend = true
                   AND NOT (hour_of_day < 6 OR hour_of_day >= 22)
                   AND building_name NOT IN ('Classroom Block A', 'Central Library', 'Laboratory Block B')
                  THEN consumption_kwh
                  ELSE 0
              END),                                           2) AS weekend_workhours_kwh,

    -- Combined wastage (all rules)
    ROUND(SUM(CASE
                  -- Rule 1: global off-hours
                  WHEN hour_of_day < 6 OR hour_of_day >= 22
                  THEN consumption_kwh
                  -- Rule 2: after 7 PM for specific blocks
                  WHEN building_name IN ('Classroom Block A', 'Central Library', 'Laboratory Block B')
                   AND hour_of_day >= 19
                  THEN consumption_kwh
                  -- Rule 3: Sundays for specific blocks
                  WHEN building_name IN ('Classroom Block A', 'Central Library', 'Laboratory Block B')
                   AND day_of_week = 1
                  THEN consumption_kwh
                  -- Rule 4: Weekend work-hours for other buildings
                  WHEN is_weekend = true
                   AND NOT (hour_of_day < 6 OR hour_of_day >= 22)
                   AND building_name NOT IN ('Classroom Block A', 'Central Library', 'Laboratory Block B')
                  THEN consumption_kwh
                  ELSE 0
              END) / SUM(consumption_kwh) * 100,              2) AS wastage_pct,

    CASE
        WHEN SUM(CASE
                     WHEN hour_of_day < 6 OR hour_of_day >= 22
                       OR (building_name IN ('Classroom Block A', 'Central Library', 'Laboratory Block B')
                           AND (hour_of_day >= 19 OR day_of_week = 1))
                       OR (is_weekend = true AND NOT (hour_of_day < 6 OR hour_of_day >= 22)
                           AND building_name NOT IN ('Classroom Block A', 'Central Library', 'Laboratory Block B'))
                     THEN consumption_kwh ELSE 0
                 END) / SUM(consumption_kwh) * 100 > 30 THEN 'CRITICAL'
        WHEN SUM(CASE
                     WHEN hour_of_day < 6 OR hour_of_day >= 22
                       OR (building_name IN ('Classroom Block A', 'Central Library', 'Laboratory Block B')
                           AND (hour_of_day >= 19 OR day_of_week = 1))
                       OR (is_weekend = true AND NOT (hour_of_day < 6 OR hour_of_day >= 22)
                           AND building_name NOT IN ('Classroom Block A', 'Central Library', 'Laboratory Block B'))
                     THEN consumption_kwh ELSE 0
                 END) / SUM(consumption_kwh) * 100 > 25 THEN 'HIGH'
        WHEN SUM(CASE
                     WHEN hour_of_day < 6 OR hour_of_day >= 22
                       OR (building_name IN ('Classroom Block A', 'Central Library', 'Laboratory Block B')
                           AND (hour_of_day >= 19 OR day_of_week = 1))
                       OR (is_weekend = true AND NOT (hour_of_day < 6 OR hour_of_day >= 22)
                           AND building_name NOT IN ('Classroom Block A', 'Central Library', 'Laboratory Block B'))
                     THEN consumption_kwh ELSE 0
                 END) / SUM(consumption_kwh) * 100 > 15 THEN 'MEDIUM'
        ELSE 'LOW'
    END                                                          AS severity
FROM campus_energy.energy_records
GROUP BY building_name
ORDER BY wastage_pct DESC;


-- ──────────────────────────────────────────────────────────────
-- Q2: Monthly wastage trend — detect seasonality in off-hours use
-- ──────────────────────────────────────────────────────────────
SELECT
    building_name,
    year_num,
    month_num,
    ROUND(SUM(CASE
                  WHEN hour_of_day < 6 OR hour_of_day >= 22
                  THEN consumption_kwh ELSE 0
              END) / SUM(consumption_kwh) * 100, 2) AS off_hours_pct,

    -- After-7pm wastage % for specific blocks
    ROUND(SUM(CASE
                  WHEN building_name IN ('Classroom Block A', 'Central Library', 'Laboratory Block B')
                   AND hour_of_day >= 19 AND hour_of_day < 22
                  THEN consumption_kwh ELSE 0
              END) / SUM(consumption_kwh) * 100, 2) AS after_7pm_pct,

    -- Sunday wastage % for specific blocks
    ROUND(SUM(CASE
                  WHEN building_name IN ('Classroom Block A', 'Central Library', 'Laboratory Block B')
                   AND day_of_week = 1
                  THEN consumption_kwh ELSE 0
              END) / SUM(consumption_kwh) * 100, 2) AS sunday_pct

FROM campus_energy.energy_records
GROUP BY building_name, year_num, month_num
ORDER BY building_name, year_num, month_num;


-- ──────────────────────────────────────────────────────────────
-- Q3: Top-10 worst individual waste hours (building + date + hour)
-- ──────────────────────────────────────────────────────────────
SELECT
    building_name,
    year_num,
    month_num,
    day_of_month,
    hour_of_day,
    day_of_week,
    ROUND(consumption_kwh, 4) AS kwh,
    CASE
        WHEN hour_of_day < 6 OR hour_of_day >= 22 THEN 'OFF_HOURS'
        WHEN building_name IN ('Classroom Block A', 'Central Library', 'Laboratory Block B')
         AND day_of_week = 1                            THEN 'SUNDAY_WASTAGE'
        WHEN building_name IN ('Classroom Block A', 'Central Library', 'Laboratory Block B')
         AND hour_of_day >= 19                          THEN 'AFTER_7PM_WASTAGE'
        WHEN is_weekend = true                          THEN 'WEEKEND'
        ELSE 'WORKING_HOURS'
    END AS period_type,
    CASE
        WHEN building_name IN ('Classroom Block A', 'Central Library', 'Laboratory Block B')
         AND (day_of_week = 1 OR hour_of_day >= 19)
        THEN true ELSE false
    END AS applies_specific_rule
FROM campus_energy.energy_records
WHERE
    -- Rule 1: Global off-hours
    hour_of_day < 6 OR hour_of_day >= 22
    -- Rule 2: After 7 PM for specific blocks
    OR (building_name IN ('Classroom Block A', 'Central Library', 'Laboratory Block B')
        AND hour_of_day >= 19)
    -- Rule 3: Sundays for specific blocks
    OR (building_name IN ('Classroom Block A', 'Central Library', 'Laboratory Block B')
        AND day_of_week = 1)
    -- Rule 4: Weekend for other buildings
    OR is_weekend = true
ORDER BY consumption_kwh DESC
LIMIT 10;


-- ──────────────────────────────────────────────────────────────
-- Q4: Wastage CREATE VIEW — reusable for Spark SQL
--     Updated to include new after-7pm and Sunday rules
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW campus_energy.vw_wastage_summary AS
SELECT
    building_name,
    SUM(consumption_kwh)                                      AS total_kwh,

    -- Rule 1: Global off-hours
    SUM(CASE WHEN hour_of_day < 6 OR hour_of_day >= 22
             THEN consumption_kwh ELSE 0 END)                 AS off_hours_kwh,

    -- Rule 2: After 7 PM (specific blocks)
    SUM(CASE
            WHEN building_name IN ('Classroom Block A', 'Central Library', 'Laboratory Block B')
             AND hour_of_day >= 19 AND hour_of_day < 22
            THEN consumption_kwh ELSE 0
        END)                                                  AS after_7pm_kwh,

    -- Rule 3: Sundays (specific blocks)
    SUM(CASE
            WHEN building_name IN ('Classroom Block A', 'Central Library', 'Laboratory Block B')
             AND day_of_week = 1
            THEN consumption_kwh ELSE 0
        END)                                                  AS sunday_kwh,

    -- Rule 4: Weekend (generic buildings, work hours only)
    SUM(CASE
            WHEN is_weekend = true
             AND NOT (hour_of_day < 6 OR hour_of_day >= 22)
             AND building_name NOT IN ('Classroom Block A', 'Central Library', 'Laboratory Block B')
            THEN consumption_kwh ELSE 0
        END)                                                  AS weekend_kwh,

    -- Combined wastage %
    SUM(CASE
            WHEN hour_of_day < 6 OR hour_of_day >= 22 THEN consumption_kwh
            WHEN building_name IN ('Classroom Block A', 'Central Library', 'Laboratory Block B')
             AND hour_of_day >= 19                     THEN consumption_kwh
            WHEN building_name IN ('Classroom Block A', 'Central Library', 'Laboratory Block B')
             AND day_of_week = 1                       THEN consumption_kwh
            WHEN is_weekend = true
             AND NOT (hour_of_day < 6 OR hour_of_day >= 22)
             AND building_name NOT IN ('Classroom Block A', 'Central Library', 'Laboratory Block B')
                                                        THEN consumption_kwh
            ELSE 0
        END)
    / SUM(consumption_kwh) * 100                             AS wastage_pct

FROM campus_energy.energy_records
GROUP BY building_name;

-- Spark can now use:  spark.sql("SELECT * FROM campus_energy.vw_wastage_summary")

-- ──────────────────────────────────────────────────────────────
-- Q5: Sunday-specific analysis for Classroom / Library / Lab
-- ──────────────────────────────────────────────────────────────
SELECT
    building_name,
    year_num,
    month_num,
    ROUND(SUM(CASE WHEN day_of_week = 1 THEN consumption_kwh ELSE 0 END), 2) AS sunday_kwh,
    ROUND(SUM(consumption_kwh), 2)                                            AS total_kwh,
    ROUND(SUM(CASE WHEN day_of_week = 1 THEN consumption_kwh ELSE 0 END)
          / SUM(consumption_kwh) * 100, 2)                                    AS sunday_wastage_pct
FROM campus_energy.energy_records
WHERE building_name IN ('Classroom Block A', 'Central Library', 'Laboratory Block B')
GROUP BY building_name, year_num, month_num
ORDER BY sunday_wastage_pct DESC;


-- ──────────────────────────────────────────────────────────────
-- Q6: After-7PM analysis for Classroom / Library / Lab
-- ──────────────────────────────────────────────────────────────
SELECT
    building_name,
    year_num,
    month_num,
    ROUND(SUM(CASE WHEN hour_of_day >= 19 THEN consumption_kwh ELSE 0 END), 2) AS after_7pm_kwh,
    ROUND(SUM(consumption_kwh), 2)                                              AS total_kwh,
    ROUND(SUM(CASE WHEN hour_of_day >= 19 THEN consumption_kwh ELSE 0 END)
          / SUM(consumption_kwh) * 100, 2)                                      AS after_7pm_wastage_pct
FROM campus_energy.energy_records
WHERE building_name IN ('Classroom Block A', 'Central Library', 'Laboratory Block B')
GROUP BY building_name, year_num, month_num
ORDER BY after_7pm_wastage_pct DESC;
