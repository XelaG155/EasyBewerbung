from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, HttpUrl
from sqlalchemy.orm import Session
import requests
from urllib.parse import urlparse
import ipaddress
import socket
import re
import os
import uuid
from app.limiter import limiter
from bs4 import BeautifulSoup
from typing import Optional
from weasyprint import HTML

from app.database import get_db
from app.models import JobOffer, User
from app.auth import get_current_user

router = APIRouter()

# Constants for scraping configuration
MAX_PARAGRAPHS_TO_CHECK = 15
MIN_PARAGRAPH_LENGTH = 30
MAX_GOOD_PARAGRAPHS = 10
MAX_DESCRIPTION_LENGTH = 2000
REQUEST_TIMEOUT = 10

# Filter keywords for common UI elements
FILTER_KEYWORDS = [
    "hire now", "apply now", "salary estimator",
    "cookies", "privacy policy", "terms of service",
    "share this job", "save job", "report job",
    "sign in", "log in", "register", "subscribe"
]

# Allowed URL schemes
ALLOWED_SCHEMES = ['http', 'https']

# Private IP ranges to block (SSRF protection)
PRIVATE_IP_RANGES = [
    ipaddress.ip_network('10.0.0.0/8'),
    ipaddress.ip_network('172.16.0.0/12'),
    ipaddress.ip_network('192.168.0.0/16'),
    ipaddress.ip_network('127.0.0.0/8'),
    ipaddress.ip_network('169.254.0.0/16'),
    ipaddress.ip_network('::1/128'),
    ipaddress.ip_network('fc00::/7'),
    ipaddress.ip_network('fe80::/10'),
]


class JobAnalysisRequest(BaseModel):
    url: HttpUrl


class JobAnalysisResponse(BaseModel):
    title: Optional[str]
    company: Optional[str]
    description: Optional[str]
    requirements: Optional[str]
    url: str
    saved_id: Optional[int]


def validate_url_safety(url: str) -> None:
    """
    Validate URL to prevent SSRF attacks.
    Raises HTTPException if URL is not safe.
    """
    parsed = urlparse(url)

    # Check scheme
    if parsed.scheme not in ALLOWED_SCHEMES:
        raise HTTPException(400, "Invalid URL scheme. Only http and https are allowed.")

    # Check hostname exists
    if not parsed.hostname:
        raise HTTPException(400, "Invalid URL: no hostname")

    # Block localhost and common localhost aliases
    blocked_hosts = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '::1']
    if parsed.hostname.lower() in blocked_hosts:
        raise HTTPException(400, "Local URLs are not allowed")

    # Check for IP address format first
    try:
        ip = ipaddress.ip_address(parsed.hostname.strip('[]'))
        for private_range in PRIVATE_IP_RANGES:
            if ip in private_range:
                raise HTTPException(400, "Private IP addresses are not allowed")
    except ValueError:
        # Not an IP address, it's a hostname - resolve it to check
        pass

    # Resolve hostname to IP and verify it doesn't point to private ranges
    # This prevents DNS rebinding attacks
    try:
        resolved_ips = socket.getaddrinfo(parsed.hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        for family, socktype, proto, canonname, sockaddr in resolved_ips:
            ip_str = sockaddr[0]
            try:
                ip = ipaddress.ip_address(ip_str)
                for private_range in PRIVATE_IP_RANGES:
                    if ip in private_range:
                        raise HTTPException(400, "URL resolves to a private IP address")
            except ValueError:
                continue
    except socket.gaierror:
        raise HTTPException(400, "Could not resolve hostname")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, "Invalid URL format")


def sanitize_html_text(text: str) -> str:
    """
    Sanitize text extracted from HTML to prevent XSS.
    Removes any remaining HTML tags and dangerous characters.
    """
    # Remove any HTML tags that might have slipped through
    text = re.sub(r'<[^>]+>', '', text)
    # Remove script-like content
    text = re.sub(r'<script.*?</script>', '', text, flags=re.DOTALL | re.IGNORECASE)
    # Remove event handlers
    text = re.sub(r'on\w+\s*=\s*["\'][^"\']*["\']', '', text, flags=re.IGNORECASE)
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def save_original_pdf(html_content: str, user_id: int, job_title: str = None) -> str:
    """
    Save the original HTML content as a PDF file.
    Returns the file path where the PDF is saved.
    """
    # Create directory for job listing PDFs
    pdf_dir = os.path.join("uploads", str(user_id), "job_listings")
    os.makedirs(pdf_dir, exist_ok=True)

    # Generate unique filename
    timestamp = uuid.uuid4().hex[:8]
    safe_title = re.sub(r'[^\w\s-]', '', job_title or 'job_listing')[:30]
    safe_title = re.sub(r'[-\s]+', '_', safe_title)
    filename = f"{safe_title}_{timestamp}.pdf"
    filepath = os.path.join(pdf_dir, filename)

    try:
        # Convert HTML to PDF using weasyprint
        HTML(string=html_content).write_pdf(filepath)
        return filepath
    except Exception as e:
        # If PDF conversion fails, log error but don't fail the entire job analysis
        print(f"Warning: Failed to save original PDF: {str(e)}")
        return None


