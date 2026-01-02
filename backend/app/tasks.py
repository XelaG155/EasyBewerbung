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


def get_llm_client(provider: str, model: str):
    """Get LLM client based on provider configuration."""
    if provider == "openai":
        return OpenAI(api_key=os.getenv("OPENAI_API_KEY")), model
    # Add other providers as needed (anthropic, google, etc.)
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY")), model


def generate_with_llm(client, model: str, provider: str, prompt: str) -> str:
    """Generate content using the specified LLM."""
    if provider == "openai":
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content
    return ""


def get_language_instruction(lang_code: str) -> str:
    """Convert language code to explicit LLM instruction with regional specifics."""
    language_instructions = {
        "de-CH": "Swiss German (Schweizerdeutsch) - CRITICAL: Use 'ss' instead of 'ß' (e.g., 'Strasse' not 'Straße', 'Grüsse' not 'Grüße', 'dass' not 'daß'). This is Swiss Standard German orthography.",
        "de": "German (Standard German / Hochdeutsch) - Use standard German orthography including 'ß' where appropriate.",
        "de-DE": "German (Germany) - Use standard German orthography including 'ß' where appropriate.",
        "en": "English",
        "fr": "French (Français)",
        "it": "Italian (Italiano)",
        "es": "Spanish (Español)",
        "pt": "Portuguese (Português)",
    }
    return language_instructions.get(lang_code, lang_code)


def generate_document_prompt_from_template(
    template, job_description: str, cv_text: str, user, application, db=None
) -> str:
    """Generate a prompt from a database template."""
    try:
        prompt = template.prompt_template

        # Get user language preference
        doc_lang = getattr(application, "documentation_language", None) or getattr(user, "documentation_language", "en")

        # Get explicit language instruction for LLM
        language_instruction = get_language_instruction(doc_lang)

        # Standard role and task for document generation
        role = "professional career consultant and CV/resume expert"
        task = "Help this candidate create compelling, honest, and effective job application documents"

        # Standard instructions (can be customized per user in future)
        instructions = """
1. Be completely honest - NEVER invent skills, experiences, or qualifications
2. Only use information that exists in the candidate's CV
3. Optimize for the specific job requirements while staying truthful
4. Use professional, clear language appropriate for the target role
5. Highlight genuine strengths and relevant experience
6. Structure content for maximum impact and readability"""

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

        # CV summary is the first ~500 chars of CV (for templates that need a brief version)
        cv_summary = cv_text[:500] + "..." if len(cv_text) > 500 else cv_text

        # Replace all placeholders (single braces - matching template format)
        prompt = prompt.replace("{job_description}", job_description)
        prompt = prompt.replace("{cv_text}", cv_text)
        prompt = prompt.replace("{cv_summary}", cv_summary)
        prompt = prompt.replace("{language}", language_instruction)
        prompt = prompt.replace("{company_profile_language}", language_instruction)
        prompt = prompt.replace("{role}", role)
        prompt = prompt.replace("{task}", task)
        prompt = prompt.replace("{instructions}", instructions)
        prompt = prompt.replace("{documentation_language}", language_instruction)
        prompt = prompt.replace("{reference_letters}", reference_letters)

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