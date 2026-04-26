"""Reconcile the database schema before the app starts.

The codebase uses two schema-management mechanisms in parallel:

1. ``Base.metadata.create_all`` (in ``init_db``) — creates the full
   schema in one shot. This is what production was bootstrapped with;
   the ``alembic_version`` table is therefore EMPTY on existing
   production databases.

2. Alembic migrations — provide delta upgrades and document the schema
   evolution. They assume a baseline of "everything before me already
   exists" and do NOT create the core tables.

Without reconciliation, ``alembic upgrade head`` on a production-style
DB fails because the very first migration tries to alter a table that
exists from create_all but isn't tracked. And on a fresh DB it fails
because the very first migration tries to alter a table that doesn't
exist yet.

This script does the following, idempotent on every container boot:

1. Run ``Base.metadata.create_all`` — guarantees every table the
   models declare exists. No-op on already-bootstrapped DBs.
2. If ``alembic_version`` is empty, stamp it to ``BASELINE_REVISION``
   — the latest migration that pre-dates the 2026-04-26 batch. This
   tells Alembic "this DB was created via create_all; treat
   everything up to BASELINE_REVISION as already applied".
3. Run ``alembic upgrade head`` — applies any post-baseline migrations
   (today: 20260426_01 / _02 / _03). Idempotent because each new
   migration uses inspector-based ``_column_exists`` / ``_index_exists``
   guards.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# The working directory inside the container is /app, the same place
# alembic.ini lives. Add the parent so we can import ``app.*``.
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from sqlalchemy import inspect, text  # noqa: E402

# The latest migration that pre-dates the 2026-04-26 reliability batch.
# Anything older is assumed to be already represented by create_all.
BASELINE_REVISION = "20260405_01"

# alembic.ini location relative to the script.
ALEMBIC_INI = ROOT / "alembic.ini"


def _alembic_version_is_empty(engine) -> bool:
    """Return True if no row exists in alembic_version (or table missing)."""
    inspector = inspect(engine)
    if "alembic_version" not in inspector.get_table_names():
        return True
    with engine.connect() as conn:
        row = conn.execute(text("SELECT version_num FROM alembic_version")).fetchone()
        return row is None


def _acquire_postgres_advisory_lock(engine, lock_id: int = 0xEA5BEBE2):
    """Take a session-scoped Postgres advisory lock for the bootstrap step.

    Without this lock two containers booting simultaneously can both
    observe ``alembic_version`` empty, both call ``command.stamp``, and
    both then ``command.upgrade`` — the second loses with an Alembic
    exception, the container restarts, the operator sees a flap. The
    advisory lock serialises bootstrap so only one container runs the
    stamp+upgrade at a time. SQLite (used by tests) silently skips this.

    Returns a context-manager-like object: caller must call ``release()``
    when done. Designed as a no-op fallback on non-Postgres engines.
    """
    from contextlib import contextmanager

    @contextmanager
    def _noop():
        yield

    if not str(engine.url).startswith("postgresql"):
        return _noop()

    @contextmanager
    def _pg_lock():
        # AUTOCOMMIT isolation makes the lock acquire/release run outside
        # an implicit transaction, so the lock is visible to other
        # sessions immediately and there is no chance of the unlock
        # being rolled back if the underlying connection has an
        # uncommitted error state. SQLAlchemy 2.x exposes this via
        # ``execution_options``.
        with engine.connect() as conn:
            conn = conn.execution_options(isolation_level="AUTOCOMMIT")
            conn.execute(text("SELECT pg_advisory_lock(:k)"), {"k": lock_id})
            try:
                yield
            finally:
                conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": lock_id})

    return _pg_lock()


def main() -> None:
    # Lazy-imported so SECRET_KEY / DATABASE_URL guards in app.* fire here
    # too — the script is the first thing in the container's lifecycle to
    # touch the DB, so this is also a useful early sanity check.
    from app.database import engine  # noqa: E402
    from app.models import Base  # noqa: E402

    # Serialise the stamp+upgrade behind a Postgres advisory lock so two
    # containers booting in parallel don't race each other. SQLite no-op.
    with _acquire_postgres_advisory_lock(engine):
        print("[bootstrap_db] Ensuring all tables exist via create_all...", flush=True)
        Base.metadata.create_all(bind=engine)

        cfg = Config(str(ALEMBIC_INI))
        # Forward DATABASE_URL into Alembic's env.py via env var; alembic.ini
        # uses sqlalchemy.url=${DATABASE_URL} pattern.
        if os.getenv("DATABASE_URL"):
            cfg.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])

        if _alembic_version_is_empty(engine):
            print(
                f"[bootstrap_db] alembic_version is empty — stamping to baseline "
                f"{BASELINE_REVISION} (DB was bootstrapped via create_all).",
                flush=True,
            )
            command.stamp(cfg, BASELINE_REVISION)

        print("[bootstrap_db] Running alembic upgrade head...", flush=True)
        command.upgrade(cfg, "head")
        print("[bootstrap_db] Schema reconciliation complete.", flush=True)


if __name__ == "__main__":
    main()
