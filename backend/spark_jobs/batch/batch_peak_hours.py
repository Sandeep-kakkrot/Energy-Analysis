"""
Batch Job 4: Peak Consumption Hours
=====================================
Reads from Hive, computes average and total kWh per hour-of-day
across the entire campus, ranks them, and writes to batch_peak_hours.

HiveQL equivalent:
    SELECT
        hour_of_day,
        ROUND(AVG(consumption_kwh), 6)  AS avg_kwh,
        ROUND(SUM(consumption_kwh), 4)  AS total_kwh,
        RANK() OVER (ORDER BY SUM(consumption_kwh) DESC) AS peak_rank
    FROM campus_energy.energy_records
    GROUP BY hour_of_day
    ORDER BY peak_rank;

PySpark equivalent:
    from pyspark.sql import functions as F
    from pyspark.sql.window import Window

    ranked = (
        sdf.groupBy("hour_of_day")
           .agg(
               F.round(F.avg("consumption_kwh"), 6).alias("avg_kwh"),
               F.round(F.sum("consumption_kwh"), 4).alias("total_kwh"),
           )
           .withColumn("peak_rank",
               F.rank().over(Window.orderBy(F.desc("total_kwh"))))
           .orderBy("peak_rank")
    )
"""
from __future__ import annotations

import pandas as pd
from .base_batch_job import BaseBatchJob


class BatchPeakHours(BaseBatchJob):
    """
    Calculates ranked peak consumption hours (0–23) across all buildings.

    Output table: batch_peak_hours
    Columns: hour_of_day, avg_kwh, total_kwh, peak_rank
    """

    TABLE_NAME = "batch_peak_hours"
    JOB_LABEL  = "PeakHours"

    def hive_sql(self) -> str:
        """
        Push groupBy + RANK() window function into Hive/Spark.
        The window function runs as a distributed operation in cluster mode.
        """
        return """
            SELECT
                hour_of_day,
                ROUND(AVG(consumption_kwh), 6)                             AS avg_kwh,
                ROUND(SUM(consumption_kwh), 4)                             AS total_kwh,
                RANK() OVER (ORDER BY SUM(consumption_kwh) DESC)           AS peak_rank
            FROM campus_energy.energy_records
            GROUP BY hour_of_day
            ORDER BY peak_rank
        """

    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        PySpark: groupBy(hour_of_day).agg(avg, sum) + RANK() window function.

        pandas equivalent of:
            sdf.groupBy("hour_of_day")
               .agg(avg, sum)
               .withColumn("peak_rank", rank().over(orderBy(desc("total_kwh"))))
        """
        agg = (
            df.groupby("hour_of_day", sort=True)["consumption_kwh"]
            .agg(avg_kwh="mean", total_kwh="sum")
            .reset_index()
        )
        agg["avg_kwh"]   = agg["avg_kwh"].round(6)
        agg["total_kwh"] = agg["total_kwh"].round(4)

        # RANK() OVER (ORDER BY total_kwh DESC) — mirrors Spark window function
        agg = agg.sort_values("total_kwh", ascending=False).reset_index(drop=True)
        agg["peak_rank"] = range(1, len(agg) + 1)   # dense rank (ties treated independently)
        agg["peak_rank"] = agg["peak_rank"].astype(int)
        agg["hour_of_day"] = agg["hour_of_day"].astype(int)

        return agg
