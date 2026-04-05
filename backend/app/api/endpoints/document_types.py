"""Admin CRUD endpoints for ``document_types`` and ``llm_models``.

These endpoints let an admin manage the document catalog and the list of
available LLM models from the UI, without a code change / deploy. They
replace the hard-coded data in ``app/document_catalog.py`` and the frontend
``availableModels`` dict.
"""
from __future__ import annotations

import json
import logging
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
from app.models import DocumentType, LlmModel, User

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

VALID_CATEGORIES = {"essential_pack", "high_impact_addons", "premium_documents"}
VALID_PROVIDERS = {"openai", "anthropic", "google"}


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
    pass


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
    db.commit()
    db.refresh(row)

    record_activity(
        db,
        admin,
        "admin_document_type_create",
        request=request,
        metadata=json.dumps({"key": row.key, "title": row.title}),
    )
    logger.info("Admin %s created DocumentType %s", admin.email, row.key)
    return _serialize_document_type(row)


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
    if "outputs" in update_data and update_data["outputs"] is not None:
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
    logger.info("Admin %s updated DocumentType %s", admin.email, row.key)
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
    logger.info("Admin %s deleted DocumentType %s", admin.email, key)
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
    logger.info("Admin %s created LlmModel %s/%s", admin.email, row.provider, row.model_id)
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
        "Admin %s updated LlmModel %s/%s", admin.email, row.provider, row.model_id
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
    logger.info("Admin %s deleted LlmModel %s/%s", admin.email, provider, model_id)
    return {"message": "LLM-Modell gelöscht.", "provider": provider, "model_id": model_id}


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
    from app.seed_catalog_to_db import seed_document_types, seed_llm_models

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
