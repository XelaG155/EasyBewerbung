"""Admin CRUD endpoints for ``document_types`` and ``llm_models``.

These endpoints let an admin manage the document catalog and the list of
available LLM models from the UI, without a code change / deploy. They
replace the hard-coded data in ``app/document_catalog.py`` and the frontend
``availableModels`` dict.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.api.endpoints.admin import get_admin_user
from app.api.endpoints.users import record_activity
from app.auth import get_current_user
from app.database import get_db
from app.limiter import limiter
from app.models import DocumentTemplate, DocumentType, LlmModel, User
from app.seed_catalog_to_db import seed_document_types, seed_llm_models

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

VALID_CATEGORIES = {"essential_pack", "high_impact_addons", "premium_documents"}
VALID_PROVIDERS = {"openai", "anthropic", "google"}

# ---------------------------------------------------------------------------
# Prompt preview (dry-run) — sample values used for admin preview only.
# Kept here as constants so the test suite can import and assert on them.
# ---------------------------------------------------------------------------

PREVIEW_SAMPLE_VALUES: dict[str, str] = {
    "{language}": "Deutsch (Schweiz)",
    "{documentation_language}": "Deutsch (Schweiz)",
    "{company_profile_language}": "Deutsch (Schweiz)",
    "{role}": "[Beispiel] ATS-optimized professional CV writer",
    "{task}": "[Beispiel] Create a tailored CV that aligns with the job posting",
    "{instructions}": (
        "[Beispiel] 1. Be completely honest\n"
        "2. Only use information that exists in the CV\n"
        "3. Optimize for the specific job requirements"
    ),
    "{doc_type}": "tailored_cv_pdf",
    "{doc_type_display}": "Lebenslauf",
    "{job_description}": (
        "[Beispiel] Stellenausschreibung: Software Engineer bei ACME AG in Zürich. "
        "Erfahrung mit Python, FastAPI und PostgreSQL. Englisch und Deutsch fliessend."
    ),
    "{cv_text}": (
        "[Beispiel] Max Mustermann, geboren 1990 in Zürich. "
        "5 Jahre Berufserfahrung als Backend-Entwickler bei zwei KMU."
    ),
    "{cv_summary}": (
        "[Beispiel] Backend-Entwickler mit Python/FastAPI-Fokus, 5 Jahre Praxis, "
        "solide PostgreSQL-Kenntnisse."
    ),
    "{reference_letters}": "[Beispiel] Keine Referenzschreiben hochgeladen.",
}


_PLACEHOLDER_RE = re.compile(r"\{[a-z_][a-z0-9_]*\}")


def render_preview(prompt_template: str) -> tuple[str, list[str]]:
    """Substitute known placeholders with sample values.

    Returns the rendered prompt and a list of placeholders that could not be
    resolved, so the admin sees immediately if their prompt uses a name that
    does not exist at runtime.
    """
    rendered = prompt_template or ""
    for key, value in PREVIEW_SAMPLE_VALUES.items():
        rendered = rendered.replace(key, value)

    unresolved = sorted(set(_PLACEHOLDER_RE.findall(rendered)))
    return rendered, unresolved


def _parse_outputs(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if isinstance(parsed, list):
        return [str(x) for x in parsed]
    return []


def _serialize_document_type(row: DocumentType) -> dict:
    return {
        "id": row.id,
        "key": row.key,
        "title": row.title,
        "description": row.description,
        "notes": row.notes,
        "outputs": _parse_outputs(row.outputs),
        "category": row.category,
        "sort_order": row.sort_order,
        "is_active": row.is_active,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _serialize_llm_model(row: LlmModel) -> dict:
    return {
        "id": row.id,
        "provider": row.provider,
        "model_id": row.model_id,
        "display_name": row.display_name,
        "context_window": row.context_window,
        "notes": row.notes,
        "sort_order": row.sort_order,
        "is_active": row.is_active,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


# ---------------------------------------------------------------------------
# DocumentType schemas
# ---------------------------------------------------------------------------


class DocumentTypeBase(BaseModel):
    key: str = Field(min_length=2, max_length=64, pattern=r"^[a-z][a-z0-9_]*$")
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    notes: Optional[str] = None
    outputs: List[str] = Field(default_factory=list)
    category: str = "essential_pack"
    sort_order: int = 0
    is_active: bool = True

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str) -> str:
        if value not in VALID_CATEGORIES:
            raise ValueError(
                f"category muss einer von {sorted(VALID_CATEGORIES)} sein"
            )
        return value


class DocumentTypeCreate(DocumentTypeBase):
    # When True (default) the endpoint also creates a draft DocumentTemplate
    # for this key so the admin can immediately open the drawer and configure
    # LLM / prompt. Set to False only for import scripts that will create
    # templates separately.
    create_draft_template: bool = True


class DocumentTypeUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    notes: Optional[str] = None
    outputs: Optional[List[str]] = None
    category: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        if value not in VALID_CATEGORIES:
            raise ValueError(
                f"category muss einer von {sorted(VALID_CATEGORIES)} sein"
            )
        return value


# ---------------------------------------------------------------------------
# LlmModel schemas
# ---------------------------------------------------------------------------


class LlmModelBase(BaseModel):
    provider: str
    model_id: str = Field(min_length=1, max_length=128)
    display_name: str = Field(min_length=1, max_length=128)
    context_window: Optional[int] = Field(default=None, ge=0)
    notes: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, value: str) -> str:
        if value not in VALID_PROVIDERS:
            raise ValueError(
                f"provider muss einer von {sorted(VALID_PROVIDERS)} sein"
            )
        return value


class LlmModelCreate(LlmModelBase):
    pass


class LlmModelUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, min_length=1, max_length=128)
    context_window: Optional[int] = Field(default=None, ge=0)
    notes: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


# ---------------------------------------------------------------------------
# DocumentType endpoints
# ---------------------------------------------------------------------------

document_types_router = APIRouter()


@document_types_router.get("/")
@limiter.limit("60/minute")
async def list_document_types(
    request: Request,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """List all document types.

    Available to any authenticated user so that non-admin pages (e.g. the
    document-picker on the user dashboard) can populate their lists. Inactive
    entries are hidden unless explicitly requested by an admin.
    """
    query = db.query(DocumentType).order_by(
        DocumentType.category, DocumentType.sort_order, DocumentType.title
    )
    if include_inactive:
        if not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Nur Administratoren dürfen inaktive Typen sehen.",
            )
    else:
        query = query.filter(DocumentType.is_active.is_(True))

    return [_serialize_document_type(row) for row in query.all()]


DRAFT_PROMPT_TEMPLATE = (
    "[ENTWURF] Bitte anpassen.\n\n"
    "Du bist ein professioneller Autor für Bewerbungsdokumente.\n"
    "Sprache: {language}\n"
    "Dokumenttyp: {doc_type_display}\n\n"
    "Berücksichtige die folgende Stellenausschreibung:\n{job_description}\n\n"
    "Und die folgende Lebenslauf-Zusammenfassung:\n{cv_summary}\n\n"
    "Erstelle ein klares, professionelles {doc_type_display} auf {language}."
)


@document_types_router.post("/", status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def create_document_type(
    payload: DocumentTypeCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
) -> dict:
    existing = db.query(DocumentType).filter(DocumentType.key == payload.key).first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Es existiert bereits ein Dokumenttyp mit key '{payload.key}'.",
        )

    now = datetime.now(timezone.utc)
    row = DocumentType(
        key=payload.key,
        title=payload.title,
        description=payload.description,
        notes=payload.notes,
        outputs=json.dumps(payload.outputs),
        category=payload.category,
        sort_order=payload.sort_order,
        is_active=payload.is_active,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.flush()  # populate row.id before creating the draft template

    draft_template_id: int | None = None
    if payload.create_draft_template:
        existing_template = (
            db.query(DocumentTemplate)
            .filter(DocumentTemplate.doc_type == payload.key)
            .first()
        )
        if existing_template is None:
            draft = DocumentTemplate(
                doc_type=payload.key,
                display_name=payload.title,
                credit_cost=1,
                language_source="documentation_language",
                llm_provider="openai",
                llm_model="gpt-4o",
                prompt_template=DRAFT_PROMPT_TEMPLATE,
                is_active=False,  # draft: admin opens it, edits prompt, then activates
                created_at=now,
                updated_at=now,
            )
            db.add(draft)
            db.flush()
            draft_template_id = draft.id

    db.commit()
    db.refresh(row)

    record_activity(
        db,
        admin,
        "admin_document_type_create",
        request=request,
        metadata=json.dumps(
            {
                "key": row.key,
                "title": row.title,
                "draft_template_id": draft_template_id,
            }
        ),
    )
    logger.info(
        "Admin %d created DocumentType %s (draft template id=%s)",
        admin.id,
        row.key,
        draft_template_id,
    )
    result = _serialize_document_type(row)
    result["draft_template_id"] = draft_template_id
    return result


@document_types_router.put("/{document_type_id}")
@limiter.limit("30/minute")
async def update_document_type(
    document_type_id: int,
    payload: DocumentTypeUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
) -> dict:
    row = (
        db.query(DocumentType)
        .filter(DocumentType.id == document_type_id)
        .first()
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dokumenttyp nicht gefunden.",
        )

    update_data = payload.model_dump(exclude_unset=True)
    # outputs is a non-nullable JSON string column. Drop explicit-None payloads
    # so a client sending {"outputs": null} does not violate the NOT NULL
    # constraint. Serialize valid lists to JSON before assignment.
    if "outputs" in update_data:
        if update_data["outputs"] is None:
            del update_data["outputs"]
        else:
            update_data["outputs"] = json.dumps(update_data["outputs"])

    for field, value in update_data.items():
        setattr(row, field, value)
    row.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(row)

    record_activity(
        db,
        admin,
        "admin_document_type_update",
        request=request,
        metadata=json.dumps({"id": row.id, "key": row.key, "fields": list(update_data.keys())}),
    )
    logger.info("Admin %d updated DocumentType %s", admin.id, row.key)
    return _serialize_document_type(row)


@document_types_router.delete("/{document_type_id}")
@limiter.limit("20/minute")
async def delete_document_type(
    document_type_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
) -> dict:
    row = (
        db.query(DocumentType)
        .filter(DocumentType.id == document_type_id)
        .first()
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dokumenttyp nicht gefunden.",
        )

    # Refuse to orphan any DocumentTemplate referencing this key. There is no
    # real foreign key in the DB (doc_type is a string), so this is enforced
    # in application code.
    referencing = (
        db.query(DocumentTemplate)
        .filter(DocumentTemplate.doc_type == row.key)
        .count()
    )
    if referencing > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Dokumenttyp '{row.key}' wird noch von {referencing} "
                "Template(s) referenziert. Lösche oder verschiebe zuerst "
                "die Templates, dann kann der Typ entfernt werden."
            ),
        )

    key = row.key
    db.delete(row)
    db.commit()

    record_activity(
        db,
        admin,
        "admin_document_type_delete",
        request=request,
        metadata=json.dumps({"id": document_type_id, "key": key}),
    )
    logger.info("Admin %d deleted DocumentType %s", admin.id, key)
    return {"message": "Dokumenttyp gelöscht.", "key": key}


# ---------------------------------------------------------------------------
# LlmModel endpoints
# ---------------------------------------------------------------------------

llm_models_router = APIRouter()


@llm_models_router.get("/")
@limiter.limit("60/minute")
async def list_llm_models(
    request: Request,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """List all LLM models.

    Any authenticated user can read this so the admin template editor can
    populate the model dropdown without requiring full admin rights on every
    call.
    """
    query = db.query(LlmModel).order_by(
        LlmModel.provider, LlmModel.sort_order, LlmModel.display_name
    )
    if include_inactive:
        if not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Nur Administratoren dürfen inaktive Modelle sehen.",
            )
    else:
        query = query.filter(LlmModel.is_active.is_(True))

    return [_serialize_llm_model(row) for row in query.all()]


@llm_models_router.post("/", status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def create_llm_model(
    payload: LlmModelCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
) -> dict:
    existing = (
        db.query(LlmModel)
        .filter(
            LlmModel.provider == payload.provider,
            LlmModel.model_id == payload.model_id,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Modell '{payload.model_id}' für Provider '{payload.provider}' "
                "existiert bereits."
            ),
        )

    now = datetime.now(timezone.utc)
    row = LlmModel(
        provider=payload.provider,
        model_id=payload.model_id,
        display_name=payload.display_name,
        context_window=payload.context_window,
        notes=payload.notes,
        sort_order=payload.sort_order,
        is_active=payload.is_active,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    record_activity(
        db,
        admin,
        "admin_llm_model_create",
        request=request,
        metadata=json.dumps({"provider": row.provider, "model_id": row.model_id}),
    )
    logger.info("Admin %d created LlmModel %s/%s", admin.id, row.provider, row.model_id)
    return _serialize_llm_model(row)


@llm_models_router.put("/{llm_model_id}")
@limiter.limit("30/minute")
async def update_llm_model(
    llm_model_id: int,
    payload: LlmModelUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
) -> dict:
    row = db.query(LlmModel).filter(LlmModel.id == llm_model_id).first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="LLM-Modell nicht gefunden.",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(row, field, value)
    row.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(row)

    record_activity(
        db,
        admin,
        "admin_llm_model_update",
        request=request,
        metadata=json.dumps(
            {
                "id": row.id,
                "provider": row.provider,
                "model_id": row.model_id,
                "fields": list(update_data.keys()),
            }
        ),
    )
    logger.info(
        "Admin %d updated LlmModel %s/%s", admin.id, row.provider, row.model_id
    )
    return _serialize_llm_model(row)


@llm_models_router.delete("/{llm_model_id}")
@limiter.limit("20/minute")
async def delete_llm_model(
    llm_model_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
) -> dict:
    row = db.query(LlmModel).filter(LlmModel.id == llm_model_id).first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="LLM-Modell nicht gefunden.",
        )

    # Refuse to remove a model that templates still reference, otherwise the
    # next generation against those templates would fail at the LLM call.
    referencing = (
        db.query(DocumentTemplate)
        .filter(
            DocumentTemplate.llm_provider == row.provider,
            DocumentTemplate.llm_model == row.model_id,
        )
        .count()
    )
    if referencing > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Modell '{row.provider}/{row.model_id}' wird noch von "
                f"{referencing} Template(s) genutzt. Bitte zuerst die "
                "Templates auf ein anderes Modell umstellen."
            ),
        )

    provider = row.provider
    model_id = row.model_id
    db.delete(row)
    db.commit()

    record_activity(
        db,
        admin,
        "admin_llm_model_delete",
        request=request,
        metadata=json.dumps(
            {"id": llm_model_id, "provider": provider, "model_id": model_id}
        ),
    )
    logger.info("Admin %d deleted LlmModel %s/%s", admin.id, provider, model_id)
    return {"message": "LLM-Modell gelöscht.", "provider": provider, "model_id": model_id}


# ---------------------------------------------------------------------------
# Prompt preview endpoint (dry-run, no LLM call)
# ---------------------------------------------------------------------------


class PromptPreviewRequest(BaseModel):
    """Body for the prompt preview endpoint.

    ``prompt_template`` is optional — if omitted, the saved template prompt
    is used instead. This lets the admin preview both the saved state and
    unsaved edits from the drawer.
    """

    prompt_template: Optional[str] = None


@router.post("/admin/document-templates/{template_id}/preview")
@limiter.limit("30/minute")
async def preview_document_template_prompt(
    template_id: int,
    payload: PromptPreviewRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
) -> dict:
    """Render the template prompt with sample placeholder values.

    This does **not** call an LLM — it's a dry-run that only substitutes
    known placeholders with example strings so the admin can validate the
    prompt structure before saving.
    """
    template = (
        db.query(DocumentTemplate)
        .filter(DocumentTemplate.id == template_id)
        .first()
    )
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template nicht gefunden.",
        )

    source_prompt = payload.prompt_template or template.prompt_template or ""
    rendered, unresolved = render_preview(source_prompt)

    return {
        "template_id": template.id,
        "doc_type": template.doc_type,
        "source_length": len(source_prompt),
        "rendered_length": len(rendered),
        "rendered_prompt": rendered,
        "unresolved_placeholders": unresolved,
        "sample_values": PREVIEW_SAMPLE_VALUES,
    }


# ---------------------------------------------------------------------------
# Seed endpoint (admin only, used by the UI "Seed Catalog" button)
# ---------------------------------------------------------------------------


@router.post("/admin/catalog/seed")
@limiter.limit("5/minute")
async def seed_catalog_endpoint(
    request: Request,
    force_update: bool = False,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
) -> dict:
    """Run the catalog seeder from the admin UI."""
    dt = seed_document_types(db, force_update=force_update)
    lm = seed_llm_models(db, force_update=force_update)

    record_activity(
        db,
        admin,
        "admin_catalog_seed",
        request=request,
        metadata=json.dumps({"force_update": force_update, "document_types": dt, "llm_models": lm}),
    )
    logger.info(
        "Admin %s seeded catalog (force=%s): document_types=%s llm_models=%s",
        admin.email,
        force_update,
        dt,
        lm,
    )

    return {"document_types": dt, "llm_models": lm}
