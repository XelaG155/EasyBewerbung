"""
Database initialization script.

This script runs automatically on application startup to ensure:
1. All database tables exist
2. Required seed data is present (languages, document templates)

Safe to run multiple times - only creates data if missing.
"""

import logging
from sqlalchemy.orm import Session

from app.database import engine, SessionLocal
from app.models import Base, LanguageSetting, DocumentTemplate
from app.language_catalog import LANGUAGE_OPTIONS

logger = logging.getLogger(__name__)


def init_database():
    """Initialize database with tables and seed data."""
    logger.info("Initializing database...")

    # Create all tables
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created/verified")

    # Seed data
    db = SessionLocal()
    try:
        seed_languages(db)
        seed_document_templates(db)
        db.commit()
        logger.info("Database initialization complete")
    except Exception as e:
        logger.error(f"Error during database initialization: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def seed_languages(db: Session):
    """Seed language settings if table is empty."""
    count = db.query(LanguageSetting).count()
    if count > 0:
        logger.info(f"Language settings already seeded ({count} languages)")
        return

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

    db.flush()
    logger.info(f"Seeded {len(LANGUAGE_OPTIONS)} languages")


def seed_document_templates(db: Session):
    """Seed document templates if table is empty."""
    count = db.query(DocumentTemplate).count()
    if count > 0:
        logger.info(f"Document templates already seeded ({count} templates)")
        return

    logger.info("Seeding document templates...")
    try:
        from app.seed_document_templates import seed_document_templates as do_seed
        result = do_seed(db, force_update=False)
        logger.info(f"Seeded document templates: {result}")
    except Exception as e:
        logger.error(f"Error seeding document templates: {e}")
        # Don't fail startup if template seeding fails
        # Templates can be seeded later via admin endpoint


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    init_database()
