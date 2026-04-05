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
from app.services.llm_provider_sync import (
    fetch_all_providers,
    result_to_dict,
)

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

# Per-candidate-input placeholders (job description, CV, etc.) are filled
# with realistic sample values because the real values only exist at
# generation time. The per-doc-type placeholders {role}/{task}/{instructions}
# are NOT listed here — they are resolved from document_prompts.json at
# preview time via _resolve_prompt_components, so the admin sees the actual
# runtime content, not a stub.
PREVIEW_SAMPLE_VALUES: dict[str, str] = {
    "{language}": "Deutsch (Schweiz)",
    "{documentation_language}": "Deutsch (Schweiz)",
    "{company_profile_language}": "Deutsch (Schweiz)",
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


def render_preview(
    prompt_template: str,
    doc_type: str | None = None,
) -> tuple[str, list[str]]:
    """Substitute known placeholders with realistic preview values.

    For ``{role}``, ``{task}`` and ``{instructions}``, the real runtime values
    are resolved from ``document_prompts.json`` via
    ``tasks._resolve_prompt_components`` — so the preview shows what will
    actually be sent to the LLM, not a stub. For candidate-specific
    placeholders (job description, CV text, etc.) we substitute realistic
    sample strings because the real values only exist at generation time.

    Returns the rendered prompt and a list of placeholders that could not be
    resolved, so the admin sees immediately if their prompt uses a name that
    does not exist at runtime.
    """
    rendered = prompt_template or ""

    # Resolve per-doc-type placeholders from the canonical JSON. If no doc_type
    # is provided (e.g. unsaved new template), fall back to the generic values
    # from tasks.py — which is what generation would do anyway.
    if doc_type is not None:
        from app.tasks import _resolve_prompt_components

        role, task, instructions = _resolve_prompt_components(doc_type)
        rendered = rendered.replace("{role}", role)
        rendered = rendered.replace("{task}", task)
        rendered = rendered.replace("{instructions}", instructions)

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
    """Render the template prompt with realistic placeholder values.

    This does **not** call an LLM — it's a dry-run that substitutes:
    - ``{role}``, ``{task}``, ``{instructions}`` with the REAL runtime values
      from ``document_prompts.json`` (resolved via ``_resolve_prompt_components``)
      so the admin sees exactly what the LLM will receive, including the full
      multi-hundred-line instruction block;
    - candidate-specific placeholders (``{job_description}``, ``{cv_text}``,
      etc.) with realistic sample strings because the real values only exist
      at generation time.
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
    rendered, unresolved = render_preview(source_prompt, doc_type=template.doc_type)

    # Also expose the resolved per-doc-type components so the drawer can show
    # them as a separate read-only panel ("These come from document_prompts.json").
    from app.tasks import _resolve_prompt_components

    resolved_role, resolved_task, resolved_instructions = _resolve_prompt_components(
        template.doc_type
    )

    return {
        "template_id": template.id,
        "doc_type": template.doc_type,
        "source_length": len(source_prompt),
        "rendered_length": len(rendered),
        "rendered_prompt": rendered,
        "unresolved_placeholders": unresolved,
        "sample_values": PREVIEW_SAMPLE_VALUES,
        "resolved_components": {
            "role": resolved_role,
            "task": resolved_task,
            "instructions": resolved_instructions,
            "source": "backend/app/document_prompts.json",
        },
    }


# ---------------------------------------------------------------------------
# LLM provider sync: check for deprecated / new models across providers
# ---------------------------------------------------------------------------


class LlmImportItem(BaseModel):
    provider: str
    model_id: str = Field(min_length=1, max_length=128)
    display_name: str = Field(min_length=1, max_length=128)

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, value: str) -> str:
        if value not in VALID_PROVIDERS:
            raise ValueError(
                f"provider muss einer von {sorted(VALID_PROVIDERS)} sein"
            )
        return value


class LlmImportRequest(BaseModel):
    models: list[LlmImportItem]


def _pick_replacement_model(
    deprecated_model: LlmModel,
    live_result_models: set[str],
    db: Session,
) -> Optional[dict]:
    """Suggest a replacement for a deprecated model.

    Strategy: pick the first *active* model from the same provider whose
    ``model_id`` still appears in the provider's live list and which is
    not the deprecated model itself. We use ``sort_order`` so the latest
    (lowest sort_order in our seed ordering) wins.
    """
    candidate = (
        db.query(LlmModel)
        .filter(
            LlmModel.provider == deprecated_model.provider,
            LlmModel.is_active.is_(True),
            LlmModel.id != deprecated_model.id,
        )
        .order_by(LlmModel.sort_order, LlmModel.id)
        .all()
    )
    for row in candidate:
        if row.model_id in live_result_models:
            return {
                "provider": row.provider,
                "model_id": row.model_id,
                "display_name": row.display_name,
            }
    return None


def _referencing_templates(
    provider: str, model_id: str, db: Session
) -> list[dict]:
    rows = (
        db.query(DocumentTemplate)
        .filter(
            DocumentTemplate.llm_provider == provider,
            DocumentTemplate.llm_model == model_id,
        )
        .all()
    )
    return [
        {
            "id": r.id,
            "doc_type": r.doc_type,
            "display_name": r.display_name,
        }
        for r in rows
    ]


@llm_models_router.post("/sync-check")
@limiter.limit("10/minute")
async def sync_check_llm_models(
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
) -> dict:
    """Compare the ``llm_models`` table against what each provider lists live.

    Returns per provider:
    - ``available``: whether we could reach the provider at all
    - ``error``: message if not available
    - ``deprecated``: rows in the DB that the provider no longer offers,
      annotated with the templates that reference them and a suggested
      replacement from the same provider
    - ``new``: models the provider offers but that we don't have in the DB
    """
    results = fetch_all_providers()
    now = datetime.now(timezone.utc).isoformat()
    response_providers: dict[str, dict] = {}

    for provider_name, result in results.items():
        base = result_to_dict(result)

        if not result.available:
            # Provider not reachable — skip diff, pass through error
            base["deprecated"] = []
            base["new"] = []
            response_providers[provider_name] = base
            continue

        live_ids = result.model_ids
        db_rows = (
            db.query(LlmModel)
            .filter(LlmModel.provider == provider_name)
            .all()
        )
        db_ids = {r.model_id for r in db_rows}

        # Deprecated = in DB, not in live list
        deprecated: list[dict] = []
        for row in db_rows:
            if row.model_id not in live_ids:
                suggestion = _pick_replacement_model(row, live_ids, db)
                deprecated.append(
                    {
                        "id": row.id,
                        "provider": row.provider,
                        "model_id": row.model_id,
                        "display_name": row.display_name,
                        "is_active": row.is_active,
                        "referencing_templates": _referencing_templates(
                            row.provider, row.model_id, db
                        ),
                        "suggested_replacement": suggestion,
                    }
                )

        # New = in live list, not in DB
        new_models = [
            {
                "provider": m.provider,
                "model_id": m.model_id,
                "display_name": m.display_name,
                "created_at": m.created_at,
            }
            for m in result.models
            if m.model_id not in db_ids
        ]

        base["deprecated"] = deprecated
        base["new"] = new_models
        # Drop the full live list from the response — admins only need the diff.
        base.pop("live_models", None)
        response_providers[provider_name] = base

    record_activity(
        db,
        admin,
        "admin_llm_sync_check",
        request=request,
        metadata=json.dumps(
            {
                "providers_available": [
                    p for p, r in response_providers.items() if r["available"]
                ],
                "deprecated_count": sum(
                    len(r["deprecated"]) for r in response_providers.values()
                ),
                "new_count": sum(
                    len(r["new"]) for r in response_providers.values()
                ),
            }
        ),
    )
    logger.info(
        "Admin %d ran sync-check across %d providers",
        admin.id,
        len(response_providers),
    )

    return {"checked_at": now, "providers": response_providers}


@llm_models_router.post("/import")
@limiter.limit("10/minute")
async def import_llm_models(
    payload: LlmImportRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
) -> dict:
    """Bulk-insert newly-discovered LLM models from the sync-check flow.

    Items whose ``(provider, model_id)`` already exists are skipped silently.
    """
    created = 0
    skipped = 0
    created_items: list[dict] = []
    now = datetime.now(timezone.utc)

    # Compute the next sort_order per provider so new entries land at the end.
    next_sort: dict[str, int] = {}
    for p in VALID_PROVIDERS:
        max_so = (
            db.query(LlmModel)
            .filter(LlmModel.provider == p)
            .order_by(LlmModel.sort_order.desc())
            .first()
        )
        next_sort[p] = (max_so.sort_order + 1) if max_so else 0

    for item in payload.models:
        existing = (
            db.query(LlmModel)
            .filter(
                LlmModel.provider == item.provider,
                LlmModel.model_id == item.model_id,
            )
            .first()
        )
        if existing is not None:
            skipped += 1
            continue

        row = LlmModel(
            provider=item.provider,
            model_id=item.model_id,
            display_name=item.display_name,
            sort_order=next_sort[item.provider],
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        db.add(row)
        db.flush()
        next_sort[item.provider] += 1
        created += 1
        created_items.append(_serialize_llm_model(row))

    db.commit()

    record_activity(
        db,
        admin,
        "admin_llm_import",
        request=request,
        metadata=json.dumps({"created": created, "skipped": skipped}),
    )
    logger.info(
        "Admin %d imported %d LLM models (%d skipped)",
        admin.id,
        created,
        skipped,
    )

    return {"created": created, "skipped": skipped, "items": created_items}


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
        "Admin %d seeded catalog (force=%s): document_types=%s llm_models=%s",
        admin.id,
        force_update,
        dt,
        lm,
    )

    return {"document_types": dt, "llm_models": lm}
