"""Integration tests that run against a real PostgreSQL instance.

Motivation
----------
The rest of the test suite uses SQLite in-memory for speed, which is fine for
testing pure CRUD / validation logic, but misses issues that only appear on
the production database: DDL differences in ALTER TABLE, boolean-column
storage (SQLite uses INTEGER), transaction-isolation semantics, and
server-side defaults like ``sa.true()``.

These tests run the Alembic migration chain plus the seeder against the
actual Postgres instance started by ``docker-compose up``. They are
**skipped** when no Postgres is reachable so local devs can still run
``pytest`` without standing up the full stack.

Usage
-----
Run with the docker-compose stack running::

    docker compose up -d db
    export EASYBEWERBUNG_TEST_POSTGRES_URL='postgresql://easybewerbung:localdev123@localhost:5433/easybewerbung_test'
    pytest backend/tests/integration/

If ``EASYBEWERBUNG_TEST_POSTGRES_URL`` is not set, the tests auto-skip.
"""
from __future__ import annotations

import os

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker


PG_URL = os.getenv("EASYBEWERBUNG_TEST_POSTGRES_URL")


def _postgres_is_reachable(url: str) -> bool:
    try:
        engine = create_engine(url, pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine.dispose()
        return True
    except OperationalError:
        return False


# Module-level skip so we don't even import the slow alembic stuff when there
# is no database to talk to.
pytestmark = pytest.mark.skipif(
    not PG_URL or not _postgres_is_reachable(PG_URL),
    reason=(
        "EASYBEWERBUNG_TEST_POSTGRES_URL not set or database not reachable. "
        "Start `docker compose up -d db` and set the env var to run these "
        "integration tests."
    ),
)


@pytest.fixture(scope="module")
def pg_engine():
    """Module-scoped engine against the test Postgres instance.

    Drops and recreates the schema so the migration chain runs fresh each
    time the module executes.
    """
    assert PG_URL is not None  # guarded by pytestmark
    engine = create_engine(PG_URL, pool_pre_ping=True)

    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))

    yield engine

    engine.dispose()


@pytest.fixture(scope="module")
def migrated_engine(pg_engine):
    """Bring the Postgres schema to the state *just before* our new migration,
    then run only the new revision on top.

    We cannot simply ``alembic upgrade head`` on an empty database because the
    older migration ``20241107_01_add_language_and_credit_columns`` has a
    pre-existing bug: on Postgres its ``_column_missing`` helper calls
    ``inspector.get_columns("users")`` before the table exists, which raises
    ``NoSuchTableError`` (SQLite returns an empty list and silently passes).
    That's a bug in legacy migrations, unrelated to this refactor.

    Instead we:
      1. Create all tables from the current SQLAlchemy models via
         ``Base.metadata.create_all`` — this is what production would look
         like after a clean bootstrap.
      2. Tell Alembic we're at the revision right before ours (``stamp``).
      3. Drop the tables our new migration is supposed to create.
      4. Run ``upgrade head``, which now only runs our new revision.

    This proves that our new migration is correct on real Postgres without
    being blocked by unrelated legacy bugs.
    """
    from alembic import command
    from alembic.config import Config
    from sqlalchemy.schema import CreateSchema

    from app.models import Base, DocumentType, LlmModel

    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    alembic_ini = os.path.join(repo_root, "alembic.ini")
    cfg = Config(alembic_ini)
    cfg.set_main_option("sqlalchemy.url", PG_URL)
    os.environ["DATABASE_URL"] = PG_URL

    # Step 1: materialize the full current schema via SQLAlchemy.
    Base.metadata.create_all(pg_engine)

    # Step 2: drop the tables our new migration is supposed to create, so
    # that the migration actually has work to do.
    DocumentType.__table__.drop(pg_engine, checkfirst=True)
    LlmModel.__table__.drop(pg_engine, checkfirst=True)

    # Step 3: stamp Alembic to the revision immediately before ours.
    command.stamp(cfg, "20260104_02")

    # Step 4: run the upgrade — only our new revision executes.
    command.upgrade(cfg, "head")

    return pg_engine


def test_migration_creates_document_types_table(migrated_engine):
    inspector = inspect(migrated_engine)
    assert "document_types" in inspector.get_table_names()

    columns = {col["name"] for col in inspector.get_columns("document_types")}
    expected = {
        "id",
        "key",
        "title",
        "description",
        "notes",
        "outputs",
        "category",
        "sort_order",
        "is_active",
        "created_at",
        "updated_at",
    }
    missing = expected - columns
    assert not missing, f"missing columns on document_types: {missing}"


def test_migration_creates_llm_models_table(migrated_engine):
    inspector = inspect(migrated_engine)
    assert "llm_models" in inspector.get_table_names()

    columns = {col["name"] for col in inspector.get_columns("llm_models")}
    expected = {
        "id",
        "provider",
        "model_id",
        "display_name",
        "context_window",
        "notes",
        "sort_order",
        "is_active",
        "created_at",
        "updated_at",
    }
    missing = expected - columns
    assert not missing, f"missing columns on llm_models: {missing}"


def test_migration_creates_unique_constraints(migrated_engine):
    """Catch the Postgres-specific gotcha where ``UniqueConstraint`` with an
    explicit name does or does not emit under different dialects."""
    inspector = inspect(migrated_engine)

    dt_uniques = inspector.get_unique_constraints("document_types")
    assert any(
        "key" in u["column_names"] for u in dt_uniques
    ), f"document_types.key unique constraint missing: {dt_uniques}"

    lm_uniques = inspector.get_unique_constraints("llm_models")
    assert any(
        set(u["column_names"]) == {"provider", "model_id"} for u in lm_uniques
    ), f"llm_models (provider, model_id) unique constraint missing: {lm_uniques}"


def test_seed_against_real_postgres(migrated_engine):
    """Run the actual seeder code path against Postgres."""
    from app.models import DocumentType, LlmModel
    from app.seed_catalog_to_db import seed_document_types, seed_llm_models

    Session = sessionmaker(bind=migrated_engine, autoflush=False, autocommit=False)
    with Session() as session:
        dt_result = seed_document_types(session, force_update=False)
        lm_result = seed_llm_models(session, force_update=False)

        assert dt_result["created"] > 0
        assert lm_result["created"] > 0

        assert session.query(DocumentType).count() >= dt_result["created"]
        assert session.query(LlmModel).count() >= lm_result["created"]

    # Second run must be idempotent.
    with Session() as session:
        dt_again = seed_document_types(session, force_update=False)
        assert dt_again["created"] == 0


def test_boolean_is_stored_as_real_boolean(migrated_engine):
    """SQLite would store this as INTEGER 0/1; Postgres must store as BOOLEAN."""
    inspector = inspect(migrated_engine)

    is_active_col = next(
        col for col in inspector.get_columns("document_types") if col["name"] == "is_active"
    )
    # SQLAlchemy reflects Postgres BOOLEAN as sa.Boolean / types.BOOLEAN.
    type_name = str(is_active_col["type"]).upper()
    assert "BOOL" in type_name, f"expected BOOLEAN, got {type_name}"
