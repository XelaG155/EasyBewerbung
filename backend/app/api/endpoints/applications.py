from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
import os
import json
import re
import logging
from io import BytesIO
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session, joinedload
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.enums import TA_LEFT, TA_CENTER

from app.database import get_db
from app.document_catalog import get_allowed_generated_doc_types
from app.models import Application, GeneratedDocument, User, Document, JobOffer, MatchingScore, GenerationTask, DocumentTemplate, MatchingScoreTask
from app.auth import get_current_user
from app.language_catalog import DEFAULT_LANGUAGE, normalize_language
from app.tasks import calculate_matching_score_task, generate_documents_task, delete_documents_task, get_doc_type_display
from app.api.endpoints.users import record_activity
from app.limiter import limiter

logger = logging.getLogger(__name__)
router = APIRouter()

# Load JSON prompts
PROMPTS_FILE = os.path.join(os.path.dirname(__file__), '../../document_prompts.json')
with open(PROMPTS_FILE, 'r', encoding='utf-8') as f:
    DOCUMENT_PROMPTS: Dict[str, Dict[str, Any]] = json.load(f)


def get_language_instruction(lang: str) -> str:
    """Get language-specific instructions for LLM prompts."""
    if lang in ["Deutsch (Schweiz)", "de-CH"]:
        return f"{lang} (IMPORTANT: Use Swiss German spelling with 'ss' instead of 'ß', as used in Switzerland)"
    return lang


def get_language_from_user(user: User, language_source: str) -> str:
    """Get the appropriate language from user based on the language_source configuration."""
    if language_source == "preferred_language":
        return getattr(user, "preferred_language", None) or DEFAULT_LANGUAGE
    elif language_source == "mother_tongue":
        return getattr(user, "mother_tongue", None) or DEFAULT_LANGUAGE
    elif language_source == "documentation_language":
        return getattr(user, "documentation_language", None) or DEFAULT_LANGUAGE
    else:
        # Fallback to documentation_language
        return getattr(user, "documentation_language", None) or DEFAULT_LANGUAGE


# Two LLM helpers (``get_llm_client``, ``generate_with_llm``) used to live
# here as a near-duplicate of the same functions in ``app.tasks``. The local
# copies silently swallowed ImportError for the anthropic/google SDKs and
# fell back to OpenAI ``gpt-4`` — so a template configured for Anthropic
# would silently produce a wrong-provider, wrong-model document, with no
# admin-visible error. They were never imported from outside this module
# and were removed on 2026-04-26. The real path is
# ``app.tasks.get_llm_client`` / ``app.tasks.generate_with_llm``, which
# raise ``LlmProviderUnavailable`` on missing SDK or missing API key.


class ApplicationCreate(BaseModel):
    job_title: str = Field(..., description="Role the candidate is targeting")
    company: str = Field(..., description="Company name for the application")
    job_offer_url: Optional[str] = Field(None, description="URL to the job offer or image link")
    is_spontaneous: bool = Field(False, description="Flag to mark spontaneous applications")
    opportunity_context: Optional[str] = Field(
        None, description="Context for spontaneous applications (e.g., target team, value proposition)"
    )
    application_type: str = Field("fulltime", description="Type of position: fulltime, internship, apprenticeship")
    applied: bool = False
    applied_at: Optional[datetime] = None
    result: Optional[str] = Field(None, description="Outcome (e.g., pending, interview, rejected, offer)")
    ui_language: Optional[str] = Field(None, description="Language used while navigating the platform")
    documentation_language: Optional[str] = Field(None, description="Target language for generated documents")
    company_profile_language: Optional[str] = Field(None, description="Language for the company profile brief")

    @field_validator("ui_language", "documentation_language", "company_profile_language", mode="before")
    @classmethod
    def validate_language(cls, value: Optional[str], info):
        return normalize_language(value, field_name=info.field_name) if value else value

    @field_validator("application_type", mode="before")
    @classmethod
    def validate_application_type(cls, value: Optional[str]):
        if value is None:
            return "fulltime"
        valid_types = ["fulltime", "internship", "apprenticeship"]
        if value not in valid_types:
            raise ValueError(f"application_type must be one of: {', '.join(valid_types)}")
        return value


