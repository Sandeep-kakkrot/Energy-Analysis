# Campus Energy Consumption Analysis
### Big Data Analytics Platform — Hadoop HDFS & Apache Spark

A production-ready full-stack web application for analysing historical electricity
consumption data across campus buildings using **Hadoop HDFS** as the authoritative
data store and **Apache Spark** as the exclusive computation engine.

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       DATA INGESTION                            │
│                                                                 │
│  Historical CSVs ──►  HDFS Cluster                             │
│                        hdfs://namenode:9000/energy/raw/        │
│                        ├── CB-A_energy.csv                     │
│                        ├── LB-B_energy.csv                     │
│                        ├── LIB_energy.csv                      │
│                        └── HST_energy.csv                      │
└─────────────────────────────────────────────────────────────────┘
                         │
                  spark-submit / cron
                         │  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SPARK LAYER (Batch Jobs)                      │
│                                                                 │
│  spark_jobs/                                                    │
│  ├── hdfs_reader.py            ← ONLY place that touches HDFS  │
│  ├── base_job.py               ← abstract base + DB upsert     │
│  ├── job_dashboard_summary.py  ← KPI cards                     │
│  ├── job_building_comparison.py                                 │
│  ├── job_daily_trends.py                                        │
│  ├── job_monthly_trends.py                                      │
│  ├── job_peak_usage.py         ← 24h×7-day heatmap             │
│  ├── job_wastage_indicators.py ← off-hours wastage             │
│  └── spark_runner.py           ← CLI orchestrator              │
└─────────────────────────────────────────────────────────────────┘
                         │
              MySQL UPSERT (one row per job)
                         │  ▼
┌─────────────────────────────────────────────────────────────────┐
│                  SUMMARY STORE (MySQL)                          │
│                                                                 │
│  spark_summaries table                                          │
│  ┌──────────────────────┬─────────────┬───────────┬─────────┐  │
│  │ job_name (UNIQUE)    │ computed_at │ rec_count │ payload │  │
│  │ dashboard_summary    │ 2024-01-15  │  70,080   │ {...}   │  │
│  │ building_comparison  │ 2024-01-15  │  70,080   │ [...]   │  │
│  │ daily_trends         │ 2024-01-15  │  70,080   │ [...]   │  │
│  │ monthly_trends       │ 2024-01-15  │  70,080   │ [...]   │  │
│  │ peak_usage           │ 2024-01-15  │  70,080   │ {...}   │  │
│  │ wastage_indicators   │ 2024-01-15  │  70,080   │ [...]   │  │
│  └──────────────────────┴─────────────┴───────────┴─────────┘  │
└─────────────────────────────────────────────────────────────────┘
                         │
        SELECT payload WHERE job_name = ?
        (no live aggregation, no HDFS access)
                         │  ▼
┌─────────────────────────────────────────────────────────────────┐
│              FLASK REST API  (read-only from spark_summaries)   │
│                                                                 │
│  analytics_service.py → _fetch_payload(job_name)               │
│  GET /api/dashboard/summary                                     │
│  GET /api/buildings/comparison                                  │
│  GET /api/trends/daily                                          │
│  GET /api/trends/monthly                                        │
│  GET /api/peaks/usage                                           │
│  GET /api/wastage/indicators                                    │
│  GET /api/spark/status       ← new: job metadata               │
│  POST /api/spark/run         ← new: trigger re-computation     │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│               REACT FRONTEND  (unchanged)                       │
│  6 dashboard pages — same API contract as before               │
└─────────────────────────────────────────────────────────────────┘
```

> **Key rule**: The web application **never reads HDFS directly**.
> Spark jobs are the exclusive consumers of HDFS data.
> The Flask API is read-only against the `spark_summaries` table.

---

## 📦 Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Frontend    | React 18, Tailwind CSS 3, Recharts  |
| Backend     | Flask 3, SQLAlchemy, Flask-CORS     |
| Database    | MySQL 8                             |
| Big Data    | Hadoop HDFS (data store)            |
| Processing  | Apache Spark / PySpark (analytics)  |
| Build Tool  | Vite 5                              |

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.10+
- Node.js 18+
- MySQL 8 running locally

### 2. Database Setup
```bash
mysql -u root -p < backend/migrations/schema.sql
```
This creates both `energy_records` and the new `spark_summaries` table.

### 3. Backend Setup
```bash
cd backend

