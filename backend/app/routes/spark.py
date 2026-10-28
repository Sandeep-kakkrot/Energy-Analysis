"""
Spark Admin Routes — Campus Energy Analysis
============================================
Endpoints for monitoring and triggering Spark jobs.

GET  /api/spark/status   — list all spark_summaries rows (no payload)
POST /api/spark/run      — trigger spark_runner.py as a subprocess

The POST endpoint is an admin-only convenience trigger.
In production, Spark jobs would be scheduled via cron or Apache Airflow.
"""
from __future__ import annotations

import logging
import os
import subprocess
import sys
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from ..auth.decorators import admin_required, jwt_required
from ..services.analytics_service import get_spark_job_statuses, NoSummaryAvailable

log = logging.getLogger(__name__)

spark_bp = Blueprint("spark", __name__, url_prefix="/api/spark")

# ── Available job names for validation ───────────────────────
VALID_JOBS = {
    "dashboard_summary",
    "building_comparison",
    "daily_trends",
    "monthly_trends",
    "peak_usage",
    "wastage_indicators",
}


# ─────────────────────────────────────────────────────────────
#  GET /api/spark/status
# ─────────────────────────────────────────────────────────────

@spark_bp.get("/status")
@jwt_required
def spark_status():
    """
    Return the status of all Spark jobs stored in spark_summaries.
    Payload field is excluded; only metadata is returned.

    Response 200
    ------------
    {
      "jobs": [
        {
          "job_name": "dashboard_summary",
          "computed_at": "2024-01-15T08:30:00",
          "hdfs_source": "LOCAL:/path/to/data/raw",
          "record_count": 70080
        }, ...
      ],
      "total": 6
    }
    """
    jobs = get_spark_job_statuses()
    return jsonify({
        "success": True,
        "jobs":    jobs,
        "total":   len(jobs),
        "message": (
            "No Spark jobs have been run yet. "
            "Run: python spark_jobs/spark_runner.py --all --local"
            if not jobs else f"{len(jobs)} job(s) available"
        ),
    })


# ─────────────────────────────────────────────────────────────
#  POST /api/spark/run
# ─────────────────────────────────────────────────────────────

@spark_bp.post("/run")
@admin_required
def spark_run():
    """
    Trigger Spark job(s) as a background subprocess.

    Request body (JSON, optional)
    ------------------------------
    {
      "job": "dashboard_summary",  // run a single job; omit for --all
      "local": true                // force local-CSV mode (default: true)
    }

    Response 202
    ------------
    {
      "success": true,
      "message": "Spark job(s) triggered",
      "command": "python spark_runner.py --all --local"
    }

    NOTE
    ----
    In production this endpoint would enqueue a job to an Apache Airflow
    DAG or a task queue (Celery). Here we launch spark_runner.py as a
    subprocess for local/demo convenience.
    """
    body  = request.get_json(silent=True) or {}
    job   = body.get("job")           # None → run all
    local = body.get("local", True)   # default: local-CSV mode

    # Validate job name
    if job and job not in VALID_JOBS:
        return jsonify({
            "success": False,
            "error":   f"Unknown job '{job}'. Valid options: {sorted(VALID_JOBS)}",
        }), 400

    # Build CLI command
    runner_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "spark_jobs", "spark_runner.py",
    )
    cmd = [sys.executable, runner_path]
    if job:
        cmd += ["--job", job]
    else:
        cmd.append("--all")
    if local:
        cmd.append("--local")

    cmd_str = " ".join(os.path.basename(c) if c != sys.executable else "python" for c in cmd)
    log.info("[spark_bp] Launching: %s", " ".join(cmd))

    try:
        # Non-blocking: subprocess runs independently
        subprocess.Popen(
            cmd,
            cwd=os.path.dirname(runner_path),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception as exc:
        log.error("[spark_bp] Failed to launch spark_runner: %s", exc)
        return jsonify({"success": False, "error": str(exc)}), 500

    return jsonify({
        "success": True,
        "message": f"Spark job(s) triggered. Results will appear in /api/spark/status shortly.",
        "command": cmd_str,
        "job":     job or "all",
        "local":   local,
    }), 202
