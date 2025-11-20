from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.document_catalog import ALLOWED_GENERATED_DOC_TYPES
from app.models import Application, GeneratedDocument

router = APIRouter()


class ApplicationCreate(BaseModel):
    job_title: str = Field(..., description="Role the candidate is targeting")
    company: str = Field(..., description="Company name for the application")
    job_offer_url: Optional[str] = Field(None, description="URL to the job offer or image link")
    applied: bool = False
    applied_at: Optional[datetime] = None
    result: Optional[str] = Field(None, description="Outcome (e.g., pending, interview, rejected, offer)")


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


def serialize_generated_document(doc: GeneratedDocument) -> dict:
    return {
        "id": doc.id,
        "doc_type": doc.doc_type,
        "format": doc.format,
        "storage_path": doc.storage_path,
        "created_at": doc.created_at,
    }


def serialize_application(app: Application) -> dict:
    return {
        "id": app.id,
        "job_title": app.job_title,
        "company": app.company,
        "job_offer_url": app.job_offer_url,
        "applied": app.applied,
        "applied_at": app.applied_at,
        "result": app.result,
        "created_at": app.created_at,
        "generated_documents": [serialize_generated_document(doc) for doc in app.generated_documents],
    }


@router.post("/", response_model=dict)
async def create_application(payload: ApplicationCreate, db: Session = Depends(get_db)):
    """Record a new application intent so we can attach generated documents to it."""
    applied_at = payload.applied_at
    if payload.applied and payload.applied_at is None:
        applied_at = datetime.utcnow()

    application = Application(
        job_title=payload.job_title,
        company=payload.company,
        job_offer_url=payload.job_offer_url,
        applied=payload.applied,
        applied_at=applied_at,
        result=payload.result,
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    return serialize_application(application)


@router.patch("/{application_id}", response_model=dict)
async def update_application(
    application_id: int, payload: ApplicationUpdate, db: Session = Depends(get_db)
):
    application = db.query(Application).get(application_id)
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
    return serialize_application(application)


@router.post("/{application_id}/documents", response_model=dict)
async def attach_generated_documents(
    application_id: int,
    payload: ApplicationDocumentBatch,
    db: Session = Depends(get_db),
):
    application = db.query(Application).options(joinedload(Application.generated_documents)).get(
        application_id
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
    return serialize_application(reloaded)


@router.get("/history", response_model=List[dict])
async def list_application_history(db: Session = Depends(get_db)):
    applications = (
        db.query(Application)
        .options(joinedload(Application.generated_documents))
        .order_by(Application.created_at.desc())
        .all()
    )
    return [serialize_application(app) for app in applications]


@router.get("/rav-report", response_model=dict)
async def rav_report(db: Session = Depends(get_db)):
    """Produce a copy/paste friendly report for Swiss RAV offices (Nachweis der persönlichen Arbeitsbemühungen)."""
    applications = (
        db.query(Application)
        .options(joinedload(Application.generated_documents))
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
        "generated_at": datetime.utcnow(),
    }


@router.get("/{application_id}", response_model=dict)
async def get_application(application_id: int, db: Session = Depends(get_db)):
    application = db.query(Application).options(joinedload(Application.generated_documents)).get(
        application_id
    )
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    return serialize_application(application)
