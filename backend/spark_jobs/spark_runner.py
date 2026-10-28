"""
Spark Runner — Campus Energy Analysis
=======================================
CLI orchestrator for all Spark jobs.

This script reads from HDFS (or local CSVs in dev mode) and writes
pre-computed summaries to the spark_summaries MySQL table.

The Flask REST API reads ONLY from spark_summaries — it never calls
this script directly and never touches HDFS.

Usage
-----
  # Run all 6 jobs (uses SPARK_LOCAL_MODE env var)
  python spark_runner.py --all

  # Force local-CSV mode regardless of env var
  python spark_runner.py --all --local

  # Run a single job
  python spark_runner.py --job dashboard_summary
  python spark_runner.py --job building_comparison
  python spark_runner.py --job daily_trends
  python spark_runner.py --job monthly_trends
  python spark_runner.py --job peak_usage
  python spark_runner.py --job wastage_indicators

  # List all registered jobs
  python spark_runner.py --list

Environment variables (set in backend/.env)
-------------------------------------------
  SPARK_LOCAL_MODE  true | false    Whether to use local CSVs
  LOCAL_CSV_DIR     data/raw        Path to local CSVs (local mode only)
  HDFS_NAMENODE     hdfs://...      HDFS NameNode URI (cluster mode only)
  DB_HOST / DB_USER / DB_PASSWORD   MySQL connection details
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
import time
from typing import Type

# ── Resolve backend/ root so imports work from any cwd ──────
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from spark_jobs.job_dashboard_summary   import DashboardSummaryJob
from spark_jobs.job_building_comparison import BuildingComparisonJob
from spark_jobs.job_daily_trends        import DailyTrendsJob
from spark_jobs.job_monthly_trends      import MonthlyTrendsJob
from spark_jobs.job_peak_usage          import PeakUsageJob
from spark_jobs.job_wastage_indicators  import WastageIndicatorsJob
from spark_jobs.base_job                import BaseSparkJob

# ── Job registry ─────────────────────────────────────────────
JOB_REGISTRY: dict[str, Type[BaseSparkJob]] = {
    "dashboard_summary":   DashboardSummaryJob,
    "building_comparison": BuildingComparisonJob,
    "daily_trends":        DailyTrendsJob,
    "monthly_trends":      MonthlyTrendsJob,
    "peak_usage":          PeakUsageJob,
    "wastage_indicators":  WastageIndicatorsJob,
}


def _setup_logging(verbose: bool = False) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
        datefmt="%H:%M:%S",
    )


def _run_job(job_name: str, local: bool) -> dict:
    """Instantiate and execute a single job; return its result dict."""
    cls = JOB_REGISTRY.get(job_name)
    if cls is None:
        raise ValueError(
            f"Unknown job: '{job_name}'. "
            f"Available: {', '.join(JOB_REGISTRY)}"
        )
    job = cls(local=local)
    return job.execute()


def _run_all(local: bool) -> list[dict]:
    """Execute all registered jobs in sequence and collect results."""
    results = []
    total_start = time.time()

    for job_name in JOB_REGISTRY:
        try:
            result = _run_job(job_name, local=local)
            results.append(result)
        except Exception as exc:
            logging.error("[runner] Job '%s' FAILED: %s", job_name, exc, exc_info=True)
            results.append({
                "job_name": job_name,
                "status":   "error",
                "error":    str(exc),
            })

    elapsed = round(time.time() - total_start, 2)
    ok  = sum(1 for r in results if r.get("status") == "ok")
    err = len(results) - ok

    print("\n" + "=" * 60)
    print(f"  Spark Runner -- Campus Energy Analysis")
    print("=" * 60)
    for r in results:
        icon   = "[OK]" if r.get("status") == "ok" else "[ERR]"
        timing = f"{r.get('elapsed_sec', '?')}s" if r.get("status") == "ok" else r.get("error", "")
        print(f"  {icon}  {r['job_name']:<30} {timing}")
    print("=" * 60)
    print(f"  {ok} succeeded, {err} failed  |  total {elapsed}s")
    print("=" * 60 + "\n")

    return results


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Campus Energy Analysis — Spark job orchestrator"
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--all",  action="store_true",  help="Run all registered Spark jobs")
    group.add_argument("--job",  metavar="JOB_NAME",   help="Run a single job by name")
    group.add_argument("--list", action="store_true",  help="List all available jobs")

    parser.add_argument(
        "--local", action="store_true",
        help="Force local-CSV mode (overrides SPARK_LOCAL_MODE env var)",
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable debug logging")

    args = parser.parse_args()
    _setup_logging(verbose=args.verbose)

    # Determine local mode: CLI flag takes precedence
    local = args.local or (os.getenv("SPARK_LOCAL_MODE", "true").lower() == "true")

    if args.list:
        print("\nRegistered Spark jobs:")
        for name in JOB_REGISTRY:
            print(f"  • {name}")
        print()
        return

    if args.all:
        _run_all(local=local)
    else:
        result = _run_job(args.job, local=local)
        print(f"\n[OK] {result['job_name']} -- {result.get('elapsed_sec', '?')}s "
              f"| {result.get('record_count', 0):,} rows | source: {result.get('hdfs_source', '?')}\n")


if __name__ == "__main__":
    main()
