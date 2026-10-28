"""
SQLAlchemy ORM Models for Campus Energy Analysis.
"""
from datetime import datetime
from ..extensions import db


class Building(db.Model):
    """Represents a campus building / block."""
    __tablename__ = "buildings"

    id         = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name       = db.Column(db.String(100), nullable=False, unique=True)
    block_code = db.Column(db.String(20),  nullable=False, unique=True)
    type       = db.Column(
        db.Enum("classroom", "laboratory", "library", "hostel"),
        nullable=False,
    )
    capacity   = db.Column(db.Integer, nullable=False)
    area_sqft  = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship
    records = db.relationship("EnergyRecord", back_populates="building", lazy="dynamic")

    def to_dict(self):
        return {
            "id":         self.id,
            "name":       self.name,
            "block_code": self.block_code,
            "type":       self.type,
            "capacity":   self.capacity,
            "area_sqft":  self.area_sqft,
        }


class EnergyRecord(db.Model):
    """One row = electricity consumed in one hour by one building."""
    __tablename__ = "energy_records"

    id               = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    building_id      = db.Column(db.Integer, db.ForeignKey("buildings.id"), nullable=False, index=True)
    recorded_at      = db.Column(db.DateTime, nullable=False, index=True)
    consumption_kwh  = db.Column(db.Numeric(10, 4), nullable=False)
    hour_of_day      = db.Column(db.SmallInteger, nullable=False, index=True)
    day_of_week      = db.Column(db.SmallInteger, nullable=False, index=True)
    day_of_month     = db.Column(db.SmallInteger, nullable=False)
    month_num        = db.Column(db.SmallInteger, nullable=False, index=True)
    year_num         = db.Column(db.SmallInteger, nullable=False, index=True)
    is_weekend       = db.Column(db.Boolean, default=False)
    is_holiday       = db.Column(db.Boolean, default=False)

    building = db.relationship("Building", back_populates="records")

    def to_dict(self):
        return {
            "id":              self.id,
            "building_id":     self.building_id,
            "recorded_at":     self.recorded_at.isoformat(),
            "consumption_kwh": float(self.consumption_kwh),
            "hour_of_day":     self.hour_of_day,
            "day_of_week":     self.day_of_week,
            "month_num":       self.month_num,
            "year_num":        self.year_num,
        }


# ─────────────────────────────────────────────────────────────
#  Spark Summary Store
#  Written by Spark jobs; read by the Flask REST API.
#  The API never performs live aggregations — it reads the
#  JSON payload that Spark pre-computed from HDFS CSV files.
# ─────────────────────────────────────────────────────────────

class SparkSummary(db.Model):
    """
    Pre-computed Spark job result.

    One row per job_name (UNIQUE). Each Spark job upserts its row
    after reading from HDFS and completing its transformations.

    The Flask API fetches ``payload`` and returns it directly to
    the React frontend — zero additional aggregation in the API.
    """
    __tablename__ = "spark_summaries"

    id           = db.Column(db.Integer,     primary_key=True, autoincrement=True)
    job_name     = db.Column(db.String(64),  nullable=False, unique=True,
                             comment="Unique job identifier, e.g. dashboard_summary")
    computed_at  = db.Column(db.DateTime,    nullable=False,
                             comment="Timestamp when the Spark job finished")
    hdfs_source  = db.Column(db.String(255), nullable=False, default="",
                             comment="HDFS path that was read, or 'LOCAL' for local-CSV mode")
    record_count = db.Column(db.BigInteger,  nullable=False, default=0,
                             comment="Number of HDFS rows processed by the job")
    payload      = db.Column(db.JSON,        nullable=False,
                             comment="Serialised Spark output served as-is by the API")

    def to_dict(self) -> dict:
        return {
            "job_name":     self.job_name,
            "computed_at":  self.computed_at.isoformat(),
            "hdfs_source":  self.hdfs_source,
            "record_count": self.record_count,
            "payload":      self.payload,
        }

    def status_dict(self) -> dict:
        """Lightweight status row — omits the large payload field."""
        return {
            "job_name":     self.job_name,
            "computed_at":  self.computed_at.isoformat(),
            "hdfs_source":  self.hdfs_source,
            "record_count": self.record_count,
        }
