"""
Spark Batch Runner — Campus Energy Analysis
===========================================
CLI orchestrator for all Spark BATCH jobs.

Each batch job reads from Hive (or local CSVs in dev), performs
PySpark-style groupBy / agg transforms, and writes normalised result
rows to dedicated MySQL tables (NOT the generic spark_summaries blob).

Design contrast with spark_runner.py
--------------------------------------
  spark_runner.py     → 6 jobs → spark_summaries (one JSON blob per job)
  spark_batch_runner  → 6 jobs → 6 dedicated tables, rows per entity,
                                 keyed by batch_run_id UUID, historical
                                 runs preserved indefinitely.

Batch run lifecycle
--------------------
  1. INSERT batch_runs row (status='running')
  2. Run each BaseBatchJob.execute() in sequence
  3. UPDATE batch_runs row (status='success'|'partial'|'failed')

Database tables written
------------------------
  batch_building_totals   Building-level totals
  batch_daily_totals      Date × building daily totals
  batch_monthly_totals    Year × month × building monthly totals
  batch_peak_hours        Ranked peak hour-of-day
  batch_top_buildings     Ranked buildings by total consumption
  batch_wastage_report    Off-hours + weekend wastage per building

Usage
-----
  # Run all batch jobs (local CSV mode — no HDFS required)
  python spark_batch_runner.py --all --local

  # Run all jobs in Hive cluster mode (requires HDFS + Hive Metastore)
  python spark_batch_runner.py --all

  # Run a single batch job
  python spark_batch_runner.py --job building_totals --local
  python spark_batch_runner.py --job daily_totals --local
  python spark_batch_runner.py --job monthly_totals --local
  python spark_batch_runner.py --job peak_hours --local
  python spark_batch_runner.py --job top_buildings --local
  python spark_batch_runner.py --job wastage_report --local

  # List all registered jobs
  python spark_batch_runner.py --list

Environment variables (set in backend/.env)
--------------------------------------------
  SPARK_LOCAL_MODE  true | false    Whether to use local CSVs
  LOCAL_CSV_DIR     data/raw        Path to local CSVs (local mode only)
  HDFS_NAMENODE     hdfs://...      HDFS NameNode URI (cluster mode only)
  USE_HIVE          true | false    Use Hive Metastore (cluster mode)
  DB_HOST / DB_USER / DB_PASSWORD   MySQL connection details
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from typing import Type

# ── Resolve backend/ root so imports work from any cwd ──────
_BATCH_DIR   = os.path.dirname(os.path.abspath(__file__))
_JOBS_DIR    = os.path.dirname(_BATCH_DIR)          # spark_jobs/
_BACKEND_DIR = os.path.dirname(_JOBS_DIR)           # backend/
for _p in (_BACKEND_DIR, _JOBS_DIR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

from spark_jobs.batch.base_batch_job      import BaseBatchJob
from spark_jobs.batch.batch_building_totals import BatchBuildingTotals
from spark_jobs.batch.batch_daily_totals    import BatchDailyTotals
from spark_jobs.batch.batch_monthly_totals  import BatchMonthlyTotals
from spark_jobs.batch.batch_peak_hours      import BatchPeakHours
from spark_jobs.batch.batch_top_buildings   import BatchTopBuildings
from spark_jobs.batch.batch_wastage_report  import BatchWastageReport

load_dotenv()
log = logging.getLogger(__name__)

# ── Job registry ─────────────────────────────────────────────
JOB_REGISTRY: dict[str, Type[BaseBatchJob]] = {
    "building_totals": BatchBuildingTotals,
    "daily_totals":    BatchDailyTotals,
    "monthly_totals":  BatchMonthlyTotals,
    "peak_hours":      BatchPeakHours,
    "top_buildings":   BatchTopBuildings,
    "wastage_report":  BatchWastageReport,
}


# ── DB helpers ────────────────────────────────────────────────

def _build_engine():
    host = os.getenv("DB_HOST",     "localhost")
    port = os.getenv("DB_PORT",     "3306")
    user = os.getenv("DB_USER",     "root")
    pwd  = os.getenv("DB_PASSWORD", "root")
    name = os.getenv("DB_NAME",     "campus_energy")
    url  = f"mysql+pymysql://{user}:{pwd}@{host}:{port}/{name}?charset=utf8mb4"
    return create_engine(url, pool_pre_ping=True)


def _register_batch_start(engine, batch_run_id: str, jobs_total: int) -> None:
    """INSERT the batch_runs row with status='running'."""
    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO batch_runs
                (batch_run_id, started_at, status, jobs_total, jobs_ok, jobs_failed, notes)
            VALUES
                (:run_id, :started_at, 'running', :total, 0, 0, :notes)
        """), {
            "run_id":     batch_run_id,
            "started_at": datetime.now(timezone.utc).replace(tzinfo=None),
            "total":      jobs_total,
            "notes":      f"Batch run started — {jobs_total} job(s) queued",
        })
    log.info("[BatchRunner] Registered batch_run_id=%s", batch_run_id)


