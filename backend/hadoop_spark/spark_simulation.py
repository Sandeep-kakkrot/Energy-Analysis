"""
Apache Spark Simulation — Campus Energy Analysis
=================================================

Demonstrates Spark's DataFrame/RDD programming model using pandas.
In production this would run on a Spark cluster via PySpark with HDFS as source.

Key Spark concepts shown:
  - RDD-style transformations (map, filter, reduceByKey)
  - DataFrame-style groupBy + agg (mirrors Spark SQL)
  - Window functions for running totals
  - Broadcast variables concept for building metadata
"""
from __future__ import annotations
from typing import Any
import pandas as pd


# ─────────────────────────────────────────────────────────────
#  Simulated RDD Operations (mirrors PySpark RDD API)
# ─────────────────────────────────────────────────────────────

class SimulatedRDD:
    """
    Lightweight RDD simulation using a Python list.
    In PySpark this would be sc.parallelize(data) or sc.textFile("hdfs://...")
    """

    def __init__(self, data: list):
        self._data = data

    def map(self, func):
        return SimulatedRDD([func(item) for item in self._data])

    def filter(self, func):
        return SimulatedRDD([item for item in self._data if func(item)])

    def reduce_by_key(self, func):
        """Simulates PySpark reduceByKey — groups by first element, applies func on values."""
        from collections import defaultdict
        grouped: dict = defaultdict(list)
        for key, value in self._data:
            grouped[key].append(value)
        return SimulatedRDD([(k, func(v)) for k, v in grouped.items()])

    def collect(self) -> list:
        return self._data

    def count(self) -> int:
        return len(self._data)

    def take(self, n: int) -> list:
        return self._data[:n]

    def sort_by(self, key_func, ascending: bool = True):
        return SimulatedRDD(sorted(self._data, key=key_func, reverse=not ascending))


# ─────────────────────────────────────────────────────────────
#  Spark DataFrame-style Analytics (mirrors PySpark DataFrame API)
# ─────────────────────────────────────────────────────────────

class SparkEnergyAnalyzer:
    """
    Simulates PySpark DataFrame operations for campus energy analysis.

    In real PySpark:
        spark = SparkSession.builder.appName("CampusEnergy").getOrCreate()
        df = spark.read.jdbc(url=jdbc_url, table="energy_records", properties=props)
    """

    def __init__(self, records: list[dict]):
        # Simulates: df = spark.createDataFrame(records)
        self._df = pd.DataFrame(records)
        if not self._df.empty:
            self._df["consumption_kwh"] = self._df["consumption_kwh"].astype(float)

    # ── groupBy + agg ──────────────────────────────────────────

    def total_by_building(self) -> pd.DataFrame:
        """
        PySpark equivalent:
            df.groupBy("building_name")
              .agg(F.sum("consumption_kwh").alias("total_kwh"),
                   F.avg("consumption_kwh").alias("avg_kwh"))
              .orderBy("total_kwh", ascending=False)
        """
        if self._df.empty:
            return pd.DataFrame()

        return (
            self._df.groupby("building_name")["consumption_kwh"]
            .agg(total_kwh="sum", avg_kwh="mean", count="count")
            .round(4)
            .reset_index()
            .sort_values("total_kwh", ascending=False)
        )

    def hourly_profile(self) -> pd.DataFrame:
        """
        PySpark equivalent:
            df.groupBy("hour_of_day")
              .agg(F.avg("consumption_kwh").alias("avg_kwh"))
              .orderBy("hour_of_day")
        """
        if self._df.empty:
            return pd.DataFrame()

        return (
            self._df.groupby("hour_of_day")["consumption_kwh"]
            .mean()
            .round(4)
            .reset_index()
            .rename(columns={"consumption_kwh": "avg_kwh"})
            .sort_values("hour_of_day")
        )

    def monthly_aggregation(self) -> pd.DataFrame:
        """
        PySpark equivalent:
            df.groupBy("year_num", "month_num", "building_name")
              .agg(F.sum("consumption_kwh").alias("total_kwh"))
              .orderBy("year_num", "month_num")
        """
        if self._df.empty:
            return pd.DataFrame()

        return (
            self._df.groupby(["year_num", "month_num", "building_name"])["consumption_kwh"]
            .sum()
            .round(2)
            .reset_index()
            .rename(columns={"consumption_kwh": "total_kwh"})
            .sort_values(["year_num", "month_num"])
        )

    def wastage_analysis(self) -> pd.DataFrame:
        """
        PySpark equivalent:
            df.withColumn("is_off_hours", (F.col("hour_of_day") < 6) | (F.col("hour_of_day") >= 22))
              .groupBy("building_name")
              .agg(
                  F.sum("consumption_kwh").alias("total"),
                  F.sum(F.when(F.col("is_off_hours"), F.col("consumption_kwh")).otherwise(0)).alias("wastage")
              )
        """
        if self._df.empty:
            return pd.DataFrame()

        df = self._df.copy()
        df["is_off_hours"] = (df["hour_of_day"] < 6) | (df["hour_of_day"] >= 22)

        total_df   = df.groupby("building_name")["consumption_kwh"].sum().rename("total_kwh")
        wastage_df = df[df["is_off_hours"]].groupby("building_name")["consumption_kwh"].sum().rename("wastage_kwh")

        result = pd.concat([total_df, wastage_df], axis=1).fillna(0).round(2)
        result["wastage_pct"] = (result["wastage_kwh"] / result["total_kwh"] * 100).round(2)
        return result.reset_index().sort_values("wastage_pct", ascending=False)

    # ── RDD-style pipeline ────────────────────────────────────

    def rdd_peak_hours(self) -> list[dict[str, Any]]:
        """
        Demonstrates RDD-style transformations:
        1. map: extract (hour, kwh) pairs
        2. reduceByKey: sum kwh per hour
        3. sortBy: rank by total kWh
        """
        if self._df.empty:
            return []

        records = self._df[["hour_of_day", "consumption_kwh"]].to_dict(orient="records")

        rdd = SimulatedRDD(records)

        result = (
            rdd
            .map(lambda r: (int(r["hour_of_day"]), float(r["consumption_kwh"])))
            .reduce_by_key(lambda values: sum(values))
            .sort_by(lambda kv: kv[1], ascending=False)
            .collect()
        )

        return [{"hour": k, "total_kwh": round(v, 2)} for k, v in result]


# ─────────────────────────────────────────────────────────────
#  Standalone demo
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import random
    random.seed(42)

    # Generate sample data
    buildings = ["Classroom Block A", "Laboratory Block B", "Central Library", "Hostel Complex"]
    sample = []
    for _ in range(500):
        sample.append({
            "building_name":  random.choice(buildings),
            "hour_of_day":    random.randint(0, 23),
            "consumption_kwh": random.uniform(5, 90),
            "year_num":       2025,
            "month_num":      random.randint(1, 12),
        })

    analyzer = SparkEnergyAnalyzer(sample)

    print("=" * 60)
    print("  Apache Spark Simulation — Campus Energy Analysis")
    print("=" * 60)

    print("\n[DataFrame] Total by Building:")
    print(analyzer.total_by_building().to_string(index=False))

    print("\n[DataFrame] Wastage Analysis:")
    print(analyzer.wastage_analysis().to_string(index=False))

    print("\n[RDD] Peak Hours (top 5):")
    for item in analyzer.rdd_peak_hours()[:5]:
        print(f"  Hour {item['hour']:02d}:00 → {item['total_kwh']} kWh")

    print("=" * 60)