def scrape_job_offer(url: str) -> dict:
    """
    Scrape basic job information from a URL.
    Includes SSRF protection and content sanitization.
    """
    # Validate URL for security (SSRF protection)
    validate_url_safety(url)

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        response = requests.get(
            url,
            headers=headers,
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True,
            max_redirects=3
        )
        response.raise_for_status()

        # Limit response size to prevent memory issues
        if len(response.content) > 5 * 1024 * 1024:  # 5MB limit
            raise HTTPException(400, "Response too large")

        soup = BeautifulSoup(response.content, "html.parser")

        # Try to extract title
        title = None
        title_tags = soup.find_all(["h1", "h2"], class_=lambda x: x and any(
            keyword in str(x).lower() for keyword in ["job", "title", "position", "role"]
        ))
        if title_tags:
            title = sanitize_html_text(title_tags[0].get_text(strip=True))
        elif soup.find("h1"):
            title = sanitize_html_text(soup.find("h1").get_text(strip=True))

        # Try to extract company name
        company = None
        company_tags = soup.find_all(class_=lambda x: x and any(
            keyword in str(x).lower() for keyword in ["company", "employer", "organization"]
        ))
        if company_tags:
            company = sanitize_html_text(company_tags[0].get_text(strip=True))

        # Extract description (all paragraph text)
        description = ""

        # Remove script and style elements before extracting text
        for script in soup(["script", "style", "nav", "header", "footer", "aside"]):
            script.decompose()

        # Find the main content area (job description is often in main, article, or specific div)
        main_content = soup.find("main") or soup.find("article") or soup.find("div", class_=lambda x: x and any(
            keyword in str(x).lower() for keyword in ["job-description", "job_description", "job-posting", "vacancy"]
        ))

        # Get paragraphs from main content if found, otherwise from whole page
        if main_content:
            paragraphs = main_content.find_all("p")
        else:
            paragraphs = soup.find_all("p")

        # Extract text from paragraphs, filtering out very short ones (likely UI elements)
        paragraph_texts = []
        for p in paragraphs[:MAX_PARAGRAPHS_TO_CHECK]:
            text = p.get_text(separator=" ", strip=True)
            # Filter out short UI texts and button-like content
            if len(text) > MIN_PARAGRAPH_LENGTH and not any(keyword in text.lower() for keyword in FILTER_KEYWORDS):
                # Sanitize the text to prevent XSS
                sanitized_text = sanitize_html_text(text)
                if sanitized_text:  # Only add if text remains after sanitization
                    paragraph_texts.append(sanitized_text)
            if len(paragraph_texts) >= MAX_GOOD_PARAGRAPHS:
                break

        description = "\n\n".join(paragraph_texts)

        return {
            "title": title,
            "company": company,
            "description": description[:MAX_DESCRIPTION_LENGTH] if description else None,
            "html_content": response.text,  # Include original HTML for PDF generation
        }

    except requests.Timeout:
        raise HTTPException(
            status_code=400,
            detail="Request timed out while fetching job offer",
        )
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
    request: Request,
    job_data: JobAnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Analyze a job offer from a URL by scraping the page content.
    Saves the job offer to the database for the current user.
    """
    url = str(job_data.url)

    # Scrape job information
    scraped_data = scrape_job_offer(url)

    # Save original HTML as PDF
    html_content = scraped_data.get("html_content")
    original_pdf_path = None
    if html_content:
        original_pdf_path = save_original_pdf(
            html_content,
            current_user.id,
            scraped_data.get("title")
        )

    # Save to database
    job_offer = JobOffer(
        user_id=current_user.id,
        url=url,
        title=scraped_data.get("title"),
        company=scraped_data.get("company"),
        description=scraped_data.get("description"),
        original_pdf_path=original_pdf_path,
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


@router.get("/{job_offer_id}/original-pdf")
async def download_original_pdf(
    job_offer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Download the original job listing PDF for a specific job offer.
    """
    # Get the job offer
    job_offer = db.query(JobOffer).filter(
        JobOffer.id == job_offer_id,
        JobOffer.user_id == current_user.id
    ).first()

    if not job_offer:
        raise HTTPException(status_code=404, detail="Job offer not found")

    if not job_offer.original_pdf_path:
        raise HTTPException(
            status_code=404,
            detail="Original PDF not available for this job offer"
        )

    if not os.path.exists(job_offer.original_pdf_path):
        raise HTTPException(
            status_code=404,
            detail="PDF file not found on server"
        )

    # Generate filename
    safe_title = re.sub(r'[^\w\s-]', '', job_offer.title or 'job_listing')[:30]
    safe_title = re.sub(r'[-\s]+', '_', safe_title)
    filename = f"{safe_title}_original.pdf"

    return FileResponse(
        path=job_offer.original_pdf_path,
        media_type="application/pdf",
        filename=filename
    )
