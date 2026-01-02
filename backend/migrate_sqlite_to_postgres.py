#!/usr/bin/env python3
"""
Migrate data from SQLite to PostgreSQL.

Usage:
    python migrate_sqlite_to_postgres.py

This script:
1. Reads all data from the SQLite database
2. Inserts it into the PostgreSQL database
3. Preserves all relationships and IDs
"""

import os
import sqlite3
from datetime import datetime

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Load environment
load_dotenv()

# Source: SQLite
SQLITE_PATH = "easybewerbung.db"

# Target: PostgreSQL
POSTGRES_URL = os.getenv("DATABASE_URL", "postgresql://easybewerbung:localdev123@localhost:5432/easybewerbung")

print(f"Source: {SQLITE_PATH}")
print(f"Target: {POSTGRES_URL.split('@')[1] if '@' in POSTGRES_URL else POSTGRES_URL}")


def migrate():
    # Check if SQLite file exists
    if not os.path.exists(SQLITE_PATH):
        print(f"SQLite database not found at {SQLITE_PATH}")
        print("Nothing to migrate.")
        return

    # Connect to SQLite
    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cursor = sqlite_conn.cursor()

    # Connect to PostgreSQL
    pg_engine = create_engine(POSTGRES_URL)
    PgSession = sessionmaker(bind=pg_engine)
    pg_session = PgSession()

    # Import models to create tables
    from app.models import Base
    print("Creating PostgreSQL tables...")
    Base.metadata.create_all(bind=pg_engine)

    # Tables to migrate (in order for foreign key dependencies)
    tables = [
        "users",
        "documents",
        "job_offers",
        "applications",
        "generated_documents",
        "matching_scores",
        "generation_tasks",
        "matching_score_tasks",
        "document_templates",
        "prompt_templates",
        "language_settings",
        "user_activity_logs",
    ]

    for table in tables:
        try:
            # Get data from SQLite
            sqlite_cursor.execute(f"SELECT * FROM {table}")
            rows = sqlite_cursor.fetchall()

            if not rows:
                print(f"  {table}: 0 rows (empty)")
                continue

            columns = [description[0] for description in sqlite_cursor.description]

            # Insert into PostgreSQL
            for row in rows:
                row_dict = dict(zip(columns, row))

                # Convert SQLite integer booleans to Python booleans
                boolean_columns = ["applied", "is_spontaneous", "is_active", "is_admin"]
                for col in boolean_columns:
                    if col in row_dict and row_dict[col] is not None:
                        row_dict[col] = bool(row_dict[col])

                # Build INSERT statement
                cols = ", ".join(f'"{c}"' for c in columns)
                placeholders = ", ".join(f":{c}" for c in columns)
                sql = f'INSERT INTO {table} ({cols}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'

                try:
                    pg_session.execute(text(sql), row_dict)
                except Exception as e:
                    print(f"  Error inserting row into {table}: {e}")
                    pg_session.rollback()

            pg_session.commit()
            print(f"  {table}: {len(rows)} rows migrated")

        except sqlite3.OperationalError as e:
            if "no such table" in str(e):
                print(f"  {table}: table doesn't exist in SQLite, skipping")
            else:
                print(f"  {table}: error - {e}")
        except Exception as e:
            print(f"  {table}: error - {e}")
            pg_session.rollback()

    # Reset PostgreSQL sequences to max ID + 1
    print("\nResetting PostgreSQL sequences...")
    for table in tables:
        try:
            result = pg_session.execute(text(f"SELECT MAX(id) FROM {table}"))
            max_id = result.scalar()
            if max_id:
                pg_session.execute(text(f"SELECT setval('{table}_id_seq', {max_id}, true)"))
                print(f"  {table}_id_seq -> {max_id}")
        except Exception:
            pass  # Table might not have id column or sequence

    pg_session.commit()
    pg_session.close()
    sqlite_conn.close()

    print("\nMigration complete!")


if __name__ == "__main__":
    migrate()
