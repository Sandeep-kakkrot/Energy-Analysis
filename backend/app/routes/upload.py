"""
Upload API Router - Campus Energy Analysis
==========================================
Endpoints:
  POST /api/upload       - Accept single CSV/Excel file (backwards-compatible)
  POST /api/upload/batch - Accept multiple files with per-file dataset_type
  GET  /api/upload/info  - Returns supported formats & ingestion metadata
"""
from __future__ import annotations

import os
import logging
from flask import Blueprint, request, jsonify
from app.auth.decorators import jwt_required, admin_required
from app.services.ingestion_service import process_and_ingest_file, DATASET_TYPES

log = logging.getLogger(__name__)

bp = Blueprint("upload", __name__, url_prefix="/api/upload")


@bp.post("")
@jwt_required
@admin_required
def upload_file():
    """
    POST /api/upload  (single-file, backwards-compatible)
    Accepts multipart/form-data with key 'file' (.csv, .xlsx, .xls).
    Optional form field 'dataset_type' to override auto-detection.
    Admin role required.
    """
    if "file" not in request.files:
        return jsonify({
            "success": False,
            "error": "No file stream provided. Use form field 'file'."
        }), 400

    file_item = request.files["file"]
    if not file_item or file_item.filename == "":
        return jsonify({"success": False, "error": "No file selected."}), 400

    filename = file_item.filename
    ext = os.path.splitext(filename)[1].lower()
    if ext not in (".csv", ".xlsx", ".xls"):
        return jsonify({
            "success": False,
            "error": f"Invalid format '{ext}'. Allowed: .csv, .xlsx, .xls"
        }), 400

    dataset_type = request.form.get("dataset_type") or None
    local_mode   = os.getenv("SPARK_LOCAL_MODE", "true").lower() == "true"

    try:
        result = process_and_ingest_file(
            file_item.stream, filename,
            local_mode=local_mode,
            dataset_type=dataset_type,
        )
        return jsonify({
            "success": True,
            "message": f"Successfully ingested '{filename}'.",
            "data": result
        }), 200
    except Exception as exc:
        log.error("[upload] Failed to process '%s': %s", filename, exc, exc_info=True)
        return jsonify({"success": False, "error": f"Dataset ingestion error: {exc}"}), 500


@bp.post("/batch")
@jwt_required
@admin_required
def upload_batch():
    """
    POST /api/upload/batch  (multi-file)
    Accepts multipart/form-data:
      files[]        — one or more file streams
      dataset_types[] — parallel list of dataset type keys (one per file)

    Processes files sequentially. Spark is run once per file (ensures summaries
    are updated even if a later file fails).
    Returns a list of per-file result objects.
    Admin role required.
    """
    files        = request.files.getlist("files[]")
    dataset_types = request.form.getlist("dataset_types[]")

    if not files:
        return jsonify({"success": False, "error": "No files provided. Use form field 'files[]'."}), 400

    local_mode = os.getenv("SPARK_LOCAL_MODE", "true").lower() == "true"
    results    = []
    all_ok     = True

    for idx, file_item in enumerate(files):
        if not file_item or file_item.filename == "":
            results.append({"index": idx, "filename": "", "status": "error", "error": "Empty file stream."})
            all_ok = False
            continue

        filename = file_item.filename
        ext      = os.path.splitext(filename)[1].lower()
        if ext not in (".csv", ".xlsx", ".xls"):
            results.append({
                "index": idx, "filename": filename, "status": "error",
                "error": f"Invalid format '{ext}'. Allowed: .csv, .xlsx, .xls"
            })
            all_ok = False
            continue

        # Pick the matching dataset_type (or None for auto-detection)
        dtype = (dataset_types[idx] if idx < len(dataset_types) else None) or None

        try:
            result = process_and_ingest_file(
                file_item.stream, filename,
                local_mode=local_mode,
                dataset_type=dtype,
                archive_old=(idx == 0),
            )
            results.append({"index": idx, "status": "success", **result})
        except Exception as exc:
            log.error("[upload/batch] Failed '%s': %s", filename, exc, exc_info=True)
            results.append({
                "index": idx, "filename": filename,
                "status": "error", "error": str(exc)
            })
            all_ok = False

    return jsonify({
        "success": all_ok,
        "message": f"Processed {len(files)} file(s). "
                   f"{sum(1 for r in results if r['status'] == 'success')} succeeded.",
        "data": results,
    }), 200


@bp.get("/info")
@jwt_required
def upload_info():
    """GET /api/upload/info - Supported dataset formats & mode."""
    local_mode = os.getenv("SPARK_LOCAL_MODE", "true").lower() == "true"
    return jsonify({
        "success": True,
        "data": {
            "supported_formats":   [".csv", ".xlsx", ".xls"],
            "max_file_size_mb":    100,
            "max_files_per_batch": 10,
            "target_hdfs_dir":     "/energy/raw/",
            "target_hive_table":   "campus_energy.energy_records",
            "spark_local_mode":    local_mode,
            "dataset_types":       {k: v["label"] for k, v in DATASET_TYPES.items()},
            "flexible_columns":    True,
            "auto_detect_type":    True,
            "required_columns":    ["(any — schema is auto-detected and filled)"],
            "canonical_columns":   [
                "timestamp", "consumption_kwh", "building_code", "building_name",
                "hour_of_day", "day_of_week", "day_of_month", "month_num",
                "year_num", "is_weekend", "is_holiday"
            ],
        }
    }), 200
