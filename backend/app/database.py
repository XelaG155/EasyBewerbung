import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Base

# Load environment variables early so DATABASE_URL is honored in all entrypoints
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")

# SQLite in-memory cannot share state across threads, so we keep its tiny
# default pool. For Postgres we tune pool_size / max_overflow / pool_pre_ping
# to survive the production worker fleet (2 backend uvicorn × ~10 sessions
# + 4 celery worker slots × peak ~5 sessions each); the default pool_size=5
# was getting saturated under load and producing connection-timeout spikes.
_is_sqlite = DATABASE_URL.startswith("sqlite")
if _is_sqlite:
    engine = create_engine(DATABASE_URL)
else:
    engine = create_engine(
        DATABASE_URL,
        # 10 long-lived connections per process, 20 burst overflow for spikes.
        pool_size=10,
        max_overflow=20,
        # Recycle connections older than 30 minutes — Postgres idle-in-tx
        # timeouts and PgBouncer in transaction-pooling mode both prefer
        # short-lived connections.
        pool_recycle=1800,
        # Cheap SELECT 1 before each checkout: catches connections killed
        # by Postgres restart, idle timeouts, or network blips so the worker
        # doesn't surface a confusing "server closed the connection" 500.
        pool_pre_ping=True,
    )
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    """Create database tables and seed required data if missing.

    Notes on the 2026-04-05 admin-forms refactor:
    ``Base.metadata.create_all`` creates the new ``document_types`` and
    ``llm_models`` tables automatically because their SQLAlchemy models are
    part of ``Base``. However, the production deploy pipeline does **not**
    run Alembic (CMD is ``uvicorn``). This function therefore also seeds
    the new tables on first boot so the refactor ships without manual
    steps. Idempotent: only runs when each table is empty.
    """
    import logging
    from app.models import DocumentTemplate, DocumentType, LanguageSetting, LlmModel
    from app.language_catalog import LANGUAGE_OPTIONS

    logger = logging.getLogger(__name__)

    # Create all tables
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created/verified")

    # Seed data if missing
    db = SessionLocal()
    try:
        # Seed languages if empty
        if db.query(LanguageSetting).count() == 0:
            logger.info("Seeding language settings...")
            for idx, lang in enumerate(LANGUAGE_OPTIONS):
                setting = LanguageSetting(
                    code=lang.code,
                    label=lang.label,
                    direction=lang.direction,
                    is_active=True,
                    sort_order=idx + 1,
                )
                db.add(setting)
            db.commit()
            logger.info(f"Seeded {len(LANGUAGE_OPTIONS)} languages")

        # Seed document_types + llm_models if empty (post-refactor catalog).
        try:
            from app.seed_catalog_to_db import (
                seed_document_types,
                seed_llm_models,
            )

            if db.query(DocumentType).count() == 0:
                logger.info("Seeding document_types from static catalog...")
                dt_result = seed_document_types(db, force_update=False)
                logger.info(f"Seeded document_types: {dt_result}")

            if db.query(LlmModel).count() == 0:
                logger.info("Seeding llm_models from static list...")
                lm_result = seed_llm_models(db, force_update=False)
                logger.info(f"Seeded llm_models: {lm_result}")
        except Exception as e:  # noqa: BLE001 — boot must not crash
            logger.warning(f"Could not seed document_types/llm_models: {e}")

        # Seed document templates if empty (legacy prompt seed).
        if db.query(DocumentTemplate).count() == 0:
            logger.info("Seeding document templates...")
            try:
                from app.seed_document_templates import seed_document_templates
                result = seed_document_templates(db, force_update=False)
                logger.info(f"Seeded document templates: {result}")
            except Exception as e:
                logger.warning(f"Could not seed document templates: {e}")

    except Exception as e:
        logger.error(f"Error during database initialization: {e}")
        db.rollback()
    finally:
        db.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
