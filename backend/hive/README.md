# Apache Hive Integration — Campus Energy Analysis

## Overview

Apache Hive provides a **schema and governance layer** over the HDFS CSV files.
No data is duplicated — Hive External Tables simply define column names and types
on top of files that already exist on HDFS.

```
HDFS CSV files  ──  Hive External Tables  ──  Spark SQL queries
(raw data)          (schema metadata)         (analytics jobs)
```

---

## Table Architecture

```
campus_energy (Hive Database)
├── energy_records_raw       EXTERNAL, CSV, no partitions
│   └── LOCATION: hdfs://namenode:9000/energy/raw/
│
├── energy_records           EXTERNAL, PARQUET, partitioned by (year_num, month_num)
│   └── LOCATION: hdfs://namenode:9000/hive/warehouse/campus_energy.db/energy_records/
│       ├── year_num=2024/month_num=1/part-00000.parquet
│       ├── year_num=2024/month_num=2/part-00000.parquet
│       ├── ...
│       └── year_num=2025/month_num=12/part-00000.parquet
│
├── buildings_meta           EXTERNAL, CSV
│   └── LOCATION: hdfs://namenode:9000/energy/buildings/
│
├── vw_wastage_summary       VIEW (over energy_records)
├── vw_heatmap               VIEW (over energy_records)
├── vw_monthly_trends        VIEW (over energy_records)
└── vw_daily_trends          VIEW (over energy_records)
```

### Why two energy tables?

| Table | Format | Use case |
|-------|--------|----------|
| `energy_records_raw` | CSV (TEXTFILE) | Initial landing zone — points at raw HDFS CSVs |
| `energy_records` | Parquet + Snappy | Query-optimised, partition-pruned Spark source |

Parquet gives **3–10× compression** over CSV and enables **columnar predicate pushdown**.
Querying `WHERE year_num = 2025` skips 2024 partitions entirely at the HDFS level.

---

## Prerequisites

- Apache Hadoop 3.x (NameNode + DataNodes running)
- Apache Hive 3.x (HiveServer2 + Metastore)
- Apache Spark 3.x with `spark.sql.catalogImplementation=hive` (or `enableHiveSupport()`)
- `HADOOP_CONF_DIR` and `HIVE_CONF_DIR` set in environment

For local development without a cluster, use `SPARK_LOCAL_MODE=true` — Spark jobs
fall back to reading `data/raw/*.csv` directly via pandas.

---

## Setup Steps

### Step 1 — Generate data files

```bash
cd backend

# Generate energy CSVs (HDFS-replica for local dev)
python scripts/generate_sample_csv.py

# Generate buildings CSV
python scripts/generate_buildings_csv.py
```

### Step 2 — Upload to HDFS

```bash
# Energy CSVs
hdfs dfs -mkdir -p /energy/raw/
hdfs dfs -put data/raw/*.csv /energy/raw/
hdfs dfs -ls /energy/raw/

# Buildings CSV
hdfs dfs -mkdir -p /energy/buildings/
hdfs dfs -put data/buildings/buildings.csv /energy/buildings/
hdfs dfs -ls /energy/buildings/
```

### Step 3 — Execute DDL scripts (in order)

```bash
# Option A: beeline (recommended for HiveServer2)
beeline -u "jdbc:hive2://localhost:10000" \
        -n hive \
        -f hive/ddl/01_create_database.hql

beeline -u "jdbc:hive2://localhost:10000" \
        -f hive/ddl/02_create_external_table_raw.hql

beeline -u "jdbc:hive2://localhost:10000" \
        -f hive/ddl/03_create_partitioned_table.hql

beeline -u "jdbc:hive2://localhost:10000" \
        -f hive/ddl/04_create_buildings_table.hql

# Option B: hive CLI (legacy)
hive -f hive/ddl/01_create_database.hql
hive -f hive/ddl/02_create_external_table_raw.hql
hive -f hive/ddl/03_create_partitioned_table.hql
hive -f hive/ddl/04_create_buildings_table.hql
```

### Step 4 — Load partitioned table

```bash
beeline -u "jdbc:hive2://localhost:10000" \
        -f hive/ddl/05_load_partitions.hql
```

This transfers data from `energy_records_raw` (CSV) into `energy_records` (Parquet, partitioned).

### Step 6 — Run Spark Batch jobs (write to normalised MySQL tables)

```bash
cd backend

# Run all 6 batch jobs (local CSV mode — no Hadoop required for dev)
python spark_jobs/batch/spark_batch_runner.py --all --local

# Or run individually
python spark_jobs/batch/spark_batch_runner.py --job building_totals --local
python spark_jobs/batch/spark_batch_runner.py --job daily_totals    --local
python spark_jobs/batch/spark_batch_runner.py --job monthly_totals  --local
python spark_jobs/batch/spark_batch_runner.py --job peak_hours      --local
python spark_jobs/batch/spark_batch_runner.py --job top_buildings   --local
python spark_jobs/batch/spark_batch_runner.py --job wastage_report  --local

# List registered jobs
python spark_jobs/batch/spark_batch_runner.py --list
```

### Step 7 — Switch Spark to read from Hive

