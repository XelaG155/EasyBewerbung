"""Catalog of generated application documents and packages for EasyBewerbung."""
from typing import Dict, List, Set

# Individual document definitions
ESSENTIAL_PACK = [
    {
        "key": "tailored_cv_pdf",
        "title": "Tailored CV (ATS-friendly PDF)",
        "outputs": ["PDF"],
        "description": "Structured for ATS parsing with clear headings and factual alignment to the job offer.",
        "notes": "Marks sections that were adapted for the specific role.",
    },
    {
        "key": "tailored_cv_editable",
        "title": "Tailored CV (Editable)",
        "outputs": ["DOCX"],
        "description": "Editable version of the tailored CV for last-minute tweaks.",
        "notes": "Includes comments explaining each adaptation.",
    },
    {
        "key": "tailored_cv_one_page",
        "title": "Tailored CV (1-page)",
        "outputs": ["PDF"],
        "description": "Concise CV variant for roles that insist on short submissions.",
        "notes": "Highlights only the most relevant experience and skills.",
    },
    {
        "key": "motivational_letter_pdf",
        "title": "Motivational Letter (PDF)",
        "outputs": ["PDF"],
        "description": "Region-ready motivational letter (DE/CH/FR friendly) tailored to the posting.",
        "notes": "Uses facts from the candidate profile and 1–2 company-specific points.",
    },
    {
        "key": "motivational_letter_editable",
        "title": "Motivational Letter (Editable)",
        "outputs": ["DOCX"],
        "description": "Editable version of the motivational letter for custom edits.",
        "notes": "Same content as PDF, ready for user adjustments.",
    },
    {
        "key": "email_formal",
        "title": "Email / Accompanying Message (formal)",
        "outputs": ["Text"],
        "description": "Formal email template to submit the application via email.",
        "notes": "Contains greeting, concise pitch, and attachment references.",
    },
    {
        "key": "email_linkedin",
        "title": "LinkedIn DM message",
        "outputs": ["Text"],
        "description": "Short recruiter outreach tailored to the posting.",
        "notes": "Optimized for brevity and clarity in LinkedIn messaging.",
    },
    {
        "key": "match_score_report",
        "title": "Match Score Report",
        "outputs": ["PDF"],
        "description": "ATS-style scorecard with strengths, gaps, and suggested improvements.",
        "notes": "Builds trust by surfacing both strengths and gaps.",
    },
]

HIGH_IMPACT_ADDONS = [
    {
        "key": "company_intelligence_briefing",
        "title": "Company Intelligence Briefing",
        "outputs": ["PDF"],
        "description": "1–2 page brief covering company overview, culture signals, and strategic talking points.",
        "notes": "Includes lightweight SWOT and hiring patterns.",
    },
    {
        "key": "interview_preparation_pack",
        "title": "Interview Preparation Pack",
        "outputs": ["PDF"],
        "description": "Interview questions, tailored answers, STAR examples, and a 30s pitch.",
        "notes": "Includes a quick-read cheat sheet for day-of prep.",
    },
    {
        "key": "role_specific_portfolio",
        "title": "Role-Specific Portfolio Page",
        "outputs": ["PDF"],
        "description": "Single-page portfolio of achievements mapped to the job requirements.",
        "notes": "Great for tech, marketing, HR, or consulting roles.",
    },
    {
        "key": "linkedin_optimization",
        "title": "LinkedIn Optimization Output",
        "outputs": ["Text"],
        "description": "Updated About section plus suggested job titles and keywords.",
        "notes": "Improves recruiter discovery.",
    },
]

PREMIUM_DOCUMENTS = [
    {
        "key": "executive_summary",
        "title": "Executive Summary / Personal Profile",
        "outputs": ["PDF"],
        "description": "1-page career story with value proposition, achievements, and QR code slot.",
        "notes": "Perfect for seniors, managers, and consultants.",
    },
    {
        "key": "skill_gap_report",
        "title": "Skill Gap & Upskilling Recommendation Report",
        "outputs": ["PDF"],
        "description": "Maps missing skills, flags what matters, and suggests courses.",
        "notes": "Positions EasyBewerbung as a long-term partner.",
    },
    {
        "key": "reference_summary",
        "title": "AI-Verified Reference Summary",
        "outputs": ["PDF"],
        "description": "Consolidated strengths extracted from reference letters with optional recommendation line.",
        "notes": "Differentiator that builds trust.",
    },
]

PACKAGES = [
    {
        "name": "Basic Pack",
        "credit_band": "Low",
        "includes": [
            "tailored_cv_pdf",
            "motivational_letter_pdf",
            "email_formal",
        ],
        "description": "Foundation for any application: tailored CV, motivational letter, and email message.",
    },
    {
        "name": "Professional Pack",
        "credit_band": "Medium",
        "includes": [
            "tailored_cv_pdf",
            "tailored_cv_editable",
            "motivational_letter_pdf",
            "email_formal",
            "match_score_report",
            "company_intelligence_briefing",
        ],
        "description": "Adds the editable CV, match score report, and company briefing for stronger submissions.",
    },
    {
        "name": "Premium Pack",
        "credit_band": "High",
        "includes": [
            "tailored_cv_pdf",
            "tailored_cv_editable",
            "tailored_cv_one_page",
            "motivational_letter_pdf",
            "email_formal",
            "match_score_report",
            "company_intelligence_briefing",
            "interview_preparation_pack",
            "skill_gap_report",
            "executive_summary",
            "linkedin_optimization",
        ],
        "description": "Full suite including interview prep, skill gap insights, executive summary, and LinkedIn tuning.",
    },
]

DOCUMENT_CATALOG: Dict[str, List[dict]] = {
    "essential_pack": ESSENTIAL_PACK,
    "high_impact_addons": HIGH_IMPACT_ADDONS,
    "premium_documents": PREMIUM_DOCUMENTS,
}

DOCUMENT_PACKAGES: List[dict] = PACKAGES

ALLOWED_GENERATED_DOC_TYPES: Set[str] = {
    item["key"]
    for section in [ESSENTIAL_PACK, HIGH_IMPACT_ADDONS, PREMIUM_DOCUMENTS]
    for item in section
}
