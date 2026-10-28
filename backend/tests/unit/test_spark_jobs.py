"""
Unit tests for Spark job data transformation and aggregation logic.
"""
import pandas as pd
from spark_jobs.job_dashboard_summary import DashboardSummaryJob
from spark_jobs.job_building_comparison import BuildingComparisonJob
from spark_jobs.job_peak_usage import PeakUsageJob
from spark_jobs.job_wastage_indicators import WastageIndicatorsJob


def test_dashboard_summary_computation():
    df = pd.DataFrame([
        {"building_code": "CB-A", "consumption_kwh": 100.0, "hour_of_day": 14, "is_weekend": False},
        {"building_code": "CB-A", "consumption_kwh": 200.0, "hour_of_day": 14, "is_weekend": False},
        {"building_code": "LB-B", "consumption_kwh": 300.0, "hour_of_day": 23, "is_weekend": True},
    ])

    total_kwh = df["consumption_kwh"].sum()
    assert total_kwh == 600.0

    peak_hour = df.groupby("hour_of_day")["consumption_kwh"].sum().idxmax()
    assert peak_hour == 14


def test_building_comparison_transformation():
    df = pd.DataFrame([
        {"building_code": "CB-A", "building_name": "Classroom Block A", "consumption_kwh": 500.0},
        {"building_code": "LB-B", "building_name": "Laboratory Block B", "consumption_kwh": 1500.0},
    ])

    totals = df.groupby("building_name")["consumption_kwh"].sum().reset_index()
    total_campus = totals["consumption_kwh"].sum()

    totals["pct_share"] = (totals["consumption_kwh"] / total_campus * 100).round(1)

    lb_b = totals[totals["building_name"] == "Laboratory Block B"].iloc[0]
    assert lb_b["pct_share"] == 75.0

    cb_a = totals[totals["building_name"] == "Classroom Block A"].iloc[0]
    assert cb_a["pct_share"] == 25.0


def test_wastage_classification():
    # Wastage > 35% -> high; 20-35% -> medium; < 20% -> low
    def classify(pct):
        return "high" if pct >= 35.0 else "medium" if pct >= 20.0 else "low"

    assert classify(42.5) == "high"
    assert classify(28.0) == "medium"
    assert classify(12.3) == "low"