# Copy and edit env
cp .env.example .env
# Edit .env with your MySQL credentials

# Install dependencies
pip install -r requirements.txt

# Start API server
python run.py
```
Backend runs on **http://localhost:5000**

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on **http://localhost:5173**

---

## ⚡ Spark Job Workflow

### Step 1 — Generate Local HDFS-Replica CSVs
```bash
cd backend
python scripts/generate_sample_csv.py
# Output: data/raw/CB-A_energy.csv, LB-B_energy.csv, LIB_energy.csv, HST_energy.csv
# ~70,000 rows per building (2 years of hourly data)
```

### Step 2 — Run All Spark Jobs
```bash
# Local mode (reads data/raw/ — no Hadoop required)
python spark_jobs/spark_runner.py --all --local

# Run a single job
python spark_jobs/spark_runner.py --job dashboard_summary --local

# List all registered jobs
python spark_jobs/spark_runner.py --list
```

### Step 3 — Verify Results
```bash
# Confirm spark_summaries was populated
mysql -u root -p campus_energy \
  -e "SELECT job_name, computed_at, record_count, hdfs_source FROM spark_summaries;"

# Hit any API endpoint — it now reads from spark_summaries
curl http://localhost:5000/api/dashboard/summary
curl http://localhost:5000/api/spark/status
```

### Trigger via API
```bash
# Trigger all jobs via the admin endpoint
curl -X POST http://localhost:5000/api/spark/run \
     -H "Content-Type: application/json" \
     -d '{"local": true}'

# Trigger a single job
curl -X POST http://localhost:5000/api/spark/run \
     -H "Content-Type: application/json" \
     -d '{"job": "peak_usage", "local": true}'
