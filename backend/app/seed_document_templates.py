"""Seed script to populate document_templates table from document_catalog and document_prompts.

Usage:
    cd backend
    python -m app.seed_document_templates
"""
import json
import os
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.database import SessionLocal, init_db
from app.models import DocumentTemplate
from app.document_catalog import ESSENTIAL_PACK, HIGH_IMPACT_ADDONS, PREMIUM_DOCUMENTS


def load_prompts() -> dict:
    """Load prompt templates from JSON file."""
    prompts_file = os.path.join(os.path.dirname(__file__), "document_prompts.json")
    with open(prompts_file, "r", encoding="utf-8") as f:
        return json.load(f)


def get_all_document_types() -> list:
    """Get all document types from catalog with display names."""
    all_docs = []
    for doc in ESSENTIAL_PACK:
        all_docs.append({
            "key": doc["key"],
            "title": doc["title"],
            "category": "essential_pack"
        })
    for doc in HIGH_IMPACT_ADDONS:
        all_docs.append({
            "key": doc["key"],
            "title": doc["title"],
            "category": "high_impact_addons"
        })
    for doc in PREMIUM_DOCUMENTS:
        all_docs.append({
            "key": doc["key"],
            "title": doc["title"],
            "category": "premium_documents"
        })
    return all_docs


def seed_document_templates(db: Session, force_update: bool = False) -> dict:
    """
    Seed document templates from catalog and prompts.

    Args:
        db: Database session
        force_update: If True, update existing templates with new data

    Returns:
        dict with counts of created, updated, and skipped templates
    """
    prompts = load_prompts()
    doc_types = get_all_document_types()

    created = 0
    updated = 0
    skipped = 0

    for doc in doc_types:
        doc_key = doc["key"]
        display_name = doc["title"]

        # Get prompt template from JSON
        prompt_config = prompts.get(doc_key, {})
        prompt_template_text = prompt_config.get("prompt_template", "")

        if not prompt_template_text:
            print(f"Warning: No prompt template found for {doc_key}, skipping...")
            skipped += 1
            continue

        # Check if template already exists
        existing = db.query(DocumentTemplate).filter(
            DocumentTemplate.doc_type == doc_key
        ).first()

        if existing:
            if force_update:
                # Update existing template
                existing.display_name = display_name
                existing.prompt_template = prompt_template_text
                existing.updated_at = datetime.now(timezone.utc)
                updated += 1
                print(f"Updated: {doc_key}")
            else:
                skipped += 1
                print(f"Skipped (exists): {doc_key}")
            continue

        # Create new template
        template = DocumentTemplate(
            doc_type=doc_key,
            display_name=display_name,
            credit_cost=1,  # Default cost
            language_source="documentation_language",  # Default language source
            llm_provider="openai",  # Default provider
            llm_model="gpt-4",  # Default model
            prompt_template=prompt_template_text,
            is_active=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(template)
        created += 1
        print(f"Created: {doc_key}")

    db.commit()

    return {
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "total": len(doc_types)
    }


def main():
    """Main entry point for seed script."""
    import argparse

    parser = argparse.ArgumentParser(description="Seed document templates from catalog and prompts")
    parser.add_argument(
        "--force-update",
        action="store_true",
        help="Update existing templates with new data from JSON"
    )
    args = parser.parse_args()

    # Initialize database
    init_db()

    # Create session and seed data
    db = SessionLocal()
    try:
        print("Seeding document templates...")
        result = seed_document_templates(db, force_update=args.force_update)
        print(f"\nSeed complete:")
        print(f"  Created: {result['created']}")
        print(f"  Updated: {result['updated']}")
        print(f"  Skipped: {result['skipped']}")
        print(f"  Total: {result['total']}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
