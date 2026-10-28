"""
Data Seeder Service — generates realistic historical energy data.

Patterns implemented:
  - Weekday peaks: 08:00–11:00 and 13:00–17:00 (academic hours)
  - Hostel: high usage 06:00–08:00 and 20:00–23:00
  - Library: steady usage 08:00–22:00
  - Laboratories: peak 09:00–18:00 with equipment base load
  - Night-time (00:00–05:00): minimal but non-zero (security + standby)
  - Weekends: 40–60% of weekday load depending on building type
  - Seasonal variation: ±15% across months (higher in summer for AC)
"""
from __future__ import annotations
import random
from datetime import datetime, timedelta
from ..extensions import db
from ..models import Building, EnergyRecord

# ─── Base hourly load profiles (kWh) ───────────────────────
# Shape: dict[hour(0-23)] → multiplier (relative)
_PROFILES: dict[str, list[float]] = {
    "classroom": [
        0.05, 0.04, 0.04, 0.04, 0.05, 0.07,  # 00-05
        0.20, 0.60, 0.95, 1.00, 0.98, 0.95,  # 06-11
        0.90, 0.95, 1.00, 0.98, 0.90, 0.70,  # 12-17
        0.30, 0.15, 0.10, 0.08, 0.06, 0.05,  # 18-23
    ],
    "laboratory": [
        0.25, 0.22, 0.22, 0.22, 0.25, 0.28,  # 00-05  (equipment base load)
        0.40, 0.65, 0.90, 1.00, 1.00, 0.95,  # 06-11
        0.85, 0.95, 1.00, 0.98, 0.90, 0.85,  # 12-17
        0.70, 0.50, 0.40, 0.35, 0.30, 0.27,  # 18-23
    ],
    "library": [
        0.08, 0.07, 0.07, 0.07, 0.08, 0.10,  # 00-05
        0.25, 0.55, 0.90, 0.95, 0.95, 0.90,  # 06-11
        0.85, 0.90, 0.90, 0.88, 0.85, 0.80,  # 12-17
        0.75, 0.65, 0.55, 0.20, 0.10, 0.08,  # 18-23
    ],
    "hostel": [
        0.45, 0.40, 0.38, 0.38, 0.40, 0.55,  # 00-05  (residential baseline)
        0.90, 1.00, 0.85, 0.60, 0.50, 0.45,  # 06-11
        0.50, 0.48, 0.45, 0.50, 0.60, 0.70,  # 12-17
        0.85, 0.95, 1.00, 0.98, 0.80, 0.55,  # 18-23
    ],
}

# Base kWh per hour at 100% load for each type
_BASE_KWH: dict[str, float] = {
    "classroom":  45.0,
    "laboratory": 80.0,
    "library":    35.0,
    "hostel":     60.0,
}

# Month-based seasonal multiplier (India: peak AC in summer/monsoon)
_SEASONAL: dict[int, float] = {
    1: 0.90, 2: 0.92, 3: 0.95, 4: 1.05, 5: 1.15,
    6: 1.10, 7: 1.08, 8: 1.05, 9: 1.00, 10: 0.95,
    11: 0.90, 12: 0.88,
}

# Weekend multiplier per building type
_WEEKEND_FACTOR: dict[str, float] = {
    "classroom":  0.25,
    "laboratory": 0.55,  # experiments continue
    "library":    0.60,  # students study on weekends
    "hostel":     0.85,  # always occupied
}


def _consumption(building_type: str, hour: int, is_weekend: bool, month: int) -> float:
    profile    = _PROFILES[building_type][hour]
    base       = _BASE_KWH[building_type]
    seasonal   = _SEASONAL[month]
    weekend_f  = _WEEKEND_FACTOR[building_type] if is_weekend else 1.0
    noise      = random.uniform(0.92, 1.08)
    return round(base * profile * seasonal * weekend_f * noise, 4)


def seed_energy_data(years: int = 2, batch_size: int = 5000) -> int:
    """
    Seed `years` years of hourly energy data for all buildings.
    Returns the total number of records inserted.
    """
    buildings = Building.query.all()
    if not buildings:
        raise RuntimeError("No buildings found. Run schema.sql first.")

    end_dt   = datetime(2025, 12, 31, 23, 0, 0)
    start_dt = end_dt - timedelta(days=365 * years)

    total_inserted = 0
    batch: list[EnergyRecord] = []

    current = start_dt
    while current <= end_dt:
        dow        = current.weekday()           # 0=Mon
        is_weekend = dow >= 5
        for bld in buildings:
            kwh = _consumption(bld.type, current.hour, is_weekend, current.month)
            batch.append(EnergyRecord(
                building_id     = bld.id,
                recorded_at     = current,
                consumption_kwh = kwh,
                hour_of_day     = current.hour,
                day_of_week     = dow,
                day_of_month    = current.day,
                month_num       = current.month,
                year_num        = current.year,
                is_weekend      = is_weekend,
                is_holiday      = False,
            ))

            if len(batch) >= batch_size:
                db.session.bulk_save_objects(batch)
                db.session.commit()
                total_inserted += len(batch)
                batch = []

        current += timedelta(hours=1)

    # Flush remaining
    if batch:
        db.session.bulk_save_objects(batch)
        db.session.commit()
        total_inserted += len(batch)

    return total_inserted