```bash
# backend/.env
SPARK_LOCAL_MODE=false
USE_HIVE=true
HIVE_METASTORE_URI=thrift://localhost:9083
HIVE_DATABASE=campus_energy
HIVE_TABLE=energy_records
```

```bash
# Run all Spark jobs against Hive
python -m spark_jobs.spark_runner --all
```

---

## Running HiveQL Queries

### Interactive session

```bash
beeline -u "jdbc:hive2://localhost:10000"
```

```sql
USE campus_energy;
SHOW TABLES;
SELECT COUNT(*) FROM energy_records;
SELECT building_name, SUM(consumption_kwh) AS total FROM energy_records GROUP BY building_name;
```

### Run a query file

```bash
# Per-building analysis
beeline -u "jdbc:hive2://localhost:10000" -f hive/queries/building_analysis.hql

# Wastage indicators
beeline -u "jdbc:hive2://localhost:10000" -f hive/queries/wastage_analysis.hql

# Peak usage heatmap
beeline -u "jdbc:hive2://localhost:10000" -f hive/queries/peak_usage.hql

# Monthly trends
beeline -u "jdbc:hive2://localhost:10000" -f hive/queries/monthly_trends.hql

# Daily trends
beeline -u "jdbc:hive2://localhost:10000" -f hive/queries/daily_trends.hql
```

---

## How Spark Reads from Hive

The `HiveReader` class in `spark_jobs/hive_reader.py` uses:

```python
spark = (
    SparkSession.builder
    .appName("CampusEnergyHive")
    .config("hive.metastore.uris", "thrift://localhost:9083")
    .enableHiveSupport()          # connects to Hive Metastore
    .getOrCreate()
)

# Read full dataset via Hive SQL
sdf = spark.sql("SELECT * FROM campus_energy.energy_records")

# Or a filtered, partition-pruned read (only 2024 data scanned)
sdf = spark.sql("""
    SELECT * FROM campus_energy.energy_records
    WHERE year_num = 2024
""")
```

Spark uses the **Hive Metastore** to resolve table locations, column schemas,
and partition metadata — no hard-coded HDFS paths in the job code.

---

## Hive Views Available to Spark

| View | Purpose |
|------|---------|
| `vw_wastage_summary` | Pre-grouped off-hours wastage per building |
| `vw_heatmap` | 24h×7day avg kWh per building |
| `vw_monthly_trends` | Monthly totals per building |
| `vw_daily_trends` | Daily totals per building |

```python
# Example: Spark reading a Hive View
df = spark.sql("SELECT * FROM campus_energy.vw_wastage_summary").toPandas()
```

---

## Partition Pruning Example

```sql
-- WITHOUT partition pruning: scans ALL 24 partitions (2 years × 12 months)
SELECT SUM(consumption_kwh) FROM campus_energy.energy_records;

-- WITH partition pruning: scans only 3 partitions (Jan–Mar 2025)
SELECT SUM(consumption_kwh)
FROM campus_energy.energy_records
WHERE year_num = 2025 AND month_num IN (1, 2, 3);
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `USE_HIVE` | `true` | Use Hive when `SPARK_LOCAL_MODE=false` |
| `HIVE_METASTORE_URI` | `thrift://localhost:9083` | Hive Metastore Thrift URI |
| `HIVE_DATABASE` | `campus_energy` | Hive database name |
| `HIVE_TABLE` | `energy_records` | Primary table Spark reads |
| `HIVE_WAREHOUSE_DIR` | `/hive/warehouse` | HDFS Hive warehouse root |
| `SPARK_LOCAL_MODE` | `true` | `true` = local CSV, `false` = Hive/HDFS |

---

## File Index

```
hive/
├── ddl/
│   ├── 01_create_database.hql           Create campus_energy database
│   ├── 02_create_external_table_raw.hql  Raw CSV external table
│   ├── 03_create_partitioned_table.hql   Parquet partitioned table
│   ├── 04_create_buildings_table.hql     Building metadata table
│   ├── 05_load_partitions.hql            Load CSV → Parquet partitions
│   └── 06_create_views.hql              Create vw_wastage_summary, vw_heatmap,
│                                         vw_monthly_trends, vw_daily_trends
└── queries/
    ├── building_analysis.hql             Per-building aggregations + ranking
    ├── wastage_analysis.hql              Off-hours / weekend wastage
    ├── peak_usage.hql                    24h×7day heatmap
    ├── monthly_trends.hql                Monthly aggregation + MoM delta
    └── daily_trends.hql                  Daily time-series + rolling avg

spark_jobs/batch/
├── __init__.py
├── base_batch_job.py              Abstract base for all batch jobs
├── batch_building_totals.py       → batch_building_totals  MySQL table
├── batch_daily_totals.py          → batch_daily_totals     MySQL table
├── batch_monthly_totals.py        → batch_monthly_totals   MySQL table
├── batch_peak_hours.py            → batch_peak_hours       MySQL table
├── batch_top_buildings.py         → batch_top_buildings    MySQL table
├── batch_wastage_report.py        → batch_wastage_report   MySQL table
└── spark_batch_runner.py          CLI orchestrator (batch_run_id UUID tracking)
```
