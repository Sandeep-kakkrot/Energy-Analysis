"""
Database seed script — run once after schema.sql to populate 2 years of data.

Usage:
    cd backend
    python seed_data.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from app.extensions import db
from app.models import Building
from app.services import seed_energy_data


def main():
    app = create_app()
    with app.app_context():
        # Check if already seeded
        count = db.session.execute(
            db.text("SELECT COUNT(*) FROM energy_records")
        ).scalar()

        if count and count > 0:
            print(f"  ⚠  energy_records already has {count:,} rows. Skipping seed.")
            print("     Delete records manually and re-run if you want fresh data.")
            return

        print("  🌱 Starting data seed (2 years × 4 buildings × 24 hours) ...")
        print("     This may take 1–2 minutes for ~70k records...")

        total = seed_energy_data(years=2, batch_size=5000)
        print(f"  ✅  Seeded {total:,} energy records successfully!")


if __name__ == "__main__":
    main()
