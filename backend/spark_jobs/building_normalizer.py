"""
Building Normalizer — Campus Energy Analysis
============================================
Canonical campus buildings:
  1. Laboratory Block B  (code: LB-B, type: laboratory)
  2. Classroom Block A   (code: CB-A, type: classroom)
  3. Hostel Complex      (code: HST,  type: hostel)
  4. Central Library     (code: LIB,  type: library)
"""
from __future__ import annotations
from typing import Tuple, Dict, Any

CANONICAL_BUILDINGS: Dict[str, Dict[str, Any]] = {
    "Laboratory Block B": {
        "id": 2,
        "name": "Laboratory Block B",
        "block_code": "LB-B",
        "type": "laboratory",
        "capacity": 300,
        "area_sqft": 18000,
        "color": "#f59e0b",
    },
    "Classroom Block A": {
        "id": 1,
        "name": "Classroom Block A",
        "block_code": "CB-A",
        "type": "classroom",
        "capacity": 800,
        "area_sqft": 25000,
        "color": "#60a5fa",
    },
    "Hostel Complex": {
        "id": 4,
        "name": "Hostel Complex",
        "block_code": "HST",
        "type": "hostel",
        "capacity": 1200,
        "area_sqft": 45000,
        "color": "#a78bfa",
    },
    "Central Library": {
        "id": 3,
        "name": "Central Library",
        "block_code": "LIB",
        "type": "library",
        "capacity": 500,
        "area_sqft": 30000,
        "color": "#34d399",
    },
}

def canonicalize_building(name: str | None, code: str | None = None) -> Tuple[str, str, str]:
    """
    Map any building name variant, code or area suffix to the canonical campus building.
    Returns: (canonical_name, canonical_code, canonical_type)
    """
    raw_str = f"{name or ''} {code or ''}".strip().lower()

    if any(k in raw_str for k in ("lab", "lb-b", "lb_b", "lb", "laborat")):
        return "Laboratory Block B", "LB-B", "laboratory"
    if any(k in raw_str for k in ("class", "cb-a", "cb_a", "cb", "clas")):
        return "Classroom Block A", "CB-A", "classroom"
    if any(k in raw_str for k in ("host", "hst")):
        return "Hostel Complex", "HST", "hostel"
    if any(k in raw_str for k in ("lib", "cent", "library")):
        return "Central Library", "LIB", "library"

    base_name = str(name).split(" - ")[0].split("-")[0].strip() if name else (code or "Other")
    base_code = str(code or base_name[:4].upper())
    return base_name, base_code, "other"
