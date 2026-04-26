"""
Celery tasks for EasyBewerbung background processing.

These tasks handle:
- Matching score calculation (CV vs job description analysis)
- Document generation (cover letters, briefings, etc.)
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import List

from openai import OpenAI

from app.celery_app import celery_app
from app.database import SessionLocal
from app.models import (
    Application,
    Document,
    DocumentTemplate,
    GeneratedDocument,
    GenerationTask,
    JobOffer,
    MatchingScore,
    MatchingScoreTask,
    User,
)


# Load per-document-type role / task / instructions from the canonical JSON
# on module import. This is the single source of truth for document-specific
# prompt components that fill {role}, {task}, {instructions} placeholders
# inside DocumentTemplate.prompt_template at generation time.
_PROMPTS_FILE = os.path.join(os.path.dirname(__file__), "document_prompts.json")
try:
    with open(_PROMPTS_FILE, "r", encoding="utf-8") as _f:
        DOCUMENT_PROMPTS: dict = json.load(_f)
except (FileNotFoundError, json.JSONDecodeError) as _e:
    logging.error("Could not load document_prompts.json: %s", _e)
    DOCUMENT_PROMPTS = {}


# Fallback values used when a document type is not present in document_prompts.json
# or the file cannot be read. Generic by design — the specific values live in JSON.
_FALLBACK_ROLE = "professional career consultant and CV/resume expert"
_FALLBACK_TASK = (
    "Help this candidate create compelling, honest, and effective job application documents"
)
_FALLBACK_INSTRUCTIONS = """
1. Be completely honest - NEVER invent skills, experiences, or qualifications
2. Only use information that exists in the candidate's CV
3. Optimize for the specific job requirements while staying truthful
4. Use professional, clear language appropriate for the target role
5. Highlight genuine strengths and relevant experience
6. Structure content for maximum impact and readability"""


def _resolve_prompt_components(doc_type: str) -> tuple[str, str, str]:
    """Return (role, task, instructions) for a doc_type from document_prompts.json
    with sensible fallbacks. Instructions are rendered as a numbered list.
    """
    config = DOCUMENT_PROMPTS.get(doc_type) or {}
    role = config.get("role") or _FALLBACK_ROLE
    task = config.get("task") or _FALLBACK_TASK

    raw_instructions = config.get("instructions")
    if isinstance(raw_instructions, list) and raw_instructions:
        # Render as a numbered list, but preserve section dividers that already
        # start with "===" so the LLM keeps the visual structure.
        lines = []
        step = 0
        for item in raw_instructions:
            if isinstance(item, str) and item.startswith("==="):
                lines.append("")
                lines.append(item)
            elif isinstance(item, str):
                step += 1
                lines.append(f"{step}. {item}")
        instructions = "\n".join(lines).strip()
    else:
        instructions = _FALLBACK_INSTRUCTIONS

    return role, task, instructions


class LlmProviderUnavailable(RuntimeError):
    """Raised when an admin picked a provider for a template whose SDK is not
    installed or whose API key is not configured. The error message is written
    to ``GenerationTask.error_message`` so the admin sees WHY generation failed
    instead of receiving an empty document."""


def get_llm_client(provider: str, model: str):
    """Return an initialized client for the requested provider.

    Raises ``LlmProviderUnavailable`` with a clear, actionable German message
    when the SDK is missing or the API key is not set. The caller (Celery task)
    is expected to surface the error to the admin via ``GenerationTask``.
    """
    if provider == "openai":
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise LlmProviderUnavailable(
                "OPENAI_API_KEY ist nicht gesetzt. Bitte den Key in der .env "
                "ergänzen und den Backend-Container neu starten."
            )
        return OpenAI(api_key=api_key), model

    if provider == "anthropic":
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise LlmProviderUnavailable(
                "ANTHROPIC_API_KEY ist nicht gesetzt. Das Template verweist auf "
                f"das Anthropic-Modell '{model}', aber der Key fehlt in der .env."
            )
        try:
            import anthropic  # type: ignore
        except ImportError as exc:
            raise LlmProviderUnavailable(
                "Das anthropic SDK ist im Backend-Container nicht installiert. "
                "Bitte 'anthropic>=0.39' in backend/requirements.txt ergänzen "
                "und den Container neu bauen."
            ) from exc
        return anthropic.Anthropic(api_key=api_key), model

    if provider == "google":
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise LlmProviderUnavailable(
                "GOOGLE_API_KEY ist nicht gesetzt. Das Template verweist auf "
                f"das Gemini-Modell '{model}', aber der Key fehlt in der .env."
            )
        try:
            import google.generativeai as genai  # type: ignore
        except ImportError as exc:
            raise LlmProviderUnavailable(
                "Das google-generativeai SDK ist im Backend-Container nicht "
                "installiert. Bitte 'google-generativeai' in backend/requirements.txt "
                "ergänzen und den Container neu bauen."
            ) from exc
        genai.configure(api_key=api_key)
        return genai, model

    raise LlmProviderUnavailable(
        f"Unbekannter LLM-Provider '{provider}'. Unterstützt werden: "
        "openai, anthropic, google."
    )


def generate_with_llm(client, model: str, provider: str, prompt: str) -> str:
    """Generate content using the specified LLM provider.

    Dispatches per provider. Raises ``LlmProviderUnavailable`` (or lets the
    underlying provider exception propagate) rather than silently returning
    an empty string, so failures are visible in ``GenerationTask.error_message``.
    """
    if provider == "openai":
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content or ""

    if provider == "anthropic":
        # anthropic SDK >= 0.39 messages API
        response = client.messages.create(
            model=model,
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )
        # response.content is a list of content blocks; concatenate text blocks.
        parts: list[str] = []
        for block in getattr(response, "content", []) or []:
            text = getattr(block, "text", None)
            if text:
                parts.append(text)
        return "".join(parts)

    if provider == "google":
        # google-generativeai: client is the module, instantiate a model per-call
        model_instance = client.GenerativeModel(model)
        response = model_instance.generate_content(prompt)
        return getattr(response, "text", "") or ""

    raise LlmProviderUnavailable(
        f"Unbekannter LLM-Provider '{provider}' in generate_with_llm."
    )


def get_language_instruction(lang_code: str) -> str:
    """Convert language code to explicit LLM instruction with regional specifics.

    For German variants we default plain 'de' to Swiss Standard German
    orthography (ss instead of ß) because the platform is CH-focused.
    Users explicitly targeting Germany should use 'de-DE'.
    """
    language_instructions = {
        "de-CH": "Swiss Standard German (Schweizer Hochdeutsch) - CRITICAL: Use 'ss' instead of 'ß' throughout (e.g., 'Strasse' not 'Straße', 'Grüsse' not 'Grüße', 'dass' not 'daß'). Use formal 'Sie' form. NEVER write Swiss-German dialect (Mundart).",
        "de": "Swiss Standard German (Schweizer Hochdeutsch) - CRITICAL: Use 'ss' instead of 'ß' throughout. Use formal 'Sie' form. NEVER write dialect.",
        "de-DE": "German (Germany) - Use standard German orthography including 'ß' where appropriate. Use formal 'Sie' form unless the job posting clearly uses informal 'Du'.",
        "en": "English",
        "fr": "French (Français)",
        "it": "Italian (Italiano)",
        "es": "Spanish (Español)",
        "pt": "Portuguese (Português)",
    }
    return language_instructions.get(lang_code, lang_code)


# Document types whose recipient is the candidate themselves
# (not the recruiter / employer). These are written in the user's spoken
# language regardless of what language the job offer is in. Examples:
# interview prep, skill gap report, company briefing for the candidate's
# own preparation, etc.
#
# Documents NOT in this set go to the employer and are written in the
# job-offer language (Application.documentation_language).
CANDIDATE_FACING_DOC_TYPES = frozenset({
    "match_score_report",
    "company_intelligence_briefing",
    "interview_preparation_pack",
    "linkedin_optimization",
    "executive_summary",
    "skill_gap_report",
    "reference_summary",
    "role_specific_portfolio",
})


def _resolve_doc_language(template, application, user) -> str:
    """Pick the correct language code for a document based on its recipient.

    Resolution order:
    1. If ``template.language_source`` is explicitly set to one of the
       supported overrides, follow it.
    2. Otherwise, infer from doc_type: candidate-facing docs use the user's
       preferred language; employer-facing docs use the application's
       documentation language (which should match the job offer).
    3. Fall back to the user's documentation_language, then "en".
    """
    source = getattr(template, "language_source", None) or "documentation_language"
    doc_type = getattr(template, "doc_type", "") or ""

    user_lang = (
        getattr(user, "preferred_language", None)
        or getattr(user, "documentation_language", None)
        or "en"
    )
    job_lang = (
        getattr(application, "documentation_language", None)
        or getattr(user, "documentation_language", None)
        or user_lang
    )
    company_profile_lang = (
        getattr(application, "company_profile_language", None)
        or user_lang
    )

    # Explicit override on the template wins.
    if source == "preferred_language":
        return user_lang
    if source == "company_profile_language":
        return company_profile_lang
    if source == "mother_tongue":
        # Legacy option — treat as user-language until a dedicated field exists.
        return user_lang

    # Default ("documentation_language"): infer by recipient.
    if doc_type in CANDIDATE_FACING_DOC_TYPES:
        return user_lang
    return job_lang


# Document type translations for multi-language support
DOC_TYPE_TRANSLATIONS = {
    "COVER_LETTER": {
        "en": "Cover Letter",
        "de": "Bewerbungsschreiben",
        "de-CH": "Bewerbungsschreiben",
        "de-DE": "Bewerbungsschreiben",
        "fr": "Lettre de motivation",
        "it": "Lettera di presentazione",
        "es": "Carta de presentación",
        "pt": "Carta de apresentação",
    },
    "CV": {
        "en": "CV / Resume",
        "de": "Lebenslauf",
        "de-CH": "Lebenslauf",
        "de-DE": "Lebenslauf",
        "fr": "CV",
        "it": "Curriculum Vitae",
        "es": "Currículum Vitae",
        "pt": "Currículo",
    },
    "MOTIVATION_LETTER": {
        "en": "Motivation Letter",
        "de": "Motivationsschreiben",
        "de-CH": "Motivationsschreiben",
        "de-DE": "Motivationsschreiben",
        "fr": "Lettre de motivation",
        "it": "Lettera motivazionale",
        "es": "Carta de motivación",
        "pt": "Carta de motivação",
    },
    "FOLLOW_UP": {
        "en": "Follow-up Email",
        "de": "Nachfass-E-Mail",
        "de-CH": "Nachfass-E-Mail",
        "de-DE": "Nachfass-E-Mail",
        "fr": "E-mail de relance",
        "it": "Email di follow-up",
        "es": "Correo de seguimiento",
        "pt": "Email de acompanhamento",
    },
    "THANK_YOU": {
        "en": "Thank You Letter",
        "de": "Dankschreiben",
        "de-CH": "Dankschreiben",
        "de-DE": "Dankschreiben",
        "fr": "Lettre de remerciement",
        "it": "Lettera di ringraziamento",
        "es": "Carta de agradecimiento",
        "pt": "Carta de agradecimento",
    },
    "REFERENCE_REQUEST": {
        "en": "Reference Request",
        "de": "Referenzanfrage",
        "de-CH": "Referenzanfrage",
        "de-DE": "Referenzanfrage",
        "fr": "Demande de référence",
        "it": "Richiesta di referenze",
        "es": "Solicitud de referencia",
        "pt": "Pedido de referência",
    },
}


def get_doc_type_display(doc_type: str, lang_code: str, fallback_display_name: str = None) -> str:
    """Get localized display name for a document type.

    Args:
        doc_type: The document type key (e.g., 'COVER_LETTER')
        lang_code: The language code (e.g., 'de', 'de-CH', 'en')
        fallback_display_name: Optional fallback from template.display_name

    Returns:
        Localized display name for the document type
    """
    # Normalize language code (e.g., 'de-CH' -> check 'de-CH' first, then 'de')
    base_lang = lang_code.split("-")[0] if "-" in lang_code else lang_code

    if doc_type in DOC_TYPE_TRANSLATIONS:
        translations = DOC_TYPE_TRANSLATIONS[doc_type]
        # Try exact match first (e.g., 'de-CH')
        if lang_code in translations:
            return translations[lang_code]
        # Try base language (e.g., 'de')
        if base_lang in translations:
            return translations[base_lang]
        # Fall back to English
        if "en" in translations:
            return translations["en"]

    # If no translation found, use fallback or format doc_type
    if fallback_display_name:
        return fallback_display_name
    return doc_type.replace("_", " ").title()


def generate_document_prompt_from_template(
    template, job_description: str, cv_text: str, user, application, db=None
) -> str:
    """Generate a prompt from a database template."""
    try:
        prompt = template.prompt_template

        # Recipient-aware language resolution: candidate-facing docs (briefings,
        # interview prep, skill gaps) go in the user's language; employer-facing
        # docs (CV, cover letter, motivational letter, formal email) go in the
        # job-offer language. See CANDIDATE_FACING_DOC_TYPES and CLAUDE-2026.04.md.
        doc_lang = _resolve_doc_language(template, application, user)
        job_lang = (
            getattr(application, "documentation_language", None)
            or getattr(user, "documentation_language", None)
            or doc_lang
        )
        user_lang = (
            getattr(user, "preferred_language", None)
            or getattr(user, "documentation_language", None)
            or "en"
        )
        company_profile_lang = (
            getattr(application, "company_profile_language", None)
            or user_lang
        )

        language_instruction = get_language_instruction(doc_lang)
        job_language_instruction = get_language_instruction(job_lang)
        user_language_instruction = get_language_instruction(user_lang)
        company_profile_language_instruction = get_language_instruction(company_profile_lang)

        # Resolve per-document-type role/task/instructions from document_prompts.json.
        # Falls back to generic values when the doc_type is not present in the JSON.
        doc_type_key = getattr(template, "doc_type", "")
        role, task, instructions = _resolve_prompt_components(doc_type_key)

        # Get reference letters if user has any
        reference_letters = "No reference letters provided."
        if db and user:
            ref_docs = db.query(Document).filter(
                Document.user_id == user.id,
                Document.doc_type == "REFERENCE"
            ).all()
            if ref_docs:
                reference_letters = "\n\n".join([
                    f"--- Reference Letter {i+1} ---\n{doc.content_text or 'No text content'}"
                    for i, doc in enumerate(ref_docs)
                ])

        # CV summary is the first ~2000 chars of CV (for templates that need a brief version)
        # cv_summary is used by templates that want a shorter version for the
        # hook (e.g. email_linkedin, tailored_cv_one_page). For deep-analysis
        # templates like reference_summary / skill_gap_report / executive_summary
        # we use the full CV via {cv_text} instead — the deep prompts explicitly
        # instruct the LLM to read the full text.
        #
        # 10 000 characters is roughly 2500 tokens — generous enough for the
        # short-form templates without losing candidate context. For truly
        # long CVs we still truncate rather than silently send 50 pages to
        # the LLM, but the limit is now high enough that no realistic CV hits it.
        CV_SUMMARY_CHAR_LIMIT = 10_000
        cv_summary = (
            cv_text[:CV_SUMMARY_CHAR_LIMIT] + "..."
            if len(cv_text) > CV_SUMMARY_CHAR_LIMIT
            else cv_text
        )

        # Get document type info with localized display name
        doc_type = getattr(template, "doc_type", "document")
        fallback_display = getattr(template, "display_name", None)
        doc_type_display = get_doc_type_display(doc_type, doc_lang, fallback_display)

        # Replace all placeholders (single braces - matching template format).
        # Distinct placeholders so a single template can mix recipient-aware
        # language ({language}) with hard-coded job/user-language references
        # when needed (e.g. "summarise the German job offer in English").
        prompt = prompt.replace("{job_description}", job_description)
        prompt = prompt.replace("{cv_text}", cv_text)
        prompt = prompt.replace("{cv_summary}", cv_summary)
        prompt = prompt.replace("{language}", language_instruction)
        prompt = prompt.replace("{job_language}", job_language_instruction)
        prompt = prompt.replace("{user_language}", user_language_instruction)
        prompt = prompt.replace("{company_profile_language}", company_profile_language_instruction)
        prompt = prompt.replace("{documentation_language}", job_language_instruction)
        prompt = prompt.replace("{role}", role)
        prompt = prompt.replace("{task}", task)
        prompt = prompt.replace("{instructions}", instructions)
        prompt = prompt.replace("{reference_letters}", reference_letters)
        prompt = prompt.replace("{doc_type}", doc_type)
        prompt = prompt.replace("{doc_type_display}", doc_type_display)

        return prompt
    except Exception as e:
        logging.warning(f"Error generating prompt from template: {e}")
        return None


def generate_document_prompt(doc_type: str, job_description: str, cv_text: str, application) -> str:
    """Generate a fallback prompt for document types without templates."""
    prompts = {
        "COVER_LETTER": f"""Write a professional cover letter for this job application.

