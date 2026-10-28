"""
spark_jobs — Campus Energy Analysis
=====================================
Spark job modules that read historical CSV data from HDFS,
perform energy analytics, and write pre-computed summaries to MySQL.

The Flask REST API reads ONLY from the spark_summaries MySQL table.
It never accesses HDFS or performs live aggregations.

Job modules
-----------
  job_dashboard_summary   → KPI cards (total, avg, peak, wastage)
  job_building_comparison → Per-building aggregated stats
  job_daily_trends        → Daily time-series by building
  job_monthly_trends      → Monthly aggregation by building
  job_peak_usage          → 24h×7day heatmap + ranked peak hours
  job_wastage_indicators  → Off-hours energy wastage per building

Entrypoint
----------
  python spark_runner.py --all           # run all jobs
  python spark_runner.py --job <name>    # run a single job
  python spark_runner.py --all --local   # use local CSVs (no HDFS required)
"""
