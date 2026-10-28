-- Campus Energy Consumption Analysis Database Schema
-- =====================================================

CREATE DATABASE IF NOT EXISTS campus_energy CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE campus_energy;

-- Buildings / Blocks table
CREATE TABLE IF NOT EXISTS buildings (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    block_code  VARCHAR(20)  NOT NULL UNIQUE,
    type        ENUM('classroom', 'laboratory', 'library', 'hostel') NOT NULL,
    capacity    INT          NOT NULL COMMENT 'Approximate occupant capacity',
    area_sqft   INT          NOT NULL COMMENT 'Floor area in sq ft',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Energy records table (one row per hour per building)
CREATE TABLE IF NOT EXISTS energy_records (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    building_id      INT    NOT NULL,
    recorded_at      DATETIME NOT NULL COMMENT 'Timestamp of measurement (hourly)',
    consumption_kwh  DECIMAL(10,4) NOT NULL COMMENT 'Units consumed in that hour',
    hour_of_day      TINYINT  NOT NULL COMMENT '0-23',
    day_of_week      TINYINT  NOT NULL COMMENT '0=Mon ... 6=Sun',
    day_of_month     TINYINT  NOT NULL COMMENT '1-31',
    month_num        TINYINT  NOT NULL COMMENT '1-12',
    year_num         SMALLINT NOT NULL,
    is_weekend       BOOLEAN  NOT NULL DEFAULT FALSE,
    is_holiday       BOOLEAN  NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_building FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE
);

-- Indexes for analytical query performance
CREATE INDEX idx_building_recorded ON energy_records (building_id, recorded_at);
CREATE INDEX idx_month_year        ON energy_records (year_num, month_num);
CREATE INDEX idx_hour              ON energy_records (hour_of_day);
CREATE INDEX idx_day_of_week       ON energy_records (day_of_week);
CREATE INDEX idx_recorded_at       ON energy_records (recorded_at);

-- ─────────────────────────────────────────────────────────────
-- Spark Summary Store (generic JSON blob per job)
-- One row per Spark job type; Spark upserts after each run.
-- The Flask API reads ONLY from this table — never from
-- energy_records for aggregation, never from HDFS directly.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spark_summaries (
    id           INT          NOT NULL AUTO_INCREMENT,
    job_name     VARCHAR(64)  NOT NULL COMMENT 'Unique job identifier, e.g. dashboard_summary',
    computed_at  DATETIME     NOT NULL COMMENT 'Timestamp when Spark job finished',
    hdfs_source  VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'HDFS path that was read (or LOCAL)',
    record_count BIGINT       NOT NULL DEFAULT 0  COMMENT 'Number of HDFS rows processed',
    payload      JSON         NOT NULL            COMMENT 'Serialised Spark output — served as-is to API',
    PRIMARY KEY  (id),
    UNIQUE KEY   uq_job_name  (job_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Pre-computed Spark job results for the REST API';


-- ═════════════════════════════════════════════════════════════
-- SPARK BATCH RESULT TABLES
-- Dedicated, normalised tables for each batch computation.
-- Input:  Apache Hive tables (campus_energy.energy_records)
-- Output: Processed summaries stored in MySQL (these tables)
-- Each table references a batch_run_id from batch_runs.
-- ═════════════════════════════════════════════════════════════

-- Batch run registry — one row per execution of spark_batch_runner.py
CREATE TABLE IF NOT EXISTS batch_runs (
    id             INT          NOT NULL AUTO_INCREMENT,
    batch_run_id   VARCHAR(36)  NOT NULL COMMENT 'UUID identifying this batch execution',
    started_at     DATETIME     NOT NULL,
    finished_at    DATETIME,
    data_source    VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'HIVE:... or LOCAL:...',
    status         ENUM('running','success','partial','failed') NOT NULL DEFAULT 'running',
    jobs_total     INT          NOT NULL DEFAULT 0,
    jobs_ok        INT          NOT NULL DEFAULT 0,
    jobs_failed    INT          NOT NULL DEFAULT 0,
    notes          TEXT,
    PRIMARY KEY    (id),
    UNIQUE KEY     uq_batch_run (batch_run_id),
    INDEX          idx_started  (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Registry of every Spark batch pipeline execution';


-- ── 1. Total electricity per building ────────────────────────
-- Spark job: BatchBuildingTotals
-- Hive SQL:  SELECT building_name, SUM(consumption_kwh) FROM energy_records GROUP BY building_name
CREATE TABLE IF NOT EXISTS batch_building_totals (
    id               INT          NOT NULL AUTO_INCREMENT,
    batch_run_id     VARCHAR(36)  NOT NULL,
    building_code    VARCHAR(20)  NOT NULL,
    building_name    VARCHAR(100) NOT NULL,
    total_kwh        DECIMAL(15,4) NOT NULL COMMENT 'Total kWh consumed by this building',
    avg_kwh_per_hour DECIMAL(12,6) NOT NULL COMMENT 'Mean hourly consumption',
    max_kwh          DECIMAL(12,4) NOT NULL COMMENT 'Peak single-hour reading',
    record_count     BIGINT        NOT NULL COMMENT 'Number of hourly records aggregated',
    pct_share        DECIMAL(8,4)  NOT NULL COMMENT 'Percentage of campus-wide total',
    computed_at      DATETIME      NOT NULL,
    PRIMARY KEY      (id),
    INDEX            idx_bbt_run      (batch_run_id),
    INDEX            idx_bbt_building (building_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Total electricity consumed per building (Spark batch output)';


-- ── 2. Daily totals ───────────────────────────────────────────
-- Spark job: BatchDailyTotals
-- Hive SQL:  SELECT rec_date, building_name, SUM(consumption_kwh) FROM energy_records GROUP BY rec_date, building_name
CREATE TABLE IF NOT EXISTS batch_daily_totals (
    id            INT          NOT NULL AUTO_INCREMENT,
    batch_run_id  VARCHAR(36)  NOT NULL,
    rec_date      DATE         NOT NULL COMMENT 'Calendar date (YYYY-MM-DD)',
    building_name VARCHAR(100) NOT NULL,
    total_kwh     DECIMAL(12,4) NOT NULL,
    avg_kwh       DECIMAL(12,6) NOT NULL COMMENT 'Mean hourly consumption for that day',
    computed_at   DATETIME      NOT NULL,
    PRIMARY KEY   (id),
    INDEX         idx_bdt_run  (batch_run_id),
    INDEX         idx_bdt_date (rec_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Daily electricity totals per building (Spark batch output)';


-- ── 3. Monthly totals ─────────────────────────────────────────
-- Spark job: BatchMonthlyTotals
-- Hive SQL:  SELECT year_num, month_num, building_name, SUM(consumption_kwh) GROUP BY ...
CREATE TABLE IF NOT EXISTS batch_monthly_totals (
    id            INT          NOT NULL AUTO_INCREMENT,
    batch_run_id  VARCHAR(36)  NOT NULL,
    year_num      SMALLINT     NOT NULL,
    month_num     TINYINT      NOT NULL COMMENT '1-12',
    building_name VARCHAR(100) NOT NULL,
    total_kwh     DECIMAL(12,4) NOT NULL,
    avg_kwh       DECIMAL(12,6) NOT NULL,
    computed_at   DATETIME      NOT NULL,
    PRIMARY KEY   (id),
    INDEX         idx_bmt_run  (batch_run_id),
    INDEX         idx_bmt_ym   (year_num, month_num)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Monthly electricity totals per building (Spark batch output)';


-- ── 4. Peak usage hours ───────────────────────────────────────
-- Spark job: BatchPeakHours
-- Hive SQL:  SELECT hour_of_day, AVG(consumption_kwh) FROM energy_records GROUP BY hour_of_day ORDER BY avg DESC
CREATE TABLE IF NOT EXISTS batch_peak_hours (
    id            INT          NOT NULL AUTO_INCREMENT,
    batch_run_id  VARCHAR(36)  NOT NULL,
    hour_of_day   TINYINT      NOT NULL COMMENT '0-23',
    avg_kwh       DECIMAL(12,6) NOT NULL COMMENT 'Mean kWh across all buildings and days',
    total_kwh     DECIMAL(15,4) NOT NULL,
    peak_rank     TINYINT       NOT NULL COMMENT '1 = busiest hour',
    computed_at   DATETIME      NOT NULL,
    PRIMARY KEY   (id),
    INDEX         idx_bph_run  (batch_run_id),
    INDEX         idx_bph_rank (peak_rank)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Ranked peak consumption hours across campus (Spark batch output)';


-- ── 5. Highest consuming building ────────────────────────────
-- Spark job: BatchTopBuildings
-- Hive SQL:  SELECT building_name, SUM(...) GROUP BY building_name ORDER BY total DESC
CREATE TABLE IF NOT EXISTS batch_top_buildings (
    id              INT          NOT NULL AUTO_INCREMENT,
    batch_run_id    VARCHAR(36)  NOT NULL,
    rank_position   TINYINT      NOT NULL COMMENT '1 = highest consumer',
    building_name   VARCHAR(100) NOT NULL,
    building_code   VARCHAR(20)  NOT NULL,
    total_kwh       DECIMAL(15,4) NOT NULL,
    pct_of_campus   DECIMAL(8,4)  NOT NULL COMMENT 'Percentage share of campus total',
    is_highest      BOOLEAN       NOT NULL DEFAULT FALSE,
    computed_at     DATETIME      NOT NULL,
    PRIMARY KEY     (id),
    INDEX           idx_btb_run  (batch_run_id),
    INDEX           idx_btb_rank (rank_position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Ranked buildings by total electricity consumption (Spark batch output)';


-- ── 6. Energy wastage report ──────────────────────────────────
-- Spark job: BatchWastageReport
-- Hive SQL:  Conditional SUM of off-hours (22:00-05:59) and weekend consumption
CREATE TABLE IF NOT EXISTS batch_wastage_report (
    id                INT          NOT NULL AUTO_INCREMENT,
    batch_run_id      VARCHAR(36)  NOT NULL,
    building_name     VARCHAR(100) NOT NULL,
    total_kwh         DECIMAL(15,4) NOT NULL,
    off_hours_kwh     DECIMAL(15,4) NOT NULL COMMENT 'Consumption between 22:00-05:59',
    weekend_kwh       DECIMAL(15,4) NOT NULL COMMENT 'Consumption on weekends (excl. off-hours)',
    total_wastage_kwh DECIMAL(15,4) NOT NULL COMMENT 'off_hours + weekend',
    wastage_pct       DECIMAL(8,4)  NOT NULL COMMENT 'total_wastage / total * 100',
    severity          ENUM('low','medium','high') NOT NULL,
    recommendation    TEXT          NOT NULL,
    computed_at       DATETIME      NOT NULL,
    PRIMARY KEY       (id),
    INDEX             idx_bwr_run      (batch_run_id),
    INDEX             idx_bwr_severity (severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Off-hours and weekend energy wastage per building (Spark batch output)';


-- Seed buildings
INSERT INTO buildings (name, block_code, type, capacity, area_sqft) VALUES
  ('Classroom Block A',   'CB-A', 'classroom',  800, 25000),
  ('Laboratory Block B',  'LB-B', 'laboratory', 300, 18000),
  ('Central Library',     'LIB',  'library',    500, 30000),
  ('Hostel Complex',      'HST',  'hostel',    1200, 45000);