Job Details:
{job_description}

Candidate CV:
{cv_text}

Write a compelling cover letter that highlights relevant experience and enthusiasm for the role.
Format the output as plain text, ready to be used in an application.""",

        "COMPANY_BRIEFING": f"""Create a company briefing for job interview preparation.

Job Details:
{job_description}

Provide:
1. Company overview and culture
2. Key talking points for the interview
3. Questions to ask the interviewer
4. Industry context and recent news

Format as a structured briefing document.""",
    }
    return prompts.get(doc_type)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def calculate_matching_score_task(self, task_id: int, application_id: int, user_id: int, recalculate: bool = False):
    """
    Celery task to calculate matching score asynchronously.

    Analyzes how well a candidate's CV matches a job description using OpenAI.
    """
    db = SessionLocal()
    task = None

    try:
        # Get the task
        task = db.query(MatchingScoreTask).filter(MatchingScoreTask.id == task_id).first()
        if not task:
            logging.error(f"MatchingScoreTask {task_id} not found")
            return {"status": "failed", "error": "Task not found"}

        # Update status to processing
        task.status = "processing"
        db.commit()

        # Get application
        application = db.query(Application).filter(Application.id == application_id).first()
        if not application:
            task.status = "failed"
            task.error_message = "Application not found"
            db.commit()
            return {"status": "failed", "error": "Application not found"}

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
            return {"status": "failed", "error": "No CV found"}

        # Get job offer details
        job_offer = db.query(JobOffer).filter(JobOffer.url == application.job_offer_url).first()

        job_description = ""
        if job_offer:
            job_description = f"Title: {job_offer.title}\nCompany: {job_offer.company}\nDescription: {job_offer.description}"
        else:
            job_description = f"Title: {application.job_title}\nCompany: {application.company}"

        if application.opportunity_context:
            job_description += f"\nOpportunity Context: {application.opportunity_context}"

        if application.is_spontaneous:
            job_description += "\nThis is a spontaneous application without a specific posting."

        # Use OpenAI to calculate matching score
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
5. story: A concise, 3-6 sentence narrative that addresses potential fit concerns.

IMPORTANT: Read the ENTIRE CV carefully before identifying gaps.

Format your response as valid JSON only, no additional text."""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
        )

        content = response.choices[0].message.content

        # Parse JSON response
        if content.startswith("```json"):
            content = content.replace("```json", "").replace("```", "").strip()
        elif content.startswith("```"):
            content = content.replace("```", "").strip()

        result = json.loads(content)

        # Save or update the matching score
        existing_score = db.query(MatchingScore).filter(MatchingScore.application_id == application_id).first()

        if existing_score and recalculate:
            existing_score.overall_score = result.get("overall_score", 0)
            existing_score.strengths = json.dumps(result.get("strengths", []))
            existing_score.gaps = json.dumps(result.get("gaps", []))
            existing_score.recommendations = json.dumps(result.get("recommendations", []))
            existing_score.story = result.get("story")
            existing_score.updated_at = datetime.now(timezone.utc)
        elif not existing_score:
            new_score = MatchingScore(
                application_id=application_id,
                overall_score=result.get("overall_score", 0),
                strengths=json.dumps(result.get("strengths", [])),
                gaps=json.dumps(result.get("gaps", [])),
                recommendations=json.dumps(result.get("recommendations", [])),
                story=result.get("story"),
            )
            db.add(new_score)

        task.status = "completed"
        db.commit()

        return {"status": "completed", "score": result.get("overall_score", 0)}

    except Exception as e:
        logging.error(f"Error in calculate_matching_score_task: {e}")
        if task:
            task.status = "failed"
            task.error_message = str(e)
            db.commit()

        # Retry on transient errors
        raise self.retry(exc=e)

    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def generate_documents_task(self, task_id: int, application_id: int, doc_types: List[str], user_id: int):
    """
    Celery task to generate documents asynchronously.

    Generates cover letters, briefings, and other application documents using LLMs.
    """
    db = SessionLocal()
    task = None

    try:
        # Get the task
        task = db.query(GenerationTask).filter(GenerationTask.id == task_id).first()
        if not task:
            logging.error(f"GenerationTask {task_id} not found")
            return {"status": "failed", "error": "Task not found"}

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
            return {"status": "failed", "error": "Application not found"}

        user = db.query(User).filter(User.id == user_id).first()

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
            return {"status": "failed", "error": "No CV found"}

        # Build job description
        job_offer = db.query(JobOffer).filter(JobOffer.url == application.job_offer_url).first()

        job_description = ""
        if job_offer:
            job_description = f"Title: {job_offer.title}\nCompany: {job_offer.company}\nDescription: {job_offer.description}"
        else:
            job_description = f"Title: {application.job_title}\nCompany: {application.company}"

        if application.opportunity_context:
            job_description += f"\nOpportunity Context: {application.opportunity_context}"

        if application.is_spontaneous:
            job_description += "\nThis is a spontaneous application without a specific posting."

        # Add application type context
        app_type = getattr(application, "application_type", "fulltime")
        if app_type == "internship":
            job_description += "\n\n=== APPLICATION TYPE: INTERNSHIP ==="
        elif app_type == "apprenticeship":
            job_description += "\n\n=== APPLICATION TYPE: APPRENTICESHIP ==="

        # Add user profile context
        if user:
            employment_status = getattr(user, "employment_status", None)
            education_type = getattr(user, "education_type", None)
            additional_context = getattr(user, "additional_profile_context", None)

            if employment_status or education_type or additional_context:
                job_description += "\n\n=== CANDIDATE PROFILE CONTEXT ==="
                if employment_status:
                    job_description += f"\nEmployment Status: {employment_status}"
                if education_type:
                    job_description += f"\nEducation Type: {education_type}"
                if additional_context:
                    job_description += f"\nAdditional Context: {additional_context}"

        # Pre-load document templates
        templates_map = {}
        db_templates = db.query(DocumentTemplate).filter(
            DocumentTemplate.doc_type.in_(doc_types),
            DocumentTemplate.is_active == True
        ).all()
        for t in db_templates:
            templates_map[t.doc_type] = t

        default_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        for idx, doc_type in enumerate(doc_types):
            try:
                template = templates_map.get(doc_type)

                if template:
                    prompt = generate_document_prompt_from_template(
                        template, job_description, cv_doc.content_text, user, application, db
                    )
                    if not prompt:
                        prompt = generate_document_prompt(doc_type, job_description, cv_doc.content_text, application)

                    if not prompt:
                        logging.warning(f"Could not generate prompt for {doc_type}, skipping...")
                        continue

                    llm_client, model = get_llm_client(template.llm_provider, template.llm_model)
                    content = generate_with_llm(llm_client, model, template.llm_provider, prompt)
                else:
                    prompt = generate_document_prompt(doc_type, job_description, cv_doc.content_text, application)
                    if not prompt:
                        continue

                    response = default_client.chat.completions.create(
                        model="gpt-4",
                        messages=[{"role": "user", "content": prompt}],
                    )
                    content = response.choices[0].message.content

                # Persist to disk
                storage_dir = os.path.join("generated", str(user_id))
                os.makedirs(storage_dir, exist_ok=True)
                storage_path = os.path.join(storage_dir, f"app_{application_id}_{doc_type}.txt")
                try:
                    with open(storage_path, "w", encoding="utf-8") as f:
                        f.write(content or "")
                except Exception as e:
                    logging.warning(f"Could not write to {storage_path}: {e}")
                    storage_path = f"unpersisted:{doc_type}"

                # Save generated document
                gen_doc = GeneratedDocument(
                    application_id=application_id,
                    doc_type=doc_type,
                    format="TEXT",
                    storage_path=storage_path,
                    content=content,
                )
                db.add(gen_doc)

                # Update progress
                task.completed_docs = idx + 1
                task.progress = int((task.completed_docs / task.total_docs) * 100)
                db.commit()

            except LlmProviderUnavailable as e:
                # Provider SDK or API key missing — surface the exact German
                # message so the admin can fix the .env / requirements and retry.
                logging.error(
                    "LLM provider unavailable for %s: %s", doc_type, e
                )
                task.error_message = (
                    f"LLM-Provider nicht verfügbar bei Dokument '{doc_type}': {e}"
                )
                db.commit()
            except Exception as e:
                logging.error(f"Error generating {doc_type}: {e}")
                task.error_message = f"Partial failure: Error generating {doc_type}: {str(e)}"
                db.commit()

        # Mark as completed
        task.status = "completed"
        task.progress = 100
        db.commit()

        return {"status": "completed", "documents_generated": len(doc_types)}

    except Exception as e:
        logging.error(f"Fatal error in generate_documents_task: {e}")
        if task:
            task.status = "failed"
            task.error_message = str(e)
            db.commit()

        raise self.retry(exc=e)

    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def delete_documents_task(self, application_id: int, document_ids: List[int], user_id: int):
    """
    Celery task to delete generated documents asynchronously.

    Deletes multiple generated documents from an application.
    """
    db = SessionLocal()

    try:
        # Verify application belongs to user
        application = (
            db.query(Application)
            .filter(Application.id == application_id, Application.user_id == user_id)
            .first()
        )
        if not application:
            logging.error(f"Application {application_id} not found for user {user_id}")
            return {"status": "failed", "error": "Application not found", "deleted_count": 0}

        # Delete documents that belong to this application
        deleted_count = 0
        for doc_id in document_ids:
            doc = (
                db.query(GeneratedDocument)
                .filter(
                    GeneratedDocument.id == doc_id,
                    GeneratedDocument.application_id == application_id
                )
                .first()
            )
            if doc:
                # Also try to delete the file from disk
                if doc.storage_path and not doc.storage_path.startswith("unpersisted:"):
                    try:
                        if os.path.exists(doc.storage_path):
                            os.remove(doc.storage_path)
                    except Exception as e:
                        logging.warning(f"Could not delete file {doc.storage_path}: {e}")

                db.delete(doc)
                deleted_count += 1

        db.commit()

        logging.info(f"🗑️ Deleted {deleted_count} document(s) from application {application_id}")

        return {
            "status": "completed",
            "deleted_count": deleted_count,
            "application_id": application_id
        }

    except Exception as e:
        logging.error(f"Error in delete_documents_task: {e}")
        db.rollback()
        raise self.retry(exc=e)

    finally:
        db.close()