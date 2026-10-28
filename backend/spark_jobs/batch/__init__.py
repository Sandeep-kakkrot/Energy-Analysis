"""
spark_jobs.batch — Campus Energy Analysis
==========================================
Spark BATCH job modules that read from Apache Hive (or local CSVs
in dev mode), perform groupBy / agg transforms, and write normalised
result rows to dedicated MySQL tables.

Contrast with the parent spark_jobs package
--------------------------------------------
  spark_jobs/           → Generic JSON blob per job (spark_summaries table)
  spark_jobs/batch/     → Normalised rows per entity, dedicated tables,
                          linked by batch_run_id UUID, history preserved

Batch job modules
-----------------
  batch_building_totals  → batch_building_totals  (per-building totals)
  batch_daily_totals     → batch_daily_totals      (date × building)
  batch_monthly_totals   → batch_monthly_totals    (year × month × building)
  batch_peak_hours       → batch_peak_hours        (ranked peak hour-of-day)
  batch_top_buildings    → batch_top_buildings     (ranked buildings)
  batch_wastage_report   → batch_wastage_report    (off-hours + weekend)

Entrypoint
----------
  cd backend
  python spark_jobs/batch/spark_batch_runner.py --all --local
  python spark_jobs/batch/spark_batch_runner.py --job building_totals --local
  python spark_jobs/batch/spark_batch_runner.py --list
"""
