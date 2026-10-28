# Campus Energy Consumption Analysis — End-to-End System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
|                       1. DATA INGESTION                         |
|                                                                 |
|  Historical CSVs  ──►  Hadoop HDFS Cluster                      |
|                        hdfs://namenode:9000/energy/raw/         |
|                        ├── CB-A_energy.csv                      |
|                        ├── LB-B_energy.csv                      |
|                        ├── LIB_energy.csv                       |
|                        └── HST_energy.csv                       |
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
|                       2. APACHE HIVE LAYER                      |
|                                                                 |
|  Hive Metastore: thrift://localhost:9083                        |
|  • Database: campus_energy                                      |
|  • Raw Table: energy_records_raw (External CSV)                 |
|  • Partitioned Table: energy_records (Parquet format)           |
|    Partitioned by (year_num, month_num) for pruning             |
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
|                       3. APACHE SPARK LAYER                     |
|                                                                 |
|  PySpark / Spark SQL Computation Engine                         |
|  • JSON Summaries: spark_jobs/spark_runner.py                   |
|    (dashboard_summary, building_comparison, daily_trends,       |
|     monthly_trends, peak_usage, wastage_indicators)             |
|  • Batch Tables: spark_jobs/batch/spark_batch_runner.py         |
|    (BatchBuildingTotals, BatchDailyTotals, BatchMonthlyTotals,  |
|     BatchPeakHours, BatchTopBuildings, BatchWastageReport)      |
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
|                       4. MYSQL DATABASE                         |
|                                                                 |
|  Database: campus_energy (MySQL 8)                              |
|  • Core tables: buildings, energy_records, users                |
|  • JSON Summary store: spark_summaries                          |
|  • Batch Result tables: batch_runs, batch_building_totals,      |
|    batch_daily_totals, batch_monthly_totals, batch_peak_hours,  |
|    batch_top_buildings, batch_wastage_report                    |
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ├───────────────────────────────┐
                                 ▼                               ▼
┌─────────────────────────────────────────┐  ┌──────────────────────────┐
|          5. FLASK REST API              |  |       7. POWER BI        |
|                                         |  |                          |
|  Python Flask 3 (Port 5000)             |  |  Direct Connect to       |
|  • Auth: JWT HS256 + Bcrypt + RBAC      |  |  MySQL Batch Tables      |
|  • Upload: POST /api/upload (CSV/Excel) |  |                          |
|  • Endpoints: /api/auth/*, /api/upload, |  |  • Overview              |
|    /api/dashboard/summary,              |  |  • Building Analysis     |
|    /api/buildings/comparison,           |  |  • Peak Usage (24x7 HM)  |
|    /api/trends/daily, /api/trends/monthly,|  |  • Monthly Trends        |
|    /api/peaks/usage, /api/wastage/*,    |  |  • Energy Wastage        |
|    /api/spark/status, /api/spark/run    |  |                          |
└─────────────────────────────────────────┘  └──────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────┐
|          6. REACT DASHBOARD             |
|                                         |
|  React 18 + Vite 5 + Tailwind CSS       |
|  • Auth Gate: Login page + PrivateRoute |
|  • Upload: DataUploadModal Component    |
|  • User Menu: Role badge (admin/viewer) |
|  • Pages: Dashboard, Buildings, Daily,  |
|    Monthly, Peaks, Wastage, Reports     |
|  • Exports: PDF, Excel (.xlsx), CSV     |
└─────────────────────────────────────────┘
```

---

## Module Communication Matrix

| Source | Target | Protocol / Interface | Data Transferred |
|--------|--------|----------------------|------------------|
| **Historical CSV** | **HDFS** | HDFS CLI (`hdfs dfs -put`) / Local FS | Raw hourly building energy measurements |
| **HDFS** | **Hive** | Hive DDL (`hive/ddl/`) | External table mapping & Parquet partitioning |
| **Hive / HDFS** | **Spark Engine** | PySpark / HiveContext | Hourly records (70,176+ rows) |
| **Spark Engine** | **MySQL** | SQLAlchemy / PyMySQL | `spark_summaries` JSON & 6 `batch_*` tables |
| **MySQL** | **Flask REST API** | SQLAlchemy ORM | Cached summary JSON & user auth credentials |
| **Flask REST API** | **React Dashboard** | HTTPS REST API + JWT Bearer | JSON API responses & JWT authentication tokens |
| **MySQL** | **Power BI** | MySQL Connector / NET | Relational tables (`batch_building_totals`, etc.) |
| **React Dashboard** | **Reports** | Client-side export engines | Downloadable PDF, Excel (.xlsx), CSV reports |

---

## Verification Commands

```bash
# 1. Spark Summaries Job Execution
python backend/spark_jobs/spark_runner.py --all --local

# 2. Spark Batch Tables Execution
python backend/spark_jobs/batch/spark_batch_runner.py --all --local

# 3. Flask Backend API (Port 5000)
python backend/run.py

# 4. React Frontend (Port 5173)
cd frontend && npm run dev

# 5. Power BI Dashboard Server (Port 7890)
http://localhost:7890/dashboard.html
```
