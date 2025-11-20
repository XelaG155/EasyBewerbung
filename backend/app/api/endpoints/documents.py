from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import shutil
import os
from pathlib import Path
from pypdf import PdfReader

from app.database import get_db
from app.models import Document, User
from app.document_catalog import DOCUMENT_CATALOG, DOCUMENT_PACKAGES
from app.auth import get_current_user

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# File validation constants
ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def extract_text_from_pdf(file_path: str) -> str:
    """Extract text content from a PDF file."""
    try:
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        return f"Error extracting text: {str(e)}"


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    doc_type: str = Form("CV"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a document (CV, reference, diploma, etc.)."""
    # Validate file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Create user-specific directory
    user_dir = os.path.join(UPLOAD_DIR, str(current_user.id))
    os.makedirs(user_dir, exist_ok=True)

    # Generate unique filename
    import uuid
    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    file_location = os.path.join(user_dir, unique_filename)

    # Save file and check size
    try:
        file_size = 0
        with open(file_location, "wb") as buffer:
            while chunk := await file.read(8192):  # Read in chunks
                file_size += len(chunk)
                if file_size > MAX_FILE_SIZE:
                    # Delete partially written file
                    os.remove(file_location)
                    raise HTTPException(
                        status_code=400,
                        detail=f"File too large. Maximum size: {MAX_FILE_SIZE / (1024*1024)}MB",
                    )
                buffer.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {e}")

    # Extract text if PDF
    content_text = None
    if file_ext == ".pdf":
        content_text = extract_text_from_pdf(file_location)

    # Save to database
    document = Document(
        user_id=current_user.id,
        filename=file.filename,
        file_path=file_location,
        doc_type=doc_type,
        content_text=content_text,
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    return {
        "id": document.id,
        "filename": document.filename,
        "doc_type": document.doc_type,
        "has_text": content_text is not None and len(content_text) > 0,
        "message": "File uploaded successfully",
    }


@router.get("/catalog")
async def document_catalog():
    """Expose the full catalog of documents and bundles the platform can generate."""
    return {
        "catalog": DOCUMENT_CATALOG,
        "packages": DOCUMENT_PACKAGES,
    }


@router.get("/", response_model=List[dict])
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all documents for the current user."""
    documents = (
        db.query(Document)
        .filter(Document.user_id == current_user.id)
        .order_by(Document.created_at.desc())
        .all()
    )
    return [
        {
            "id": doc.id,
            "filename": doc.filename,
            "doc_type": doc.doc_type,
            "has_text": doc.content_text is not None and len(doc.content_text) > 0,
            "created_at": doc.created_at.isoformat(),
        }
        for doc in documents
    ]


@router.delete("/{document_id}")
async def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a document."""
    document = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete file from disk
    try:
        if os.path.exists(document.file_path):
            os.remove(document.file_path)
    except Exception as e:
        # Log error but don't fail the request
        print(f"Error deleting file: {e}")

    # Delete from database
    db.delete(document)
    db.commit()

    return {"message": "Document deleted successfully"}
