from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
import os
import json
import re
import logging
import traceback
from io import BytesIO
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session, joinedload
from openai import OpenAI
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.enums import TA_LEFT, TA_CENTER

from app.database import get_db
from app.document_catalog import ALLOWED_GENERATED_DOC_TYPES
from app.models import Application, GeneratedDocument, User, Document, JobOffer, MatchingScore, GenerationTask
from app.auth import get_current_user
from app.language_catalog import DEFAULT_LANGUAGE, normalize_language

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


def generate_document_prompt(doc_type: str, job_description: str, cv_text: str, application) -> Optional[str]:
    """Generate OpenAI prompt based on document type using JSON prompt templates."""

    # Get prompt configuration from JSON
    prompt_config = DOCUMENT_PROMPTS.get(doc_type)
    if not prompt_config:
        logging.warning(f"No prompt configuration found for document type: {doc_type}")
        return None

    # Get language settings
    lang = application.documentation_language or 'English'
    lang_instruction = get_language_instruction(lang)

    # Determine which language to use based on document type
    if doc_type == "company_intelligence_briefing":
        language_to_use = get_language_instruction(application.company_profile_language or lang)
    else:
        language_to_use = lang_instruction

    # Prepare input variables
    inputs = {
        "job_description": job_description,
        "cv_text": cv_text,
        "cv_summary": cv_text[:500] if len(cv_text) > 500 else cv_text,
        "language": language_to_use,
        "company_profile_language": get_language_instruction(application.company_profile_language or lang),
        "role": prompt_config.get("role", ""),
        "task": prompt_config.get("task", ""),
    }

    # Format instructions
    instructions_list = prompt_config.get("instructions", [])
    instructions_text = "\n".join([f"{i+1}. {instr}" for i, instr in enumerate(instructions_list)])
    inputs["instructions"] = instructions_text

    # Build prompt from template
    template = prompt_config.get("prompt_template", "")
    try:
        prompt = template.format(**inputs)
        return prompt
    except KeyError as e:
        logging.error(f"Missing variable in prompt template for {doc_type}: {e}")
        return None


def generate_documents_background(task_id: int, application_id: int, doc_types: List[str], user_id: int):
    """Background task to generate documents asynchronously."""
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        # Get the task
        task = db.query(GenerationTask).filter(GenerationTask.id == task_id).first()
        if not task:
            return

        # Update status to processing
        task.status = "processing"
        task.total_docs = len(doc_types)
        db.commit()

        # Get application and user data
        application = db.query(Application).filter(Application.id == application_id).first()
        if not application:
            task.status = "failed"
            task.error_message = "Application not found"
            db.commit()
            return

        # Get user's CV
        cv_doc = (
            db.query(Document)
            .filter(Document.user_id == user_id, Document.doc_type == "CV")
            .order_by(Document.created_at.desc())
            .first()
        )
        if not cv_doc or not cv_doc.content_text:
            task.status = "failed"
            task.error_message = "No CV found with text content"
            db.commit()
            return

        # Get job offer details
        job_offer = (
            db.query(JobOffer)
            .filter(JobOffer.url == application.job_offer_url)
            .first()
        )

        job_description = ""
        if job_offer:
            job_description = f"Title: {job_offer.title}\nCompany: {job_offer.company}\nDescription: {job_offer.description}"
        else:
            job_description = f"Title: {application.job_title}\nCompany: {application.company}"

        if application.opportunity_context:
            job_description += f"\nOpportunity Context: {application.opportunity_context}"

        if application.is_spontaneous:
            job_description += "\nThis is a spontaneous application without a specific posting."

        # Generate documents
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        for idx, doc_type in enumerate(doc_types):
            try:
                # Generate prompt based on document type
                prompt = generate_document_prompt(doc_type, job_description, cv_doc.content_text, application)

                if not prompt:
                    continue  # Skip unsupported types

                response = client.chat.completions.create(
                    model="gpt-5-nano",
                    messages=[{"role": "user", "content": prompt}],
                )

                content = response.choices[0].message.content

                # Save generated document
                gen_doc = GeneratedDocument(
                    application_id=application_id,
                    doc_type=doc_type,
                    format="TEXT",
                    storage_path=f"generated/app_{application_id}_{doc_type}.txt",
                    content=content,
                )
                db.add(gen_doc)

                # Update progress
                task.completed_docs = idx + 1
                task.progress = int((task.completed_docs / task.total_docs) * 100)
                db.commit()

            except Exception as e:
                # Log error but continue with other documents
                print(f"Error generating {doc_type}: {str(e)}")
                task.error_message = f"Partial failure: Error generating {doc_type}: {str(e)}"
                db.commit()

        # Mark as completed
        task.status = "completed"
        task.progress = 100
        db.commit()

    except Exception as e:
        # Fatal error
        if task:
            task.status = "failed"
            task.error_message = str(e)
            db.commit()
    finally:
        db.close()


