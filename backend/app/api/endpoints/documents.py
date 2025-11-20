from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
import shutil
import os
from ...models import Document, User
# from ...database import get_db # TODO: Implement database connection

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    file_location = f"{UPLOAD_DIR}/{file.filename}"
    try:
        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {e}")
    
    # TODO: Save metadata to DB
    return {"filename": file.filename, "location": file_location, "message": "File uploaded successfully"}

@router.get("/", response_model=List[dict])
async def list_documents():
    # TODO: Fetch from DB
    return []
