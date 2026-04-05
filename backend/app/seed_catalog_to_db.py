"""Seed script for the new ``document_types`` and ``llm_models`` tables.

Copies:
- the hard-coded catalog from ``app.document_catalog`` into ``document_types``;
- the LLM model list previously held in
  ``frontend/app/admin/documents/page.tsx`` into ``llm_models``.

Idempotent: running it multiple times updates existing rows (when
``force_update`` is set) or skips them.

Usage::

    cd backend
    python -m app.seed_catalog_to_db               # create only
    python -m app.seed_catalog_to_db --force-update  # overwrite existing
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Iterable

from sqlalchemy.orm import Session

from app.database import SessionLocal, init_db
from app.document_catalog import (
    ESSENTIAL_PACK,
    HIGH_IMPACT_ADDONS,
    PREMIUM_DOCUMENTS,
)
from app.models import DocumentType, LlmModel


# ---------------------------------------------------------------------------
# Document type seed
# ---------------------------------------------------------------------------

def _iter_catalog_items() -> Iterable[tuple[str, dict, int]]:
    """Yield ``(category, item, sort_order)`` tuples for every catalog item."""
    for sort_order, item in enumerate(ESSENTIAL_PACK):
        yield "essential_pack", item, sort_order
    for sort_order, item in enumerate(HIGH_IMPACT_ADDONS):
        yield "high_impact_addons", item, sort_order
    for sort_order, item in enumerate(PREMIUM_DOCUMENTS):
        yield "premium_documents", item, sort_order


def seed_document_types(db: Session, force_update: bool = False) -> dict:
    """Copy the static catalog into the ``document_types`` table."""
    created = 0
    updated = 0
    skipped = 0
    now = datetime.now(timezone.utc)

    for category, item, sort_order in _iter_catalog_items():
        key = item["key"]
        existing = db.query(DocumentType).filter(DocumentType.key == key).first()

        if existing is None:
            db.add(
                DocumentType(
                    key=key,
                    title=item["title"],
                    description=item.get("description"),
                    notes=item.get("notes"),
                    outputs=json.dumps(item.get("outputs", [])),
                    category=category,
                    sort_order=sort_order,
                    is_active=True,
                    created_at=now,
                    updated_at=now,
                )
            )
            created += 1
            continue

        if not force_update:
            skipped += 1
            continue

        existing.title = item["title"]
        existing.description = item.get("description")
        existing.notes = item.get("notes")
        existing.outputs = json.dumps(item.get("outputs", []))
        existing.category = category
        existing.sort_order = sort_order
        existing.updated_at = now
        updated += 1

    db.commit()
    return {"created": created, "updated": updated, "skipped": skipped}


# ---------------------------------------------------------------------------
# LLM model seed
# ---------------------------------------------------------------------------

# Matches the hard-coded list previously in frontend/app/admin/documents/page.tsx
# as of 2026-04-05. Kept here as the one canonical source. Admins can edit /
# add / disable models through the admin UI from now on.
LLM_MODEL_SEED: list[dict] = [
    # OpenAI — GPT-5.2 (latest)
    {"provider": "openai", "model_id": "gpt-5.2", "display_name": "GPT-5.2"},
    {"provider": "openai", "model_id": "gpt-5.2-pro", "display_name": "GPT-5.2 Pro"},
    {"provider": "openai", "model_id": "gpt-5.2-mini", "display_name": "GPT-5.2 Mini"},
    {"provider": "openai", "model_id": "gpt-5.2-nano", "display_name": "GPT-5.2 Nano"},
    # OpenAI — GPT-5.1
    {"provider": "openai", "model_id": "gpt-5.1", "display_name": "GPT-5.1"},
    {"provider": "openai", "model_id": "gpt-5.1-mini", "display_name": "GPT-5.1 Mini"},
    # OpenAI — GPT-5 base
    {"provider": "openai", "model_id": "gpt-5", "display_name": "GPT-5"},
    {"provider": "openai", "model_id": "gpt-5-mini", "display_name": "GPT-5 Mini"},
    # OpenAI — GPT-4o (multimodal)
    {"provider": "openai", "model_id": "gpt-4o", "display_name": "GPT-4o"},
    {"provider": "openai", "model_id": "gpt-4o-mini", "display_name": "GPT-4o Mini"},

    # Anthropic — Claude 4.5 (latest)
    {
        "provider": "anthropic",
        "model_id": "claude-opus-4-5-20251101",
        "display_name": "Claude Opus 4.5",
    },
    {
        "provider": "anthropic",
        "model_id": "claude-sonnet-4-5-20250929",
        "display_name": "Claude Sonnet 4.5",
    },
    {
        "provider": "anthropic",
        "model_id": "claude-haiku-4-5-20251001",
        "display_name": "Claude Haiku 4.5",
    },
    # Anthropic — Claude 4.1
    {
        "provider": "anthropic",
        "model_id": "claude-opus-4-1-20250805",
        "display_name": "Claude Opus 4.1",
    },
    # Anthropic — Claude 3.5
    {
        "provider": "anthropic",
        "model_id": "claude-3-5-sonnet-20241022",
        "display_name": "Claude 3.5 Sonnet",
    },
    {
        "provider": "anthropic",
        "model_id": "claude-3-5-haiku-20241022",
        "display_name": "Claude 3.5 Haiku",
    },
    # Anthropic — Claude 3 (legacy)
    {
        "provider": "anthropic",
        "model_id": "claude-3-opus-20240229",
        "display_name": "Claude 3 Opus",
    },

    # Google — Gemini 3 (latest preview)
    {
        "provider": "google",
        "model_id": "gemini-3-pro-preview",
        "display_name": "Gemini 3 Pro (Preview)",
    },
    # Google — Gemini 2.5
    {"provider": "google", "model_id": "gemini-2.5-pro", "display_name": "Gemini 2.5 Pro"},
    {
        "provider": "google",
        "model_id": "gemini-2.5-flash",
        "display_name": "Gemini 2.5 Flash",
    },
    {
        "provider": "google",
        "model_id": "gemini-2.5-flash-lite",
        "display_name": "Gemini 2.5 Flash Lite",
    },
    # Google — Gemini 2.0
    {
        "provider": "google",
        "model_id": "gemini-2.0-flash-exp",
        "display_name": "Gemini 2.0 Flash (Experimental)",
    },
    {
        "provider": "google",
        "model_id": "gemini-2.0-flash",
        "display_name": "Gemini 2.0 Flash",
    },
    # Google — Gemini 1.5 (legacy)
    {
        "provider": "google",
        "model_id": "gemini-1.5-pro",
        "display_name": "Gemini 1.5 Pro",
    },
    {
        "provider": "google",
        "model_id": "gemini-1.5-flash",
        "display_name": "Gemini 1.5 Flash",
    },
]


def seed_llm_models(db: Session, force_update: bool = False) -> dict:
    """Populate the ``llm_models`` table with the canonical seed list."""
    created = 0
    updated = 0
    skipped = 0
    now = datetime.now(timezone.utc)

    for sort_order, entry in enumerate(LLM_MODEL_SEED):
        existing = (
            db.query(LlmModel)
            .filter(
                LlmModel.provider == entry["provider"],
                LlmModel.model_id == entry["model_id"],
            )
            .first()
        )

        if existing is None:
            db.add(
                LlmModel(
                    provider=entry["provider"],
                    model_id=entry["model_id"],
                    display_name=entry["display_name"],
                    context_window=entry.get("context_window"),
                    notes=entry.get("notes"),
                    sort_order=sort_order,
                    is_active=True,
                    created_at=now,
                    updated_at=now,
                )
            )
            created += 1
            continue

        if not force_update:
            skipped += 1
            continue

        existing.display_name = entry["display_name"]
        existing.context_window = entry.get("context_window")
        existing.notes = entry.get("notes")
        existing.sort_order = sort_order
        existing.updated_at = now
        updated += 1

    db.commit()
    return {"created": created, "updated": updated, "skipped": skipped}


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--force-update",
        action="store_true",
        help="Overwrite existing rows with the seed data.",
    )
    args = parser.parse_args()

    init_db()
    db = SessionLocal()
    try:
        print("Seeding document_types...")
        dt_result = seed_document_types(db, force_update=args.force_update)
        print(
            f"  created={dt_result['created']} updated={dt_result['updated']} "
            f"skipped={dt_result['skipped']}"
        )

        print("Seeding llm_models...")
        lm_result = seed_llm_models(db, force_update=args.force_update)
        print(
            f"  created={lm_result['created']} updated={lm_result['updated']} "
            f"skipped={lm_result['skipped']}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