def _register_batch_end(
    engine,
    batch_run_id: str,
    results: list[dict],
    data_source: str,
) -> None:
    """UPDATE the batch_runs row with final status."""
    ok      = sum(1 for r in results if r.get("status") == "ok")
    failed  = len(results) - ok
    status  = "success" if failed == 0 else ("partial" if ok > 0 else "failed")
    summary = "; ".join(
        f"{r['job_label']}→{r.get('rows_written',0)} rows" for r in results
    )
    with engine.begin() as conn:
        conn.execute(text("""
            UPDATE batch_runs SET
                finished_at  = :finished_at,
                data_source  = :source,
                status       = :status,
                jobs_ok      = :ok,
                jobs_failed  = :failed,
                notes        = :notes
            WHERE batch_run_id = :run_id
        """), {
            "finished_at": datetime.now(timezone.utc).replace(tzinfo=None),
            "source":      data_source,
            "status":      status,
            "ok":          ok,
            "failed":      failed,
            "notes":       summary,
            "run_id":      batch_run_id,
        })
    log.info("[BatchRunner] Closed batch_run_id=%s  status=%s", batch_run_id, status)


# ── Runner logic ──────────────────────────────────────────────

def _setup_logging(verbose: bool = False) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
        datefmt="%H:%M:%S",
    )


def _run_job(job_name: str, batch_run_id: str, local: bool) -> dict:
    """Instantiate and execute a single batch job; return its result dict."""
    cls = JOB_REGISTRY.get(job_name)
    if cls is None:
        raise ValueError(
            f"Unknown batch job: '{job_name}'. "
            f"Available: {', '.join(JOB_REGISTRY)}"
        )
    job = cls(local=local)
    return job.execute(batch_run_id=batch_run_id)


def _run_all(local: bool) -> list[dict]:
    """Execute all registered batch jobs under one batch_run_id."""
    engine       = _build_engine()
    batch_run_id = str(uuid.uuid4())
    job_names    = list(JOB_REGISTRY.keys())

    _register_batch_start(engine, batch_run_id, jobs_total=len(job_names))

    results      = []
    data_source  = "LOCAL" if local else "HIVE"
    total_start  = time.time()

    for job_name in job_names:
        try:
            result = _run_job(job_name, batch_run_id=batch_run_id, local=local)
            results.append(result)
            data_source = result.get("data_source", data_source)
        except Exception as exc:
            log.error("[BatchRunner] Job '%s' FAILED: %s", job_name, exc, exc_info=True)
            results.append({
                "job_label":    job_name,
                "table":        JOB_REGISTRY[job_name].TABLE_NAME,
                "rows_written": 0,
                "elapsed_sec":  0,
                "status":       "error",
                "error":        str(exc),
            })

    _register_batch_end(engine, batch_run_id, results, data_source)

    # ── Print summary table ───────────────────────────────────
    elapsed = round(time.time() - total_start, 2)
    ok      = sum(1 for r in results if r.get("status") == "ok")
    err     = len(results) - ok

    print("\n" + "=" * 68)
    print("  Spark BATCH Runner — Campus Energy Analysis")
    print(f"  batch_run_id: {batch_run_id}")
    print("=" * 68)
    for r in results:
        icon  = "[OK]" if r.get("status") == "ok" else "[ERR]"
        label = r.get("job_label", "?")
        table = r.get("table", "?")
        rows  = r.get("rows_written", 0)
        secs  = r.get("elapsed_sec", "?")
        err_s = r.get("error", "")
        if r.get("status") == "ok":
            print(f"  {icon}  {label:<22} -> {table:<28} {rows:>6} rows  {secs}s")
        else:
            print(f"  {icon}  {label:<22} -> {table:<28} FAILED: {err_s}")
    print("=" * 68)
    print(f"  {ok} succeeded, {err} failed  |  total {elapsed}s")
    print("=" * 68 + "\n")

    return results


# ── CLI entry point ───────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Campus Energy Analysis — Spark Batch job orchestrator"
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--all",  action="store_true",  help="Run all registered batch jobs")
    group.add_argument("--job",  metavar="JOB_NAME",   help="Run a single batch job by name")
    group.add_argument("--list", action="store_true",  help="List all available batch jobs")

    parser.add_argument(
        "--local", action="store_true",
        help="Force local-CSV mode (overrides SPARK_LOCAL_MODE env var)",
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable debug logging")

    args = parser.parse_args()
    _setup_logging(verbose=args.verbose)

    # Determine local mode: CLI flag takes precedence over env var
    local = args.local or (os.getenv("SPARK_LOCAL_MODE", "true").lower() == "true")

    if args.list:
        print("\nRegistered Spark batch jobs:")
        for name, cls in JOB_REGISTRY.items():
            print(f"  • {name:<20} → {cls.TABLE_NAME}")
        print()
        return

    if args.all:
        _run_all(local=local)
    else:
        batch_run_id = str(uuid.uuid4())
        engine = _build_engine()
        _register_batch_start(engine, batch_run_id, jobs_total=1)
        try:
            result = _run_job(args.job, batch_run_id=batch_run_id, local=local)
            _register_batch_end(engine, batch_run_id, [result],
                                result.get("data_source", "LOCAL"))
            print(
                f"\n[OK]  {result['job_label']:<22} "
                f"→ {result['table']:<28} "
                f"{result.get('rows_written', 0):>6} rows  "
                f"{result.get('elapsed_sec', '?')}s\n"
                f"batch_run_id: {batch_run_id}\n"
            )
        except Exception as exc:
            _register_batch_end(engine, batch_run_id,
                                [{"job_label": args.job, "table": "", "status": "error", "error": str(exc)}],
                                "LOCAL" if local else "HIVE")
            log.error("[BatchRunner] Job '%s' FAILED: %s", args.job, exc, exc_info=True)
            sys.exit(1)


if __name__ == "__main__":
    main()
