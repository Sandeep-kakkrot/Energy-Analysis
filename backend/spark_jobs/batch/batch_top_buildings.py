"""
Batch Job 5: Top Buildings by Total Consumption
================================================
Reads from Hive, ranks buildings by total kWh consumed,
and writes to batch_top_buildings.

HiveQL equivalent:
    SELECT
        RANK() OVER (ORDER BY SUM(consumption_kwh) DESC) AS rank_position,
        building_name,
        building_code,
        ROUND(SUM(consumption_kwh), 4) AS total_kwh,
        ROUND(SUM(consumption_kwh) / campus_total * 100, 4) AS pct_of_campus,
        CASE WHEN RANK() OVER (...) = 1 THEN TRUE ELSE FALSE END AS is_highest
    FROM campus_energy.energy_records
    GROUP BY building_name, building_code;

PySpark equivalent:
    from pyspark.sql import functions as F
    from pyspark.sql.window import Window

    campus_total = sdf.agg(F.sum("consumption_kwh")).collect()[0][0]
    ranked = (
        sdf.groupBy("building_name", "building_code")
           .agg(F.round(F.sum("consumption_kwh"), 4).alias("total_kwh"))
           .withColumn("rank_position",
               F.rank().over(Window.orderBy(F.desc("total_kwh"))))
           .withColumn("pct_of_campus",
               F.round(F.col("total_kwh") / F.lit(campus_total) * 100, 4))
           .withColumn("is_highest", F.col("rank_position") == 1)
           .orderBy("rank_position")
    )
"""
from __future__ import annotations

import pandas as pd
from .base_batch_job import BaseBatchJob


class BatchTopBuildings(BaseBatchJob):
    """
    Ranks campus buildings by total electricity consumption.

    Output table: batch_top_buildings
    Columns: rank_position, building_name, building_code,
             total_kwh, pct_of_campus, is_highest
    """

    TABLE_NAME = "batch_top_buildings"
    JOB_LABEL  = "TopBuildings"

    def hive_sql(self) -> str:
        """
        Push aggregation and ranking into Hive/Spark.
        Campus total is computed via a scalar subquery so no two-pass
        collection is needed in cluster mode.
        """
        return """
            SELECT
                building_name,
                building_code,
                ROUND(SUM(consumption_kwh), 4) AS total_kwh,
                ROUND(
                    SUM(consumption_kwh) /
                    SUM(SUM(consumption_kwh)) OVER () * 100,
                4)                             AS pct_of_campus
            FROM campus_energy.energy_records
            GROUP BY building_name, building_code
            ORDER BY total_kwh DESC
        """

    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        PySpark: groupBy(building).agg(sum) + rank() window + pct_of_campus.
        """
        from spark_jobs.building_normalizer import canonicalize_building

        df = df.copy()
        canon = [canonicalize_building(r.get("building_name"), r.get("building_code")) for _, r in df.iterrows()]
        df["building_name"] = [c[0] for c in canon]
        df["building_code"] = [c[1] for c in canon]

        agg = (
            df.groupby(["building_name", "building_code"], sort=False)["consumption_kwh"]
            .sum()
            .reset_index()
            .rename(columns={"consumption_kwh": "total_kwh"})
        )
        agg["total_kwh"] = agg["total_kwh"].round(4)

        # Sort descending and compute rank (mirrors RANK() OVER ORDER BY DESC)
        agg = agg.sort_values("total_kwh", ascending=False).reset_index(drop=True)
        agg["rank_position"] = range(1, len(agg) + 1)
        agg["rank_position"] = agg["rank_position"].astype(int)

        # Percentage share of campus-wide total (mirrors window SUM(SUM(...)) OVER ())
        campus_total = agg["total_kwh"].sum()
        agg["pct_of_campus"] = (agg["total_kwh"] / campus_total * 100).round(4) if campus_total else 0.0

        # Flag the single highest consumer
        agg["is_highest"] = agg["rank_position"] == 1

        return agg
