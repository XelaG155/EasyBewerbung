from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

class JobOfferCreate(BaseModel):
    url: str

@router.post("/analyze")
async def analyze_job(offer: JobOfferCreate):
    # TODO: Implement scraping logic
    return {"url": offer.url, "status": "received", "message": "Job offer received for analysis"}
