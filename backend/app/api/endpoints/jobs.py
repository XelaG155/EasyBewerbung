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
import traceback
from app.limiter import limiter
from bs4 import BeautifulSoup
from typing import Optional
from weasyprint import HTML
from openai import OpenAI

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


def clean_job_title_with_ai(raw_title: str) -> str:
    """
    Use OpenAI to extract a clean job title from potentially messy text.
    Falls back to the original title if AI processing fails.
    """
    # If title is already short and clean, don't waste API calls
    if len(raw_title) < 80 and not any(keyword in raw_title.lower() for keyword in ["save", "apply", "easy apply", "ago", "publication"]):
        return raw_title

    try:
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a job title extractor. Extract ONLY the actual job title from the given text. Remove any UI elements, dates, locations, metadata, company names, or extra information. Return only the clean job title, nothing else. If you cannot find a clear job title, return the text as-is."
                },
                {
                    "role": "user",
                    "content": f"Extract the job title from this text:\n\n{raw_title}"
                }
            ],
            temperature=0,
            max_tokens=100
        )

        cleaned_title = response.choices[0].message.content.strip()

        # Validate the cleaned title is reasonable
        if cleaned_title and len(cleaned_title) > 3 and len(cleaned_title) < 200:
            return cleaned_title
        else:
            return raw_title

    except Exception as e:
        print(f"⚠️ Warning: AI title cleaning failed: {str(e)}")
        return raw_title


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
            allow_redirects=True
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

        # Limit title length and clean up (job titles are typically short)
        if title and len(title) > 200:
            # If title is too long, try to extract just the first line or sentence
            first_line = title.split('\n')[0]
            if len(first_line) > 20:  # Ensure the first line is meaningful
                title = first_line[:200]
            else:
                title = title[:200]

        # Use AI to clean up the title if it looks messy
        if title:
            title = clean_job_title_with_ai(title)

        # Try to extract company name
        company = None
        company_tags = soup.find_all(class_=lambda x: x and any(
            keyword in str(x).lower() for keyword in ["company", "employer", "organization"]
        ))
        if company_tags:
            company = sanitize_html_text(company_tags[0].get_text(strip=True))

        # Limit company name length (company names are typically short)
        if company and len(company) > 150:
            first_line = company.split('\n')[0]
            if len(first_line) > 10:
                company = first_line[:150]
            else:
                company = company[:150]

        # Try to extract location/place of work
        location = None
        location_tags = soup.find_all(class_=lambda x: x and any(
            keyword in str(x).lower() for keyword in ["location", "place", "city", "address", "workplace"]
        ))
        if location_tags:
            location = sanitize_html_text(location_tags[0].get_text(strip=True))

        # Limit location length (locations are typically short)
        if location and len(location) > 100:
            first_line = location.split('\n')[0]
            if len(first_line) > 10:
                location = first_line[:100]
            else:
                location = location[:100]

        # Extract description (preserving structure including lists)
        description = ""

        # Remove script and style elements before extracting text
        for script in soup(["script", "style", "nav", "header", "footer", "aside"]):
            script.decompose()

        # Find the main content area (job description is often in main, article, or specific div)
        main_content = soup.find("main") or soup.find("article") or soup.find("div", class_=lambda x: x and any(
            keyword in str(x).lower() for keyword in ["job-description", "job_description", "job-posting", "vacancy"]
        ))

        # Get content elements from main content if found, otherwise from whole page
        content_area = main_content if main_content else soup

        # Extract structured content (paragraphs, lists, headers)
        content_parts = []
        elements_processed = 0

        # Process common content elements in order
        for element in content_area.find_all(['p', 'ul', 'ol', 'h2', 'h3', 'h4', 'li']):
            # Skip if we've processed enough content
            if elements_processed >= MAX_PARAGRAPHS_TO_CHECK * 2:
                break

            # Skip if element is inside another list item (to avoid duplicates)
            if element.name == 'li' and element.find_parent(['ul', 'ol']) in content_area.find_all(['ul', 'ol']):
                continue

            text = element.get_text(separator=" ", strip=True)

            # Filter out short UI texts and button-like content
            if len(text) < MIN_PARAGRAPH_LENGTH or any(keyword in text.lower() for keyword in FILTER_KEYWORDS):
                continue

            # Sanitize the text to prevent XSS
            sanitized_text = sanitize_html_text(text)
            if not sanitized_text:
                continue

            # Process based on element type
            if element.name in ['h2', 'h3', 'h4']:
                # Headers
                content_parts.append(f"\n{sanitized_text}\n")
                elements_processed += 1
            elif element.name in ['ul', 'ol']:
                # Lists - extract each list item with bullet
                list_items = element.find_all('li', recursive=False)
                for li in list_items:
                    li_text = li.get_text(separator=" ", strip=True)
                    sanitized_li = sanitize_html_text(li_text)
                    if sanitized_li and len(sanitized_li) > 10:  # Minimum length for list items
                        content_parts.append(f"- {sanitized_li}")
                        elements_processed += 1
                content_parts.append("")  # Add spacing after list
            elif element.name == 'p':
                # Paragraphs
                content_parts.append(sanitized_text)
                content_parts.append("")  # Add spacing after paragraph
                elements_processed += 1

            if len(content_parts) >= MAX_GOOD_PARAGRAPHS * 3:
                break

        description = "\n".join(content_parts).strip()

        return {
            "title": title,
            "company": company,
            "location": location,
            "description": description[:MAX_DESCRIPTION_LENGTH] if description else None,
            "html_content": response.text,  # Include original HTML for PDF generation
        }

    except requests.Timeout:
        raise HTTPException(
            status_code=400,
            detail="Request timed out while fetching job offer",
        )
    except requests.RequestException:
        raise HTTPException(
            status_code=400,
            detail="Could not fetch job offer. Please check the URL and try again.",
        )
    except Exception as e:
        print(f"❌ ERROR in scrape_job_offer: {str(e)}")
        print(f"❌ Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail="Error analyzing job offer. Please try again later.",
        )


