"""
Batch Job 3: Monthly Electricity Totals
========================================
Reads from Hive, computes total and average kWh for each
building × year × month, and writes to batch_monthly_totals.

HiveQL equivalent:
    SELECT
        year_num,
        month_num,
        building_name,
        ROUND(SUM(consumption_kwh), 4) AS total_kwh,
        ROUND(AVG(consumption_kwh), 6) AS avg_kwh
    FROM campus_energy.energy_records
    GROUP BY year_num, month_num, building_name
    ORDER BY year_num, month_num, building_name;

PySpark equivalent:
    sdf.groupBy("year_num", "month_num", "building_name") \\
       .agg(
           F.round(F.sum("consumption_kwh"), 4).alias("total_kwh"),
           F.round(F.avg("consumption_kwh"), 6).alias("avg_kwh"),
       ) \\
       .orderBy("year_num", "month_num", "building_name")

Partition pruning benefit (cluster mode):
    The energy_records table is partitioned by (year_num, month_num).
    Hive/Spark skips reading HDFS partitions outside the requested range,
    making this query very efficient even over multi-year datasets.
"""
from __future__ import annotations

import pandas as pd
from .base_batch_job import BaseBatchJob


class BatchMonthlyTotals(BaseBatchJob):
    """
    Calculates monthly total electricity per building.

    Output table: batch_monthly_totals
    Columns: year_num, month_num, building_name, total_kwh, avg_kwh
    """

    TABLE_NAME = "batch_monthly_totals"
    JOB_LABEL  = "MonthlyTotals"

    def hive_sql(self) -> str:
        """
        Push aggregation into Hive/Spark — partition pruning applies
        automatically because year_num and month_num are partition keys.
        """
        return """
            SELECT
                year_num,
                month_num,
                building_name,
                ROUND(SUM(consumption_kwh), 4) AS total_kwh,
                ROUND(AVG(consumption_kwh), 6) AS avg_kwh
            FROM campus_energy.energy_records
            GROUP BY year_num, month_num, building_name
            ORDER BY year_num, month_num, building_name
        """

    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        PySpark: groupBy(year_num, month_num, building_name).agg(sum, avg)

        Mirrors Spark DataFrame:
            sdf.groupBy("year_num", "month_num", "building_name")
               .agg(F.sum("consumption_kwh"), F.avg("consumption_kwh"))
        """
        agg = (
            df.groupby(["year_num", "month_num", "building_name"], sort=True)["consumption_kwh"]
            .agg(total_kwh="sum", avg_kwh="mean")
            .reset_index()
        )
        agg["total_kwh"] = agg["total_kwh"].round(4)
        agg["avg_kwh"]   = agg["avg_kwh"].round(6)
        # Ensure correct integer types for partition columns
        agg["year_num"]  = agg["year_num"].astype(int)
        agg["month_num"] = agg["month_num"].astype(int)
        return agg
