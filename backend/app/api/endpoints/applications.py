from datetime import datetime, timezone
from typing import List, Optional
import os
import json
from io import BytesIO

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


def get_language_instruction(lang: str) -> str:
    """Get language-specific instructions for LLM prompts."""
    if lang in ["Deutsch (Schweiz)", "de-CH"]:
        return f"{lang} (IMPORTANT: Use Swiss German spelling with 'ss' instead of 'ß', as used in Switzerland)"
    return lang


def generate_document_prompt(doc_type: str, job_description: str, cv_text: str, application) -> Optional[str]:
    """Generate OpenAI prompt based on document type."""
    lang = application.documentation_language or 'English'
    lang_instruction = get_language_instruction(lang)

    prompts = {
        "COVER_LETTER": f"""Write a professional cover letter for this job application.
Job Details: {job_description}
Candidate CV: {cv_text}
Language: {lang_instruction}

Create a compelling cover letter with proper greeting, body, and closing.""",

        "motivational_letter_pdf": f"""Write a motivational letter for this job application.
Job: {job_description}
CV: {cv_text}
Language: {lang_instruction}

Write a formal motivational letter explaining why the candidate is motivated for this role.""",

        "tailored_cv_pdf": f"""Create a tailored CV summary for this specific job application.
Job: {job_description}
Original CV: {cv_text}
Language: {lang_instruction}

Rewrite the CV to emphasize experiences and skills most relevant to this job.""",

        "email_formal": f"""Write a formal email to submit a job application.
Job: {job_description}
Language: {lang_instruction}

Write a concise, professional email introducing the attached application documents.""",

        "email_linkedin": f"""Write a LinkedIn direct message to a recruiter for this position.
Job: {job_description}
CV Summary: {cv_text[:500]}
Language: {lang_instruction}

Write a brief, engaging LinkedIn message (max 200 words).""",

        "match_score_report": f"""Create a detailed match score report analyzing how well the candidate fits this job.
Job: {job_description}
CV: {cv_text}
Language: {lang_instruction}

Provide: Overall score (0-100), Key strengths (3-5), Gaps (2-4), Recommendations (2-3).""",

        "company_intelligence_briefing": f"""Create a company intelligence briefing for interview preparation.
Company: {job_description}
Language: {lang_instruction}

Research and summarize: Company overview, culture, recent news, strategic direction, interview tips.""",

        "interview_preparation_pack": f"""Create an interview preparation guide for this role.
Job: {job_description}
CV: {cv_text}
Language: {lang_instruction}

Include: Likely interview questions, STAR method answers, 30-second pitch, key talking points.""",

        "executive_summary": f"""Create an executive summary / personal profile for the candidate.
CV: {cv_text}
Target Role: {job_description}
Language: {lang_instruction}

Write a compelling 1-page executive summary highlighting career story and value proposition.""",

        "linkedin_optimization": f"""Provide LinkedIn profile optimization suggestions.
Current CV: {cv_text}
Target Industry/Role: {job_description}
Language: {lang_instruction}

Suggest: Improved About section, headline, key skills, and keywords for recruiter discovery.""",
    }

    return prompts.get(doc_type)


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


class ApplicationResponse(BaseModel):
    id: int
    job_title: str
    company: str
    job_offer_url: Optional[str]
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


def serialize_generated_document(doc: GeneratedDocument) -> dict:
    return {
        "id": doc.id,
        "doc_type": doc.doc_type,
        "format": doc.format,
        "storage_path": doc.storage_path,
        "content": doc.content,
        "created_at": doc.created_at,
    }


def serialize_application(app: Application, db: Session = None) -> dict:
    job_description = None
    if db and app.job_offer_url:
        job_offer = db.query(JobOffer).filter(JobOffer.url == app.job_offer_url).first()
        if job_offer:
            job_description = job_offer.description

    return {
        "id": app.id,
        "job_title": app.job_title,
        "company": app.company,
        "job_offer_url": app.job_offer_url,
        "job_description": job_description,
        "applied": app.applied,
        "applied_at": app.applied_at,
        "result": app.result,
        "ui_language": app.ui_language,
        "documentation_language": app.documentation_language,
        "company_profile_language": app.company_profile_language,
        "created_at": app.created_at,
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
    applications = (
        db.query(Application)
        .options(joinedload(Application.generated_documents))
        .filter(Application.user_id == current_user.id)
        .order_by(Application.created_at.desc())
        .all()
    )
    return [serialize_application(app, db) for app in applications]


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

        lines.append(
            f"{idx}. {app.company} – {app.job_title} | URL: {app.job_offer_url or 'n/a'} | "
            f"Applied: {applied_label} on {applied_date or 'n/a'} | Result: {result} | Documents: {documents}"
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

IMPORTANT: Read the ENTIRE CV carefully, including any language skills section, before identifying gaps.

Format your response as valid JSON only, no additional text."""

        response = client.chat.completions.create(
            model="gpt-5-nano",
            messages=[{"role": "user", "content": prompt}],
        )

        content = response.choices[0].message.content
        print(f"📝 OpenAI response: {content[:200]}...")

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
            existing_score.updated_at = datetime.now(timezone.utc)
        else:
            # Create new score
            new_score = MatchingScore(
                application_id=application_id,
                overall_score=result.get("overall_score", 0),
                strengths=json.dumps(result.get("strengths", [])),
                gaps=json.dumps(result.get("gaps", [])),
                recommendations=json.dumps(result.get("recommendations", [])),
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
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate matching score: {str(e)}")


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
    filename = f"job_{application.company}_{application.job_title}.pdf".replace(" ", "_").replace("/", "-")

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
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