class ApplicationCreate(BaseModel):
    job_title: str = Field(..., description="Role the candidate is targeting")
    company: str = Field(..., description="Company name for the application")
    job_offer_url: Optional[str] = Field(None, description="URL to the job offer or image link")
    is_spontaneous: bool = Field(False, description="Flag to mark spontaneous applications")
    opportunity_context: Optional[str] = Field(
        None, description="Context for spontaneous applications (e.g., target team, value proposition)"
    )
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


class ApplicationUpdate(BaseModel):
    applied: Optional[bool] = None
    applied_at: Optional[datetime] = None
    result: Optional[str] = None


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
async def create_application(
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
                detail="Not enough credits to start a generation",
            )

        user_for_update.credits -= 1

        application = Application(
            user_id=user_for_update.id,
            job_title=payload.job_title,
            company=payload.company,
            job_offer_url=payload.job_offer_url,
            is_spontaneous=payload.is_spontaneous,
            opportunity_context=payload.opportunity_context,
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
    return serialize_application(application, db)


@router.patch("/{application_id}", response_model=ApplicationResponse)
async def update_application(
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
        raise HTTPException(status_code=404, detail="Application not found")

    if payload.applied is not None:
        application.applied = payload.applied
    if payload.applied_at is not None:
        application.applied_at = payload.applied_at
    if payload.result is not None:
        application.result = payload.result

    db.commit()
    db.refresh(application)
    return serialize_application(application, db)


@router.post("/{application_id}/documents", response_model=ApplicationResponse)
async def attach_generated_documents(
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
        raise HTTPException(status_code=404, detail="Application not found")

    for doc in payload.documents:
        if doc.doc_type not in ALLOWED_GENERATED_DOC_TYPES:
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


@router.get("/history", response_model=List[ApplicationResponse])
async def list_application_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all applications for the current user."""
    try:
        print(f"📋 Fetching application history for user {current_user.id}")
        applications = (
            db.query(Application)
            .options(joinedload(Application.generated_documents))
            .filter(Application.user_id == current_user.id)
            .order_by(Application.created_at.desc())
            .all()
        )
        print(f"✅ Found {len(applications)} applications")

        # Efficiently load job descriptions using a single query
        # This prevents N+1 query problem
        job_urls = [app.job_offer_url for app in applications if app.job_offer_url]
        job_offers_map = {}
        if job_urls:
            job_offers = db.query(JobOffer).filter(JobOffer.url.in_(job_urls)).all()
            job_offers_map = {jo.url: jo.description for jo in job_offers}
            print(f"✅ Loaded {len(job_offers_map)} job descriptions")

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

        print(f"✅ Serialized {len(result)} applications successfully")
        return result
    except Exception as e:
        print(f"❌ ERROR in list_application_history: {str(e)}")
        print(f"❌ Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail="Error loading application history. Please try again later.",
        )


@router.get("/rav-report", response_model=dict)
async def rav_report(
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
async def get_application(
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
        raise HTTPException(status_code=404, detail="Application not found")
    return serialize_application(application, db)

@router.get("/{application_id}/matching-score")
async def get_matching_score(
    application_id: int,
    recalculate: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get or calculate matching score between user's CV and job requirements."""
    # Get application
    application = (
        db.query(Application)
        .filter(Application.id == application_id, Application.user_id == current_user.id)
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Check if we already have a matching score (unless recalculate is requested)
    if not recalculate:
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
            }

    # Get user's CV
    cv_doc = (
        db.query(Document)
        .filter(Document.user_id == current_user.id, Document.doc_type == "CV")
        .order_by(Document.created_at.desc())
        .first()
    )
    if not cv_doc or not cv_doc.content_text:
        raise HTTPException(status_code=400, detail="No CV found with text content")

    # Get job offer details
    job_offer = (
        db.query(JobOffer)
        .filter(JobOffer.url == application.job_offer_url)
        .first()
    )

    job_description = ""
    if job_offer:
        job_description = f"Title: {job_offer.title}\nCompany: {job_offer.company}\nDescription: {job_offer.description}"
    else:
        job_description = f"Title: {application.job_title}\nCompany: {application.company}"

    if application.opportunity_context:
        job_description += f"\nOpportunity Context: {application.opportunity_context}"

    if application.is_spontaneous:
        job_description += "\nThis is a spontaneous application without a specific posting."

    # Use OpenAI to calculate matching score
    try:
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        prompt = f"""Analyze how well this CV matches the job requirements. Provide a detailed matching analysis.

Job Details:
{job_description}

Candidate CV (Full):
{cv_doc.content_text}

Please provide a JSON response with:
1. overall_score: A number from 0-100 representing the overall match
2. strengths: Array of 3-5 key strengths/matches
3. gaps: Array of 2-4 areas where the candidate may not fully meet requirements
4. recommendations: Array of 2-3 recommendations for the application
5. story: A concise, 3-6 sentence narrative that addresses potential fit concerns. If the candidate appears overqualified, craft a respectful rationale for stepping into the role that focuses on positive motivations (e.g., desire to mentor, deliver impact quickly, appreciate stability or hands-on work) without criticizing their current employer or manager. If their current role, title, or experience differs from the job requirements, highlight transferable skills, relevant achievements, and a credible motivation for the transition that would reassure ATS/HR and hiring managers. If neither applies, provide a brief storyline that frames their profile positively for the role.

IMPORTANT: Read the ENTIRE CV carefully, including any language skills section, before identifying gaps.

Format your response as valid JSON only, no additional text."""

        response = client.chat.completions.create(
            model="gpt-5-nano",
            messages=[{"role": "user", "content": prompt}],
        )

        content = response.choices[0].message.content

        # Try to parse JSON, handle cases where OpenAI adds markdown formatting
        if content.startswith("```json"):
            content = content.replace("```json", "").replace("```", "").strip()
        elif content.startswith("```"):
            content = content.replace("```", "").strip()

        result = json.loads(content)

        # Save or update the matching score in the database
        existing_score = (
            db.query(MatchingScore)
            .filter(MatchingScore.application_id == application_id)
            .first()
        )

        if existing_score:
            # Update existing score
            existing_score.overall_score = result.get("overall_score", 0)
            existing_score.strengths = json.dumps(result.get("strengths", []))
            existing_score.gaps = json.dumps(result.get("gaps", []))
            existing_score.recommendations = json.dumps(result.get("recommendations", []))
            existing_score.story = result.get("story")
            existing_score.updated_at = datetime.now(timezone.utc)
        else:
            # Create new score
            new_score = MatchingScore(
                application_id=application_id,
                overall_score=result.get("overall_score", 0),
                strengths=json.dumps(result.get("strengths", [])),
                gaps=json.dumps(result.get("gaps", [])),
                recommendations=json.dumps(result.get("recommendations", [])),
                story=result.get("story"),
            )
            db.add(new_score)

        db.commit()

        return {
            "application_id": application_id,
            "job_title": application.job_title,
            "company": application.company,
            "overall_score": result.get("overall_score", 0),
            "strengths": result.get("strengths", []),
            "gaps": result.get("gaps", []),
            "recommendations": result.get("recommendations", []),
            "story": result.get("story"),
        }

    except Exception as e:
        logging.error(f"Matching score calculation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate matching score. Please try again.")


@router.post("/{application_id}/generate")
async def generate_documents(
    application_id: int,
    doc_types: List[str],
    background_tasks: BackgroundTasks,
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
        raise HTTPException(status_code=404, detail="Application not found")

    # Check credits
    cost_per_doc = 1
    total_cost = len(doc_types) * cost_per_doc
    if current_user.credits < total_cost:
        raise HTTPException(status_code=402, detail=f"Insufficient credits. Need {total_cost}, have {current_user.credits}")

    # Verify CV exists
    cv_doc = (
        db.query(Document)
        .filter(Document.user_id == current_user.id, Document.doc_type == "CV")
        .order_by(Document.created_at.desc())
        .first()
    )
    if not cv_doc or not cv_doc.content_text:
        raise HTTPException(status_code=400, detail="No CV found with text content")

    # Deduct credits upfront
    current_user.credits -= total_cost

    # Create generation task
    task = GenerationTask(
        application_id=application_id,
        user_id=current_user.id,
        status="pending",
        total_docs=len(doc_types),
        completed_docs=0,
        progress=0,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    # Queue background job
    background_tasks.add_task(
        generate_documents_background,
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
        "remaining_credits": current_user.credits,
    }


@router.get("/{application_id}/generation-status/{task_id}")
async def get_generation_status(
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
async def download_job_description_pdf(
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
        raise HTTPException(status_code=404, detail="Application not found")

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
async def list_generation_tasks(
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
        raise HTTPException(status_code=404, detail="Application not found")

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