@router.get("/")
async def list_job_offers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List all job offers for the current user.
    """
    job_offers = db.query(JobOffer).filter(
        JobOffer.user_id == current_user.id
    ).order_by(JobOffer.created_at.desc()).all()

    return [
        {
            "id": job.id,
            "url": job.url,
            "title": job.title,
            "company": job.company,
            "location": job.location,
            "description": job.description,
            "has_pdf": job.original_pdf_path is not None,
            "created_at": job.created_at.isoformat() if job.created_at else None,
        }
        for job in job_offers
    ]


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
    try:
        url = str(job_data.url)
        print(f"🔍 Analyzing job offer: {url}")

        # Scrape job information
        scraped_data = scrape_job_offer(url)
        print(f"✅ Job scraped successfully: {scraped_data.get('title')}")

        # Save original HTML as PDF
        html_content = scraped_data.get("html_content")
        original_pdf_path = None
        if html_content:
            original_pdf_path = save_original_pdf(
                html_content,
                current_user.id,
                scraped_data.get("title")
            )
            print(f"📄 PDF saved: {original_pdf_path}")

        # Format title as: <Job Title> - <company>, <place of work>
        raw_title = scraped_data.get("title")
        company = scraped_data.get("company")
        location = scraped_data.get("location")

        # Build formatted title
        formatted_title = raw_title if raw_title else "Job Offer"
        if company or location:
            formatted_title = f"{formatted_title} -"
            if company:
                formatted_title = f"{formatted_title} {company}"
            if location:
                separator = "," if company else ""
                formatted_title = f"{formatted_title}{separator} {location}"

        # Save to database
        job_offer = JobOffer(
            user_id=current_user.id,
            url=url,
            title=formatted_title,
            company=company,
            location=location,
            description=scraped_data.get("description"),
            original_pdf_path=original_pdf_path,
        )

        db.add(job_offer)
        db.commit()
        db.refresh(job_offer)
        print(f"💾 Job saved to database with ID: {job_offer.id}")

        return JobAnalysisResponse(
            title=job_offer.title,
            company=job_offer.company,
            description=job_offer.description,
            requirements=None,  # TODO: Extract requirements from description
            url=job_offer.url,
            saved_id=job_offer.id,
        )
    except HTTPException:
        # Re-raise HTTP exceptions (from scrape_job_offer)
        raise
    except Exception as e:
        print(f"❌ ERROR in analyze_job_offer endpoint: {str(e)}")
        print(f"❌ Traceback: {traceback.format_exc()}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Error analyzing job offer. Please try again later.",
        )


@router.delete("/{job_offer_id}")
async def delete_job_offer(
    job_offer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete a job offer and its associated PDF file.
    """
    # Get the job offer
    job_offer = db.query(JobOffer).filter(
        JobOffer.id == job_offer_id,
        JobOffer.user_id == current_user.id
    ).first()

    if not job_offer:
        raise HTTPException(status_code=404, detail="Job offer not found")

    # Delete the PDF file if it exists
    if job_offer.original_pdf_path and os.path.exists(job_offer.original_pdf_path):
        try:
            os.remove(job_offer.original_pdf_path)
            print(f"🗑️ Deleted PDF file: {job_offer.original_pdf_path}")
        except Exception as e:
            print(f"⚠️ Warning: Failed to delete PDF file: {str(e)}")

    # Delete the job offer from database
    db.delete(job_offer)
    db.commit()
    print(f"🗑️ Deleted job offer ID: {job_offer_id}")

    return {"message": "Job offer deleted successfully", "id": job_offer_id}


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
