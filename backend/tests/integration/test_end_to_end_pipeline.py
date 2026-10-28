"""
End-to-end Integration Test: Sample Dataset -> Spark Execution -> MySQL Store -> Flask REST API.
"""
import os
from datetime import datetime
import pandas as pd
from app.models.energy import SparkSummary
from app.extensions import db


def test_end_to_end_spark_to_api_flow(app, client, admin_token):
    fixture_csv = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "fixtures", "sample_test_energy.csv"
    )

    # 1. Read sample dataset
    df = pd.read_csv(fixture_csv)
    assert len(df) > 0

    # 2. Simulate Spark job computation
    total_kwh = float(df["consumption_kwh"].sum())
    avg_daily_kwh = float(df["consumption_kwh"].mean() * 24)
    peak_hour = int(df.groupby("hour_of_day")["consumption_kwh"].sum().idxmax())

    summary_payload = {
        "total_kwh": round(total_kwh, 2),
        "avg_daily_kwh": round(avg_daily_kwh, 2),
        "peak_hour": peak_hour,
        "wastage_pct": 12.5,
        "total_records": len(df)
    }

    # 3. Store pre-computed payload into database
    with app.app_context():
        existing = SparkSummary.query.filter_by(job_name="dashboard_summary").first()
        if existing:
            existing.payload = summary_payload
            existing.computed_at = datetime.utcnow()
        else:
            summary_row = SparkSummary(
                job_name="dashboard_summary",
                computed_at=datetime.utcnow(),
                hdfs_source="TEST_FIXTURE",
                record_count=len(df),
                payload=summary_payload
            )
            db.session.add(summary_row)
        db.session.commit()

    # 4. Request dashboard summary from API via Flask client with JWT
    res = client.get("/api/dashboard/summary", headers={
        "Authorization": f"Bearer {admin_token}"
    })

    assert res.status_code == 200
    body = res.get_json()
    assert body["status"] == "success"
    assert body["data"]["total_kwh"] == round(total_kwh, 2)
    assert body["data"]["peak_hour"] == peak_hour
    assert body["data"]["total_records"] == len(df)
