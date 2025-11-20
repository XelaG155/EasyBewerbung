from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, HttpUrl
from sqlalchemy.orm import Session
import requests
from urllib.parse import urlparse
from app.limiter import limiter
from bs4 import BeautifulSoup
from typing import Optional

from app.database import get_db
from app.models import JobOffer, User
from app.auth import get_current_user

router = APIRouter()


class JobAnalysisRequest(BaseModel):
    url: HttpUrl


class JobAnalysisResponse(BaseModel):
    title: Optional[str]
    company: Optional[str]
    description: Optional[str]
    requirements: Optional[str]
    url: str
    saved_id: Optional[int]


def scrape_job_offer(url: str) -> dict:
    """Scrape basic job information from a URL."""
    # Validate URL
    parsed = urlparse(url)
    if parsed.scheme not in ['http', 'https']:
        raise HTTPException(400, "Invalid URL scheme")
    if parsed.hostname in ['localhost', '127.0.0.1', '0.0.0.0']:
        raise HTTPException(400, "Local URLs not allowed")

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, "html.parser")

        # Try to extract title
        title = None
        title_tags = soup.find_all(["h1", "h2"], class_=lambda x: x and any(
            keyword in str(x).lower() for keyword in ["job", "title", "position", "role"]
        ))
        if title_tags:
            title = title_tags[0].get_text(strip=True)
        elif soup.find("h1"):
            title = soup.find("h1").get_text(strip=True)

        # Try to extract company name
        company = None
        company_tags = soup.find_all(class_=lambda x: x and any(
            keyword in str(x).lower() for keyword in ["company", "employer", "organization"]
        ))
        if company_tags:
            company = company_tags[0].get_text(strip=True)

        # Extract description (all paragraph text)
        description = ""
        paragraphs = soup.find_all("p")
        description = "\n".join([p.get_text(strip=True) for p in paragraphs[:10]])  # First 10 paragraphs

        return {
            "title": title,
            "company": company,
            "description": description[:1000] if description else None,  # Limit to 1000 chars
        }

    except requests.RequestException as e:
        raise HTTPException(
            status_code=400,
            detail=f"Could not fetch job offer: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error analyzing job offer: {str(e)}",
        )


@router.post("/analyze", response_model=JobAnalysisResponse)
@limiter.limit("5/minute")
async def analyze_job_offer(
    request: JobAnalysisRequest,
    request_obj: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Analyze a job offer from a URL by scraping the page content.
    Saves the job offer to the database for the current user.
    """
    url = str(request.url)

    # Scrape job information
    job_data = scrape_job_offer(url)

    # Save to database
    job_offer = JobOffer(
        user_id=current_user.id,
        url=url,
        title=job_data.get("title"),
        company=job_data.get("company"),
        description=job_data.get("description"),
    )

    db.add(job_offer)
    db.commit()
    db.refresh(job_offer)

    return JobAnalysisResponse(
        title=job_offer.title,
        company=job_offer.company,
        description=job_offer.description,
        requirements=None,  # TODO: Extract requirements from description
        url=job_offer.url,
        saved_id=job_offer.id,
    )