class ApplicationUpdate(BaseModel):
    applied: Optional[bool] = None
    applied_at: Optional[datetime] = None
    result: Optional[str] = None
    documentation_language: Optional[str] = None
    company_profile_language: Optional[str] = None

    @field_validator("documentation_language", "company_profile_language", mode="before")
    @classmethod
    def validate_language(cls, value: Optional[str], info):
        return normalize_language(value, field_name=info.field_name) if value else value


class GeneratedDocumentCreate(BaseModel):
    doc_type: str = Field(..., description="Key of the generated document template")
    format: str = Field("PDF", description="Stored output format, e.g., PDF, DOCX, Text")
    storage_path: str = Field(..., description="File path or URL where the generated asset lives")


class ApplicationDocumentBatch(BaseModel):
    documents: List[GeneratedDocumentCreate]


class GeneratedDocumentResponse(BaseModel):
    id: int
    doc_type: str
    format: str
    storage_path: str
    content: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.replace(tzinfo=timezone.utc).isoformat() if v.tzinfo is None else v.isoformat()
        }


class ApplicationResponse(BaseModel):
    id: int
    job_title: str
    company: str
    job_offer_url: Optional[str]
    job_offer_id: Optional[int]  # ID of the saved JobOffer for PDF access
    is_spontaneous: bool
    opportunity_context: Optional[str]
    application_type: str  # fulltime, internship, apprenticeship
    job_description: Optional[str]
    applied: bool
    applied_at: Optional[datetime]
    result: Optional[str]
    ui_language: str
    documentation_language: str
    company_profile_language: str
    created_at: datetime
    generated_documents: List[GeneratedDocumentResponse]

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.replace(tzinfo=timezone.utc).isoformat() if v and v.tzinfo is None else (v.isoformat() if v else None)
        }


def serialize_generated_document(doc: GeneratedDocument) -> dict:
    created_at_utc = doc.created_at.replace(tzinfo=timezone.utc) if doc.created_at and doc.created_at.tzinfo is None else doc.created_at
    return {
        "id": doc.id,
        "doc_type": doc.doc_type,
        "format": doc.format,
        "storage_path": doc.storage_path,
        "content": doc.content,
        "created_at": created_at_utc.isoformat() if created_at_utc else None,
    }


def serialize_application(app: Application, db: Session = None, include_job_description: bool = True) -> dict:
    """
    Serialize an application to a dictionary.

    Args:
        app: The application to serialize
        db: Database session (optional, required if include_job_description is True)
        include_job_description: Whether to include the full job description (default: True)
                                 Set to False for list views to improve performance
    """
    job_description = None
    job_offer_id = None
    if include_job_description:
        if db and app.job_offer_url:
            job_offer = db.query(JobOffer).filter(JobOffer.url == app.job_offer_url).first()
            if job_offer:
                job_description = job_offer.description
                job_offer_id = job_offer.id
        if not job_description and app.opportunity_context:
            job_description = app.opportunity_context

    # Convert naive datetimes to UTC-aware and serialize as ISO 8601
    created_at_utc = app.created_at.replace(tzinfo=timezone.utc) if app.created_at and app.created_at.tzinfo is None else app.created_at
    applied_at_utc = app.applied_at.replace(tzinfo=timezone.utc) if app.applied_at and app.applied_at.tzinfo is None else app.applied_at

    return {
        "id": app.id,
        "job_title": app.job_title,
        "company": app.company,
        "job_offer_url": app.job_offer_url,
        "job_offer_id": job_offer_id,
        "is_spontaneous": app.is_spontaneous,
        "opportunity_context": app.opportunity_context,
        "application_type": getattr(app, "application_type", "fulltime"),
        "job_description": job_description,
        "applied": app.applied,
        "applied_at": applied_at_utc.isoformat() if applied_at_utc else None,
        "result": app.result,
        "ui_language": app.ui_language,
        "documentation_language": app.documentation_language,
        "company_profile_language": app.company_profile_language,
        "created_at": created_at_utc.isoformat() if created_at_utc else None,
        "generated_documents": [serialize_generated_document(doc) for doc in app.generated_documents],
    }


