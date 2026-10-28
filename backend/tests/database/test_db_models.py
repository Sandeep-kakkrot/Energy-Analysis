"""
Database ORM tests verifying SQLAlchemy models, constraints, and relationships.
"""
from datetime import datetime
import pytest
from sqlite3 import IntegrityError as SQLiteIntegrityError
from sqlalchemy.exc import IntegrityError
from app.models.energy import Building, EnergyRecord, SparkSummary
from app.models.user import User


def test_building_crud_operations(app, db_session):
    building = Building(
        name="Test Innovation Hub",
        block_code="IH-1",
        type="laboratory",
        capacity=400,
        area_sqft=18000
    )
    db_session.add(building)
    db_session.commit()

    saved = Building.query.filter_by(block_code="IH-1").first()
    assert saved is not None
    assert saved.name == "Test Innovation Hub"
    assert saved.capacity == 400

    # Update
    saved.capacity = 450
    db_session.commit()
    assert Building.query.filter_by(block_code="IH-1").first().capacity == 450


def test_unique_building_block_code_constraint(app, db_session):
    b1 = Building(name="Block One", block_code="BLK-1", type="classroom", capacity=100, area_sqft=5000)
    b2 = Building(name="Block Two", block_code="BLK-1", type="classroom", capacity=200, area_sqft=6000)
    
    db_session.add(b1)
    db_session.commit()

    db_session.add(b2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_spark_summary_upsert(app, db_session):
    summary = SparkSummary(
        job_name="test_summary_job",
        computed_at=datetime.utcnow(),
        hdfs_source="LOCAL:/test",
        record_count=100,
        payload={"kwh": 500.0, "status": "ok"}
    )
    db_session.add(summary)
    db_session.commit()

    fetched = SparkSummary.query.filter_by(job_name="test_summary_job").first()
    assert fetched is not None
    assert fetched.payload["kwh"] == 500.0
    assert fetched.record_count == 100
