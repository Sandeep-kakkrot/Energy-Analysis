"""
Batch Job 2: Daily Electricity Totals
======================================
Reads from Hive, computes total and average kWh for each
building × calendar date, and writes to batch_daily_totals.

HiveQL equivalent:
    SELECT
        CONCAT(LPAD(year_num,4,'0'),'-',
               LPAD(month_num,2,'0'),'-',
               LPAD(day_of_month,2,'0'))  AS rec_date,
        building_name,
        SUM(consumption_kwh)              AS total_kwh,
        AVG(consumption_kwh)              AS avg_kwh
    FROM campus_energy.energy_records
    GROUP BY year_num, month_num, day_of_month, building_name
    ORDER BY rec_date, building_name;

PySpark equivalent:
    from pyspark.sql import functions as F
    sdf.withColumn("rec_date",
            F.concat_ws("-",
                F.lpad(F.col("year_num"),  4, "0"),
                F.lpad(F.col("month_num"), 2, "0"),
                F.lpad(F.col("day_of_month"), 2, "0")
            ).cast("date")
        ) \\
       .groupBy("rec_date", "building_name") \\
       .agg(F.sum("consumption_kwh").alias("total_kwh"),
            F.avg("consumption_kwh").alias("avg_kwh")) \\
       .orderBy("rec_date", "building_name")
"""
from __future__ import annotations

import pandas as pd
from .base_batch_job import BaseBatchJob


class BatchDailyTotals(BaseBatchJob):
    """
    Calculates daily total electricity per building.

    Output table: batch_daily_totals
    Columns: rec_date, building_name, total_kwh, avg_kwh
    """

    TABLE_NAME = "batch_daily_totals"
    JOB_LABEL  = "DailyTotals"

    def hive_sql(self) -> str:
        return """
            SELECT
                CONCAT(
                    LPAD(CAST(year_num     AS STRING), 4, '0'), '-',
                    LPAD(CAST(month_num    AS STRING), 2, '0'), '-',
                    LPAD(CAST(day_of_month AS STRING), 2, '0')
                )                         AS rec_date,
                building_name,
                ROUND(SUM(consumption_kwh), 4) AS total_kwh,
                ROUND(AVG(consumption_kwh), 6) AS avg_kwh
            FROM campus_energy.energy_records
            GROUP BY year_num, month_num, day_of_month, building_name
            ORDER BY rec_date, building_name
        """

    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        PySpark: withColumn("rec_date", date_expr).groupBy(date, building).agg(sum, avg)
        """
        df = df.copy()
        # Construct ISO date string — mirrors Spark's concat_ws / lpad
        df["rec_date"] = (
            df["year_num"].astype(str).str.zfill(4) + "-" +
            df["month_num"].astype(str).str.zfill(2) + "-" +
            df["day_of_month"].astype(str).str.zfill(2)
        )

        agg = (
            df.groupby(["rec_date", "building_name"], sort=True)["consumption_kwh"]
            .agg(total_kwh="sum", avg_kwh="mean")
            .reset_index()
        )
        agg["total_kwh"] = agg["total_kwh"].round(4)
        agg["avg_kwh"]   = agg["avg_kwh"].round(6)
        return agg
