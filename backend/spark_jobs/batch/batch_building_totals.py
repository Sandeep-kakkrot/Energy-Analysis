"""
Batch Job 1: Total Electricity per Building
============================================
Reads from Hive, computes total kWh consumed by each building,
and writes to batch_building_totals MySQL table.

HiveQL equivalent:
    SELECT
        building_code,
        building_name,
        SUM(consumption_kwh)  AS total_kwh,
        AVG(consumption_kwh)  AS avg_kwh_per_hour,
        MAX(consumption_kwh)  AS max_kwh,
        COUNT(*)              AS record_count
    FROM campus_energy.energy_records
    GROUP BY building_code, building_name
    ORDER BY total_kwh DESC;

PySpark equivalent:
    sdf.groupBy("building_code", "building_name") \\
       .agg(
           F.sum("consumption_kwh").alias("total_kwh"),
           F.avg("consumption_kwh").alias("avg_kwh_per_hour"),
           F.max("consumption_kwh").alias("max_kwh"),
           F.count("*").alias("record_count")
       ) \\
       .withColumn("pct_share",
           F.round(F.col("total_kwh") / F.sum("total_kwh").over(Window.partitionBy()) * 100, 4)
       ) \\
       .orderBy(F.desc("total_kwh"))
"""
from __future__ import annotations

import pandas as pd
from .base_batch_job import BaseBatchJob


class BatchBuildingTotals(BaseBatchJob):
    """
    Calculates total electricity consumed per campus building.

    Output table: batch_building_totals
    Columns: building_code, building_name, total_kwh, avg_kwh_per_hour,
             max_kwh, record_count, pct_share
    """

    TABLE_NAME = "batch_building_totals"
    JOB_LABEL  = "BuildingTotals"

    def hive_sql(self) -> str:
        # Pushes aggregation into Hive/Spark before collecting to driver
        # In cluster mode this runs as a distributed Spark SQL query
        return """
            SELECT
                building_code,
                building_name,
                SUM(consumption_kwh)  AS total_kwh,
                AVG(consumption_kwh)  AS avg_kwh_per_hour,
                MAX(consumption_kwh)  AS max_kwh,
                COUNT(1)              AS record_count
            FROM campus_energy.energy_records
            GROUP BY building_code, building_name
            ORDER BY total_kwh DESC
        """

    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        PySpark groupBy("building_code","building_name").agg(sum,avg,max,count)
        """
        from spark_jobs.building_normalizer import canonicalize_building

        df = df.copy()
        canon = [canonicalize_building(r.get("building_name"), r.get("building_code")) for _, r in df.iterrows()]
        df["building_name"] = [c[0] for c in canon]
        df["building_code"] = [c[1] for c in canon]

        agg = (
            df.groupby(["building_code", "building_name"], sort=False)["consumption_kwh"]
            .agg(
                total_kwh        = "sum",
                avg_kwh_per_hour = "mean",
                max_kwh          = "max",
                record_count     = "count",
            )
            .reset_index()
        )
        # Broadcast grand total to compute percentage share
        grand_total = agg["total_kwh"].sum()
        agg["pct_share"] = (agg["total_kwh"] / grand_total * 100).round(4) if grand_total else 0.0

        # Rank by descending consumption (mirrors Spark orderBy desc)
        agg = agg.sort_values("total_kwh", ascending=False).reset_index(drop=True)
        agg["total_kwh"]        = agg["total_kwh"].round(4)
        agg["avg_kwh_per_hour"] = agg["avg_kwh_per_hour"].round(6)
        agg["max_kwh"]          = agg["max_kwh"].round(4)

        return agg
