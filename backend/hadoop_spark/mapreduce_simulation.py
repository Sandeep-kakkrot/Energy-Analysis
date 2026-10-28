"""
Hadoop MapReduce Simulation — Campus Energy Analysis
=====================================================

Demonstrates the MapReduce programming model using Python.
In a real Hadoop cluster this would run as Java/Python streaming jobs
across HDFS-stored energy log files.

Pattern:
  MAP    : (building, hour) → (key, kWh_value)
  SHUFFLE: Group by key
  REDUCE : Sum all kWh values per key
"""
from __future__ import annotations
from collections import defaultdict
from typing import Any, Iterator


# ─────────────────────────────────────────────────────────────
#  Mapper
# ─────────────────────────────────────────────────────────────

def mapper(records: list[dict]) -> Iterator[tuple[str, float]]:
    """
    INPUT  : List of energy record dicts (from DB or HDFS file lines)
    EMITS  : (key, value) pairs — key = "building|hour", value = consumption_kwh

    In Hadoop this function runs on each DataNode independently,
    processing its local HDFS block of the energy log.
    """
    for record in records:
        building = record.get("building_name", "unknown")
        hour     = record.get("hour_of_day", 0)
        kwh      = float(record.get("consumption_kwh", 0))

        # Emit one key-value pair per record
        key = f"{building}|{hour:02d}"
        yield key, kwh


# ─────────────────────────────────────────────────────────────
#  Shuffler (handled by Hadoop framework in production)
# ─────────────────────────────────────────────────────────────

def shuffle(mapped_pairs: list[tuple[str, float]]) -> dict[str, list[float]]:
    """
    Groups all values by key.
    In real Hadoop this is done automatically between Map and Reduce phases
    via the sort-and-merge mechanism.
    """
    grouped: dict[str, list[float]] = defaultdict(list)
    for key, value in mapped_pairs:
        grouped[key].append(value)
    return dict(grouped)


# ─────────────────────────────────────────────────────────────
#  Reducer
# ─────────────────────────────────────────────────────────────

def reducer(grouped: dict[str, list[float]]) -> list[dict[str, Any]]:
    """
    INPUT  : { "building|hour": [kwh1, kwh2, ...] }
    OUTPUT : Aggregated result per (building, hour)
    """
    results = []
    for key, values in grouped.items():
        building, hour_str = key.split("|")
        results.append({
            "building":  building,
            "hour":      int(hour_str),
            "total_kwh": round(sum(values), 4),
            "avg_kwh":   round(sum(values) / len(values), 4),
            "count":     len(values),
        })
    return sorted(results, key=lambda x: (x["building"], x["hour"]))


# ─────────────────────────────────────────────────────────────
#  Full MapReduce Job
# ─────────────────────────────────────────────────────────────

def run_mapreduce(records: list[dict]) -> list[dict[str, Any]]:
    """
    Orchestrates the full MapReduce pipeline.

    In production Hadoop:
      1. Input split across HDFS blocks
      2. mapper() runs on each block in parallel
      3. Output shuffled and sorted across nodes
      4. reducer() runs per unique key
      5. Results written back to HDFS

    Usage:
        from hadoop_spark.mapreduce_simulation import run_mapreduce
        results = run_mapreduce(energy_records)
    """
    # Phase 1: Map
    mapped = list(mapper(records))

    # Phase 2: Shuffle (sort + group)
    grouped = shuffle(mapped)

    # Phase 3: Reduce
    return reducer(grouped)


# ─────────────────────────────────────────────────────────────
#  Standalone demo
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    import os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

    # Sample data
    sample_records = [
        {"building_name": "Classroom Block A", "hour_of_day": 9,  "consumption_kwh": 42.5},
        {"building_name": "Classroom Block A", "hour_of_day": 9,  "consumption_kwh": 44.1},
        {"building_name": "Laboratory Block B", "hour_of_day": 10, "consumption_kwh": 78.3},
        {"building_name": "Laboratory Block B", "hour_of_day": 10, "consumption_kwh": 80.0},
        {"building_name": "Central Library",    "hour_of_day": 14, "consumption_kwh": 30.2},
    ]

    print("=" * 60)
    print("  Hadoop MapReduce Simulation — Campus Energy Analysis")
    print("=" * 60)

    results = run_mapreduce(sample_records)
    for r in results:
        print(f"  [{r['building']}] Hour {r['hour']:02d}:00 → "
              f"Total: {r['total_kwh']} kWh | Avg: {r['avg_kwh']} kWh | Count: {r['count']}")

    print("=" * 60)
    print(f"  Total output keys: {len(results)}")
