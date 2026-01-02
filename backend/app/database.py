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

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    """Create database tables and seed required data if missing."""
    import logging
    from app.models import LanguageSetting, DocumentTemplate
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

        # Seed document templates if empty
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
