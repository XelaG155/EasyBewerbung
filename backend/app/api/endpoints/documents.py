from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
import shutil
import os

from app.database import get_db
from app.models import Document
from app.document_catalog import DOCUMENT_CATALOG, DOCUMENT_PACKAGES

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    file_location = f"{UPLOAD_DIR}/{file.filename}"
    try:
        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {e}")

    document = Document(
        filename=file.filename,
        file_path=file_location,
        doc_type="UNKNOWN",
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    return {
        "id": document.id,
        "filename": document.filename,
        "location": document.file_path,
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
async def list_documents(db: Session = Depends(get_db)):
    documents = db.query(Document).order_by(Document.created_at.desc()).all()
    return [
        {
            "id": doc.id,
            "filename": doc.filename,
            "location": doc.file_path,
            "doc_type": doc.doc_type,
            "created_at": doc.created_at,
        }
        for doc in documents
    ]
