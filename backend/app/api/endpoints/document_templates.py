"""API endpoints for managing document templates (admin only)."""
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DocumentTemplate, User
from app.api.endpoints.admin import get_admin_user
from app.limiter import limiter

logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic Schemas
class DocumentTemplateBase(BaseModel):
    doc_type: str
    display_name: str
    credit_cost: int = Field(ge=0, le=10, default=1)
    language_source: str = Field(
        default="documentation_language",
        pattern="^(preferred_language|mother_tongue|documentation_language)$"
    )
    llm_provider: str = Field(default="openai")
    llm_model: str = Field(default="gpt-4")
    prompt_template: str
    is_active: bool = True


class DocumentTemplateCreate(DocumentTemplateBase):
    pass


class DocumentTemplateUpdate(BaseModel):
    display_name: Optional[str] = None
    credit_cost: Optional[int] = Field(None, ge=0, le=10)
    language_source: Optional[str] = Field(
        None,
        pattern="^(preferred_language|mother_tongue|documentation_language)$"
    )
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    prompt_template: Optional[str] = None
    is_active: Optional[bool] = None


class DocumentTemplateResponse(BaseModel):
    id: int
    doc_type: str
    display_name: str
    credit_cost: int
    language_source: str
    llm_provider: str
    llm_model: str
    prompt_template: str
    is_active: bool
    created_at: Optional[str]
    updated_at: Optional[str]

    class Config:
        from_attributes = True


def serialize_document_template(template: DocumentTemplate) -> dict:
    """Serialize a DocumentTemplate to a dictionary."""
    return {
        "id": template.id,
        "doc_type": template.doc_type,
        "display_name": template.display_name,
        "credit_cost": template.credit_cost,
        "language_source": template.language_source,
        "llm_provider": template.llm_provider,
        "llm_model": template.llm_model,
        "prompt_template": template.prompt_template,
        "is_active": template.is_active,
        "created_at": template.created_at.isoformat() if template.created_at else None,
        "updated_at": template.updated_at.isoformat() if template.updated_at else None,
    }


@router.get("/", response_model=List[DocumentTemplateResponse])
@limiter.limit("30/minute")
async def list_document_templates(
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """List all document templates (admin only)."""
    templates = db.query(DocumentTemplate).order_by(DocumentTemplate.doc_type).all()
    return [serialize_document_template(t) for t in templates]


@router.get("/{template_id}", response_model=DocumentTemplateResponse)
@limiter.limit("30/minute")
async def get_document_template(
    template_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Get a specific document template (admin only)."""
    template = db.query(DocumentTemplate).filter(
        DocumentTemplate.id == template_id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return serialize_document_template(template)


@router.post("/", response_model=DocumentTemplateResponse)
@limiter.limit("20/minute")
async def create_document_template(
    template: DocumentTemplateCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Create a new document template (admin only)."""
    # Check if doc_type already exists
    existing = db.query(DocumentTemplate).filter(
        DocumentTemplate.doc_type == template.doc_type
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document type already exists"
        )

    # Validate LLM provider
    valid_providers = ["openai", "anthropic", "google"]
    if template.llm_provider not in valid_providers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid LLM provider. Must be one of: {', '.join(valid_providers)}"
        )

    db_template = DocumentTemplate(
        doc_type=template.doc_type,
        display_name=template.display_name,
        credit_cost=template.credit_cost,
        language_source=template.language_source,
        llm_provider=template.llm_provider,
        llm_model=template.llm_model,
        prompt_template=template.prompt_template,
        is_active=template.is_active,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    logger.info(f"Admin {admin.email} created document template: {template.doc_type}")
    return serialize_document_template(db_template)


@router.put("/{template_id}", response_model=DocumentTemplateResponse)
@limiter.limit("20/minute")
async def update_document_template(
    template_id: int,
    template_update: DocumentTemplateUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Update a document template (admin only)."""
    db_template = db.query(DocumentTemplate).filter(
        DocumentTemplate.id == template_id
    ).first()
    if not db_template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Validate LLM provider if provided
    if template_update.llm_provider is not None:
        valid_providers = ["openai", "anthropic", "google"]
        if template_update.llm_provider not in valid_providers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid LLM provider. Must be one of: {', '.join(valid_providers)}"
            )

    # Update only provided fields
    update_data = template_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_template, field, value)

    db_template.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(db_template)
    logger.info(f"Admin {admin.email} updated document template: {db_template.doc_type}")
    return serialize_document_template(db_template)


@router.delete("/{template_id}")
@limiter.limit("20/minute")
async def delete_document_template(
    template_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Delete a document template (admin only)."""
    db_template = db.query(DocumentTemplate).filter(
        DocumentTemplate.id == template_id
    ).first()
    if not db_template:
        raise HTTPException(status_code=404, detail="Template not found")

    doc_type = db_template.doc_type
    db.delete(db_template)
    db.commit()
    logger.info(f"Admin {admin.email} deleted document template: {doc_type}")
    return {"message": "Template deleted successfully"}


@router.post("/seed")
@limiter.limit("5/minute")
async def seed_templates(
    request: Request,
    force_update: bool = False,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """
    Seed document templates from catalog and prompts (admin only).

    Args:
        force_update: If True, update existing templates with new data from JSON
    """
    from app.seed_document_templates import seed_document_templates

    result = seed_document_templates(db, force_update=force_update)
    logger.info(f"Admin {admin.email} seeded document templates: {result}")
    return {
        "message": "Document templates seeded successfully",
        **result
    }