```

---

## 🔗 HDFS Integration (Production)

To connect to a real Hadoop cluster, set in `backend/.env`:
```env
SPARK_LOCAL_MODE=false
HDFS_NAMENODE=hdfs://namenode.campus.edu:9000
HDFS_DATA_PATH=/energy/raw/
```

Then upload CSVs to HDFS:
```bash
hdfs dfs -mkdir -p /energy/raw/
hdfs dfs -put data/raw/*.csv /energy/raw/
```

Run Spark jobs against the cluster:
```bash
# With PySpark installed and HADOOP_CONF_DIR configured
spark-submit \
  --master yarn \
  spark_jobs/spark_runner.py --all
```

---

## 📡 REST API Reference

| Method | Endpoint                    | Description                              |
|--------|-----------------------------|------------------------------------------|
| GET    | `/api/health`               | Health check                             |
| GET    | `/api/dashboard/summary`    | KPI cards: total, avg, peak, wastage     |
| GET    | `/api/buildings/comparison` | Block-wise aggregated stats              |
| GET    | `/api/trends/daily?days=30` | Daily consumption time-series            |
| GET    | `/api/trends/monthly?year=` | Monthly aggregated trends                |
| GET    | `/api/peaks/usage`          | 24h×7day SVG heatmap + ranked peak hours |
| GET    | `/api/wastage/indicators`   | Per-building off-hours wastage analysis  |
| GET    | `/api/spark/status`         | **NEW** — Spark job metadata             |
| POST   | `/api/spark/run`            | **NEW** — Trigger Spark re-computation   |

> All analytics endpoints read exclusively from `spark_summaries`.
> No live SQL aggregation occurs inside the API layer.

---

## 🏛 Campus Buildings

| Building           | Code  | Type        | Capacity |
|--------------------|-------|-------------|----------|
| Classroom Block A  | CB-A  | Classroom   | 800      |
| Laboratory Block B | LB-B  | Laboratory  | 300      |
| Central Library    | LIB   | Library     | 500      |
| Hostel Complex     | HST   | Hostel      | 1,200    |

---

## ⚡ Hadoop & Spark Concepts

### HDFS Data Layer
Historical energy CSV files are the canonical data source.
They live at `hdfs://namenode:9000/energy/raw/` in production,
or in `backend/data/raw/` for local development.

Schema: `timestamp, building_code, building_name, consumption_kwh, hour_of_day, day_of_week, day_of_month, month_num, year_num, is_weekend, is_holiday`

### Spark Job Architecture (`backend/spark_jobs/`)

| File | Responsibility |
|------|---------------|
| `hdfs_reader.py` | **Only place that reads HDFS**. Real PySpark or local-CSV fallback. |
| `base_job.py` | Abstract base: `read → transform → upsert` pipeline |
| `job_dashboard_summary.py` | `groupBy(date).agg(sum)` → avg, peak, wastage |
| `job_building_comparison.py` | `groupBy(building).agg(sum, avg, count)` + broadcast join |
| `job_daily_trends.py` | `groupBy(date, building).agg(sum)` + pivot |
| `job_monthly_trends.py` | `groupBy(month, building).agg(sum)` + pivot |
| `job_peak_usage.py` | `groupBy(hour, day).agg(avg)` → 24×7 heatmap |
| `job_wastage_indicators.py` | `withColumn(off_hours_flag).groupBy(building).agg(cond_sum)` |
| `spark_runner.py` | CLI orchestrator (`--all`, `--job`, `--local`) |

### MapReduce Simulation (`backend/hadoop_spark/mapreduce_simulation.py`)
Implements the classic MapReduce pattern:
- **Map**: Emits `(building|hour, kWh)` key-value pairs from each record
- **Shuffle**: Groups all values by key (simulating Hadoop's sort-merge)
- **Reduce**: Aggregates sums per `(building, hour)` combination

### Spark Simulation (`backend/hadoop_spark/spark_simulation.py`)
Demonstrates PySpark-compatible patterns using pandas:
- **`SimulatedRDD`** class: `.map()`, `.filter()`, `.reduce_by_key()`, `.sort_by()`
- **`SparkEnergyAnalyzer`**: DataFrame-style `.groupBy().agg()` for building totals, monthly trends, and wastage analysis

---

## 📁 Folder Structure

```
campus-energy-analysis/
├── backend/
│   ├── app/
│   │   ├── models/          # SQLAlchemy ORM (Building, EnergyRecord, SparkSummary)
│   │   ├── routes/          # Flask Blueprints (6 analytics + 1 spark admin)
│   │   ├── services/        # analytics_service.py (reads spark_summaries only)
│   │   └── utils/           # Response helpers
│   ├── data/
│   │   └── raw/             # Local HDFS-replica CSVs (generated by scripts/)
│   ├── hadoop_spark/        # MapReduce + Spark simulation modules (legacy demo)
│   ├── migrations/          # schema.sql (includes spark_summaries table)
│   ├── scripts/
│   │   └── generate_sample_csv.py   # Generates data/raw/*.csv
│   ├── spark_jobs/          # ★ NEW — Real Spark job architecture
│   │   ├── hdfs_reader.py
│   │   ├── base_job.py
│   │   ├── job_dashboard_summary.py
│   │   ├── job_building_comparison.py
│   │   ├── job_daily_trends.py
│   │   ├── job_monthly_trends.py
│   │   ├── job_peak_usage.py
│   │   ├── job_wastage_indicators.py
│   │   └── spark_runner.py
│   ├── requirements.txt
│   └── run.py
└── frontend/
    ├── src/
    │   ├── api/             # Axios API client
    │   ├── components/      # Layout, Charts, Cards, Common
    │   ├── context/         # Filter state
    │   ├── hooks/           # useEnergyData
    │   ├── pages/           # 6 dashboard pages
    │   └── utils/           # Formatters, color maps
    ├── tailwind.config.js
    └── vite.config.js
```