@router.post("/", response_model=ApplicationResponse)
@limiter.limit("20/minute")
async def create_application(
    request: Request,
    payload: ApplicationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record a new application intent so we can attach generated documents to it."""
    applied_at = payload.applied_at
    if payload.applied and payload.applied_at is None:
        applied_at = datetime.now(timezone.utc)

    def resolve_language(value: Optional[str], fallback: Optional[str]) -> str:
        normalized_value = normalize_language(value) if value else None
        if normalized_value:
            return normalized_value
        normalized_fallback = normalize_language(fallback) if fallback else DEFAULT_LANGUAGE
        return normalized_fallback or DEFAULT_LANGUAGE

    ui_language = resolve_language(payload.ui_language, current_user.mother_tongue or current_user.preferred_language)
    documentation_language = resolve_language(
        payload.documentation_language, current_user.documentation_language or current_user.preferred_language
    )
    company_profile_language = resolve_language(payload.company_profile_language, ui_language)

    supports_for_update = getattr(db.bind.dialect, "supports_for_update", False)

    try:
        user_query = db.query(User).filter(User.id == current_user.id)
        if supports_for_update:
            user_query = user_query.with_for_update()

        user_for_update = user_query.first()
        if not user_for_update:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        if user_for_update.credits <= 0:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Nicht genug Credits, um die Generierung zu starten.",
            )

        user_for_update.credits -= 1

        application = Application(
            user_id=user_for_update.id,
            job_title=payload.job_title,
            company=payload.company,
            job_offer_url=payload.job_offer_url,
            is_spontaneous=payload.is_spontaneous,
            opportunity_context=payload.opportunity_context,
            application_type=payload.application_type,
            applied=payload.applied,
            applied_at=applied_at,
            result=payload.result,
            ui_language=ui_language,
            documentation_language=documentation_language,
            company_profile_language=company_profile_language,
        )
        db.add(application)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise

    db.refresh(application)
    db.refresh(user_for_update)

    # Check if user has a CV - if so, automatically start matching score calculation in background
    cv_doc = (
        db.query(Document)
        .filter(Document.user_id == current_user.id, Document.doc_type == "CV")
        .order_by(Document.created_at.desc())
        .first()
    )
    if cv_doc and cv_doc.content_text:
        # Create matching score task
        matching_task = MatchingScoreTask(
            application_id=application.id,
            user_id=current_user.id,
            status="pending",
        )
        db.add(matching_task)
        db.commit()
        db.refresh(matching_task)

        # Queue Celery task for matching score calculation
        calculate_matching_score_task.delay(
            matching_task.id,
            application.id,
            current_user.id,
            False,  # not a recalculate
        )
        logger.info("Queued matching score calculation for application %s", application.id)

    return serialize_application(application, db)


@router.patch("/{application_id}", response_model=ApplicationResponse)
@limiter.limit("30/minute")
async def update_application(
    request: Request,
    application_id: int,
    payload: ApplicationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update an application (only for the current user)."""
    application = (
        db.query(Application)
        .filter(Application.id == application_id, Application.user_id == current_user.id)
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Bewerbung nicht gefunden.")

    if payload.applied is not None:
        application.applied = payload.applied
    if payload.applied_at is not None:
        application.applied_at = payload.applied_at
    if payload.result is not None:
        application.result = payload.result
    if payload.documentation_language is not None:
        application.documentation_language = payload.documentation_language
    if payload.company_profile_language is not None:
        application.company_profile_language = payload.company_profile_language

    db.commit()
    db.refresh(application)
    return serialize_application(application, db)


@router.post("/{application_id}/documents", response_model=ApplicationResponse)
@limiter.limit("30/minute")
async def attach_generated_documents(
    request: Request,
    application_id: int,
    payload: ApplicationDocumentBatch,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Attach generated documents to an application (only for the current user)."""
    application = (
        db.query(Application)
        .options(joinedload(Application.generated_documents))
        .filter(Application.id == application_id, Application.user_id == current_user.id)
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Bewerbung nicht gefunden.")

    allowed_doc_types = get_allowed_generated_doc_types(db)
    for doc in payload.documents:
        if doc.doc_type not in allowed_doc_types:
            raise HTTPException(
                status_code=422,
                detail=f"Unsupported doc_type '{doc.doc_type}'. Check the /documents/catalog list.",
            )
        generated = GeneratedDocument(
            application_id=application.id,
            doc_type=doc.doc_type,
            format=doc.format,
            storage_path=doc.storage_path,
        )
        db.add(generated)

    db.commit()
    db.refresh(application)
    db.expire_all()
    reloaded = (
        db.query(Application)
        .options(joinedload(Application.generated_documents))
        .get(application.id)
    )
    return serialize_application(reloaded, db)


class DeleteDocumentsRequest(BaseModel):
    document_ids: List[int] = Field(..., description="List of document IDs to delete")


@router.delete("/{application_id}/documents")
@limiter.limit("20/minute")
async def delete_generated_documents(
    request: Request,
    application_id: int,
    payload: DeleteDocumentsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete generated documents from an application using Celery worker."""
    # Verify application belongs to user
    application = (
        db.query(Application)
        .filter(Application.id == application_id, Application.user_id == current_user.id)
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Bewerbung nicht gefunden.")

    # Queue Celery task for deletion
    delete_documents_task.delay(
        application_id,
        payload.document_ids,
        current_user.id,
    )

    return {
        "message": f"Deletion of {len(payload.document_ids)} document(s) has been queued",
        "status": "queued",
        "application_id": application_id
    }


@router.get("/history", response_model=List[ApplicationResponse])
@limiter.limit("60/minute")
async def list_application_history(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all applications for the current user."""
    try:
        logger.debug("Fetching application history for user %s", current_user.id)
        applications = (
            db.query(Application)
            .options(joinedload(Application.generated_documents))
            .filter(Application.user_id == current_user.id)
            .order_by(Application.created_at.desc())
            .all()
        )
        logger.debug("Found %s applications for user %s", len(applications), current_user.id)

        # Efficiently load job descriptions using a single query
        # This prevents N+1 query problem
        job_urls = [app.job_offer_url for app in applications if app.job_offer_url]
        job_offers_map = {}
        if job_urls:
            job_offers = db.query(JobOffer).filter(JobOffer.url.in_(job_urls)).all()
            job_offers_map = {jo.url: jo.description for jo in job_offers}
            logger.debug("Loaded %s job descriptions", len(job_offers_map))

        # Build job_offers ID map for PDF access
        job_offers_id_map = {}
        if job_urls:
            job_offers_id_map = {jo.url: jo.id for jo in job_offers}

        # Serialize applications with pre-loaded job descriptions
        result = []
        for app in applications:
            # Convert naive datetimes to UTC-aware and serialize as ISO 8601
            created_at_utc = app.created_at.replace(tzinfo=timezone.utc) if app.created_at and app.created_at.tzinfo is None else app.created_at
            applied_at_utc = app.applied_at.replace(tzinfo=timezone.utc) if app.applied_at and app.applied_at.tzinfo is None else app.applied_at

            serialized = {
                "id": app.id,
                "job_title": app.job_title,
                "company": app.company,
                "job_offer_url": app.job_offer_url,
                "job_offer_id": job_offers_id_map.get(app.job_offer_url) if app.job_offer_url else None,
                "is_spontaneous": app.is_spontaneous,
                "opportunity_context": app.opportunity_context,
                "application_type": getattr(app, "application_type", "fulltime"),
                "job_description": job_offers_map.get(app.job_offer_url)
                if app.job_offer_url
                else app.opportunity_context,
                "applied": app.applied,
                "applied_at": applied_at_utc.isoformat() if applied_at_utc else None,
                "result": app.result,
                "ui_language": app.ui_language,
                "documentation_language": app.documentation_language,
                "company_profile_language": app.company_profile_language,
                "created_at": created_at_utc.isoformat() if created_at_utc else None,
                "generated_documents": [serialize_generated_document(doc) for doc in app.generated_documents],
            }
            result.append(serialized)

        logger.debug("Serialized %s applications", len(result))
        return result
    except Exception:
        # Never log raw exception messages — they can include LLM-derived
        # output, scraped HTML, or user-supplied free text. logger.exception
        # records the traceback under WARNING-level handler config.
        logger.exception("list_application_history failed for user %s", current_user.id)
        raise HTTPException(
            status_code=500,
            detail="Error loading application history. Please try again later.",
        )


@router.get("/rav-report", response_model=dict)
@limiter.limit("20/minute")
async def rav_report(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Produce a copy/paste friendly report for Swiss RAV offices (Nachweis der persönlichen Arbeitsbemühungen)."""
    applications = (
        db.query(Application)
        .options(joinedload(Application.generated_documents))
        .filter(Application.user_id == current_user.id)
        .order_by(Application.applied_at.desc().nullslast(), Application.created_at.desc())
        .all()
    )

    lines = []
    for idx, app in enumerate(applications, start=1):
        applied_date = None
        if app.applied_at:
            applied_date = app.applied_at.strftime("%d.%m.%Y")
        elif app.created_at:
            applied_date = app.created_at.strftime("%d.%m.%Y")

        documents = ", ".join(doc.doc_type for doc in app.generated_documents) or "None"
        result = app.result or "pending"
        applied_label = "Yes" if app.applied else "No"

        context_label = "Spontaneous" if app.is_spontaneous else "Targeted"
        context_note = app.opportunity_context or "n/a"

        lines.append(
            f"{idx}. {app.company} – {app.job_title} | Type: {context_label} | URL: {app.job_offer_url or 'n/a'} | "
            f"Context: {context_note} | Applied: {applied_label} on {applied_date or 'n/a'} | Result: {result} | Documents: {documents}"
        )

    report_body = "\n".join(lines)
    return {
        "report": report_body,
        "entries": len(lines),
        "generated_at": datetime.now(timezone.utc),
    }


@router.get("/{application_id}", response_model=ApplicationResponse)
@limiter.limit("60/minute")
async def get_application(
    request: Request,
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific application (only for the current user)."""
    application = (
        db.query(Application)
        .options(joinedload(Application.generated_documents))
        .filter(Application.id == application_id, Application.user_id == current_user.id)
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Bewerbung nicht gefunden.")
    return serialize_application(application, db)


@router.delete("/{application_id}")
@limiter.limit("20/minute")
async def delete_application(
    request: Request,
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete an application and all its associated data (only for the current user)."""
    application = (
        db.query(Application)
        .filter(Application.id == application_id, Application.user_id == current_user.id)
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Bewerbung nicht gefunden.")

    # Delete associated matching score tasks
    db.query(MatchingScoreTask).filter(MatchingScoreTask.application_id == application_id).delete()

    # Delete associated matching scores
    db.query(MatchingScore).filter(MatchingScore.application_id == application_id).delete()

    # Delete associated generation tasks
    db.query(GenerationTask).filter(GenerationTask.application_id == application_id).delete()

    # Delete associated generated documents
    db.query(GeneratedDocument).filter(GeneratedDocument.application_id == application_id).delete()

    # Delete the application itself
    db.delete(application)
    db.commit()

    logger.info("Deleted application %s for user %s", application_id, current_user.id)

    return {"message": "Application deleted successfully", "id": application_id}

@router.get("/{application_id}/matching-score")
@limiter.limit("60/minute")
async def get_matching_score(
    request: Request,
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get existing matching score for an application (returns null if not yet calculated)."""
    # Get application
    application = (
        db.query(Application)
        .filter(Application.id == application_id, Application.user_id == current_user.id)
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Bewerbung nicht gefunden.")

    # Check if we already have a matching score
    existing_score = (
        db.query(MatchingScore)
        .filter(MatchingScore.application_id == application_id)
        .first()
    )

    if existing_score:
        return {
            "application_id": application_id,
            "job_title": application.job_title,
            "company": application.company,
            "overall_score": existing_score.overall_score,
            "strengths": json.loads(existing_score.strengths),
            "gaps": json.loads(existing_score.gaps),
            "recommendations": json.loads(existing_score.recommendations),
            "story": existing_score.story,
            "status": "completed",
        }

    # No score yet - return null status
    return {
        "application_id": application_id,
        "job_title": application.job_title,
        "company": application.company,
        "status": "not_calculated",
    }


@router.post("/{application_id}/matching-score/calculate")
@limiter.limit("5/minute")
async def calculate_matching_score(
    request: Request,
    application_id: int,
    recalculate: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Start asynchronous matching score calculation."""
    # Get application
    application = (
        db.query(Application)
        .filter(Application.id == application_id, Application.user_id == current_user.id)
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Bewerbung nicht gefunden.")

    # Check if score already exists and not recalculating
    if not recalculate:
        existing_score = (
            db.query(MatchingScore)
            .filter(MatchingScore.application_id == application_id)
            .first()
        )
        if existing_score:
            return {
                "task_id": None,
                "status": "already_calculated",
                "application_id": application_id,
                "message": "Matching score already exists. Use recalculate=true to recalculate.",
            }

    # Check for CV
    cv_doc = (
        db.query(Document)
        .filter(Document.user_id == current_user.id, Document.doc_type == "CV")
        .order_by(Document.created_at.desc())
        .first()
    )
    if not cv_doc or not cv_doc.content_text:
        raise HTTPException(status_code=400, detail="Kein Lebenslauf mit Textinhalt gefunden.")

    # Create task
    task = MatchingScoreTask(
        application_id=application_id,
        user_id=current_user.id,
        status="pending",
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    # Queue Celery task
    calculate_matching_score_task.delay(
        task.id,
        application_id,
        current_user.id,
        recalculate,
    )

    return {
        "task_id": task.id,
        "status": "queued",
        "application_id": application_id,
        "message": "Matching score calculation has been queued.",
    }


@router.get("/{application_id}/matching-score-status/{task_id}")
@limiter.limit("120/minute")
async def get_matching_score_status(
    request: Request,
    application_id: int,
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the status of a matching score calculation task."""
    task = (
        db.query(MatchingScoreTask)
        .filter(
            MatchingScoreTask.id == task_id,
            MatchingScoreTask.application_id == application_id,
            MatchingScoreTask.user_id == current_user.id,
        )
        .first()
    )

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    response = {
        "task_id": task.id,
        "application_id": task.application_id,
        "status": task.status,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "updated_at": task.updated_at.isoformat() if task.updated_at else None,
    }

    if task.error_message:
        response["error_message"] = task.error_message

    # If completed, include the matching score
    if task.status == "completed":
        application = db.query(Application).filter(Application.id == application_id).first()
        score = (
            db.query(MatchingScore)
            .filter(MatchingScore.application_id == application_id)
            .first()
        )
        if score and application:
            response["matching_score"] = {
                "application_id": application_id,
                "job_title": application.job_title,
                "company": application.company,
                "overall_score": score.overall_score,
                "strengths": json.loads(score.strengths),
                "gaps": json.loads(score.gaps),
                "recommendations": json.loads(score.recommendations),
                "story": score.story,
            }

    return response


@router.post("/{application_id}/generate")
@limiter.limit("10/minute")
async def generate_documents(
    request: Request,
    application_id: int,
    doc_types: List[str],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Queue documents (cover letter, etc.) for generation using AI in the background."""
    # Get application
    application = (
        db.query(Application)
        .filter(Application.id == application_id, Application.user_id == current_user.id)
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Bewerbung nicht gefunden.")

    # Validate every requested doc_type against the active template catalog.
    # Without this guard the worker silently skips unknown types (tasks.py
    # `continue` branch) — the user pays nothing for them but also gets no
    # error response telling them their request was partially malformed.
    if not doc_types:
        raise HTTPException(
            status_code=400,
            detail="Bitte mindestens einen Dokumenttyp auswaehlen.",
        )
    templates = db.query(DocumentTemplate).filter(
        DocumentTemplate.doc_type.in_(doc_types),
        DocumentTemplate.is_active == True
    ).all()
    templates_map = {t.doc_type: t for t in templates}
    unknown = [d for d in doc_types if d not in templates_map]
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unbekannte Dokumenttyp(en): "
                + ", ".join(sorted(set(unknown)))
                + ". Im Admin-Bereich aktivieren oder als Tippfehler korrigieren."
            ),
        )

    total_cost = 0
    for doc_type in doc_types:
        template = templates_map.get(doc_type)
        if template:
            total_cost += template.credit_cost

    # Verify CV exists before we touch credits — fail fast on misconfigured
    # accounts.
    cv_doc = (
        db.query(Document)
        .filter(Document.user_id == current_user.id, Document.doc_type == "CV")
        .order_by(Document.created_at.desc())
        .first()
    )
    if not cv_doc or not cv_doc.content_text:
        raise HTTPException(
            status_code=400,
            detail=(
                "Kein Lebenslauf mit Textinhalt gefunden. "
                "Bitte zuerst Ihren CV im Bereich Dokumente hochladen einreichen."
            ),
        )

    # Pre-flight gate: doc-types that synthesise content from reference
    # letters (currently only ``reference_summary``) need at least one
    # REFERENCE doc with non-empty extracted text. Without this guard the
    # worker still runs through the LLM call but the prompt has the
    # honest "No reference letters provided" placeholder, so the LLM
    # produces a near-empty summary and the user pays a credit for a
    # blank document. (DA Iteration-3 P1 — surface to user instead of
    # silently absorbing.)
    REFERENCE_REQUIRED_DOC_TYPES = {"reference_summary"}
    requested_with_refs = REFERENCE_REQUIRED_DOC_TYPES.intersection(doc_types)
    if requested_with_refs:
        usable_refs = (
            db.query(Document)
            .filter(Document.user_id == current_user.id, Document.doc_type == "REFERENCE")
            .all()
        )
        usable_refs = [d for d in usable_refs if d.content_text and d.content_text.strip()]
        if not usable_refs:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Fuer "
                    + ", ".join(sorted(requested_with_refs))
                    + " benoetigen wir mindestens ein hochgeladenes "
                    "Referenzschreiben mit lesbarem Text. Bitte zuerst ein "
                    "REFERENCE-Dokument hochladen."
                ),
            )

    # Atomic credit deduction with row-level lock to prevent the
    # double-spend race documented in CLAUDE-2026.04.md (Iteration 1
    # P0-B). Without ``with_for_update`` two concurrent calls can both
    # read the user's credit balance from the SQLAlchemy identity cache,
    # both pass the check, and both commit a deduction — leaving credits
    # negative. SQLite ignores the FOR UPDATE clause silently which is
    # safe; the test suite runs against SQLite and exercises the same
    # code path.
    user_dialect = getattr(getattr(db.bind, "dialect", None), "name", "")
    user_query = db.query(User).filter(User.id == current_user.id)
    if user_dialect != "sqlite":
        user_query = user_query.with_for_update()
    user_locked = user_query.first()
    if user_locked is None:
        # Should be impossible — get_current_user just resolved the row.
        raise HTTPException(status_code=401, detail="User not found")
    if user_locked.credits < total_cost:
        raise HTTPException(
            status_code=402,
            detail=(
                f"Nicht genug Credits. Benoetigt: {total_cost}, vorhanden: "
                f"{user_locked.credits}. Bitte einen Admin um Aufstockung bitten."
            ),
        )
    user_locked.credits -= total_cost

    task = GenerationTask(
        application_id=application_id,
        user_id=current_user.id,
        status="pending",
        total_docs=len(doc_types),
        completed_docs=0,
        failed_docs=0,
        credits_held=total_cost,
        credits_refunded=0,
        progress=0,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    # Audit trail — credits are a financial path, every spend MUST be
    # recorded. Stored as id-only metadata; no PII.
    record_activity(
        db,
        current_user,
        "generate_documents",
        request,
        metadata=f"app={application_id} cost={total_cost} types={','.join(sorted(set(doc_types)))}",
    )

    # current_user is the unlocked snapshot — refresh it from the locked
    # row so the response reports the post-deduction balance accurately.
    remaining_credits = user_locked.credits

    # Queue Celery task
    generate_documents_task.delay(
        task.id,
        application_id,
        doc_types,
        current_user.id,
    )

    return {
        "task_id": task.id,
        "status": "queued",
        "message": "Document generation has been queued. Use the status endpoint to check progress.",
        "application_id": application_id,
        "total_documents": len(doc_types),
        "credits_used": total_cost,
        "remaining_credits": remaining_credits,
    }


@router.get("/{application_id}/generation-status/{task_id}")
@limiter.limit("120/minute")
async def get_generation_status(
    request: Request,
    application_id: int,
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the status of a document generation task."""
    task = (
        db.query(GenerationTask)
        .filter(
            GenerationTask.id == task_id,
            GenerationTask.application_id == application_id,
            GenerationTask.user_id == current_user.id,
        )
        .first()
    )

    if not task:
        raise HTTPException(status_code=404, detail="Generation task not found")

    response = {
        "task_id": task.id,
        "application_id": task.application_id,
        "status": task.status,
        "progress": task.progress,
        "total_docs": task.total_docs,
        "completed_docs": task.completed_docs,
        "created_at": task.created_at.isoformat(),
        "updated_at": task.updated_at.isoformat(),
    }

    if task.error_message:
        response["error_message"] = task.error_message

    # If completed, include the generated documents
    if task.status == "completed":
        application = (
            db.query(Application)
            .options(joinedload(Application.generated_documents))
            .filter(Application.id == application_id)
            .first()
        )
        if application:
            response["generated_documents"] = [
                {
                    "id": doc.id,
                    "doc_type": doc.doc_type,
                    "format": doc.format,
                    "created_at": doc.created_at.isoformat(),
                }
                for doc in application.generated_documents
            ]

    return response


@router.get("/{application_id}/job-description-pdf")
@limiter.limit("20/minute")
async def download_job_description_pdf(
    request: Request,
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate and download a PDF of the job description for archival purposes."""
    # Get application
    application = (
        db.query(Application)
        .filter(Application.id == application_id, Application.user_id == current_user.id)
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Bewerbung nicht gefunden.")

    # Get job offer details
    job_offer = None
    if application.job_offer_url:
        job_offer = (
            db.query(JobOffer)
            .filter(JobOffer.url == application.job_offer_url)
            .first()
        )

    # Create PDF in memory
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=18)

    # Container for the 'Flowable' objects
    elements = []

    # Define styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor='#1a1a1a',
        spaceAfter=12,
        alignment=TA_CENTER
    )
    company_style = ParagraphStyle(
        'CompanyStyle',
        parent=styles['Heading2'],
        fontSize=14,
        textColor='#4a4a4a',
        spaceAfter=20,
        alignment=TA_CENTER
    )
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=11,
        leading=14,
        textColor='#2a2a2a',
    )
    meta_style = ParagraphStyle(
        'MetaStyle',
        parent=styles['Normal'],
        fontSize=9,
        textColor='#666666',
        spaceAfter=6,
    )

    # Add content
    elements.append(Paragraph(application.job_title or "Job Posting", title_style))
    elements.append(Paragraph(application.company or "Company", company_style))
    elements.append(Spacer(1, 0.2*inch))

    # Add metadata
    if application.job_offer_url:
        elements.append(Paragraph(f"<b>URL:</b> {application.job_offer_url}", meta_style))

    saved_date = application.created_at.strftime("%Y-%m-%d %H:%M:%S UTC") if application.created_at else "N/A"
    elements.append(Paragraph(f"<b>Saved on:</b> {saved_date}", meta_style))
    elements.append(Spacer(1, 0.3*inch))

    # Add job description
    if job_offer and job_offer.description:
        elements.append(Paragraph("<b>Job Description:</b>", styles['Heading3']))
        elements.append(Spacer(1, 0.1*inch))

        # Split description into paragraphs and add each
        for para in job_offer.description.split('\n'):
            if para.strip():
                # Escape HTML special characters
                para_text = para.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                elements.append(Paragraph(para_text, normal_style))
                elements.append(Spacer(1, 0.1*inch))
    else:
        elements.append(Paragraph("<i>No job description available</i>", normal_style))

    # Build PDF
    doc.build(elements)

    # Prepare response
    buffer.seek(0)
    # Sanitize filename to prevent header injection
    safe_company = re.sub(r'[^\w\s-]', '', application.company or 'company')[:30]
    safe_title = re.sub(r'[^\w\s-]', '', application.job_title or 'job')[:30]
    safe_company = re.sub(r'[-\s]+', '_', safe_company)
    safe_title = re.sub(r'[-\s]+', '_', safe_title)
    filename = f"job_{safe_company}_{safe_title}.pdf"
    # Use RFC 5987 encoding for the filename
    encoded_filename = quote(filename, safe='')

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=\"{filename}\"; filename*=UTF-8''{encoded_filename}"
        }
    )


@router.get("/{application_id}/generation-tasks")
@limiter.limit("60/minute")
async def list_generation_tasks(
    request: Request,
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all generation tasks for an application."""
    # Verify application belongs to user
    application = (
        db.query(Application)
        .filter(Application.id == application_id, Application.user_id == current_user.id)
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Bewerbung nicht gefunden.")

    tasks = (
        db.query(GenerationTask)
        .filter(GenerationTask.application_id == application_id)
        .order_by(GenerationTask.created_at.desc())
        .all()
    )

    return {
        "application_id": application_id,
        "tasks": [
            {
                "task_id": task.id,
                "status": task.status,
                "progress": task.progress,
                "total_docs": task.total_docs,
                "completed_docs": task.completed_docs,
                "created_at": task.created_at.isoformat(),
                "updated_at": task.updated_at.isoformat(),
                "error_message": task.error_message,
            }
            for task in tasks
        ],
    }
