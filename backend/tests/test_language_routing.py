"""Tests for recipient-aware document-language routing.

The resolver in ``app.tasks._resolve_doc_language`` decides which language
each generated document is written in. The rule:

* Documents addressed to the *employer* (CV, cover letter, motivational
  letter, formal email) — written in the **job-offer language**
  (``Application.documentation_language``).

* Documents addressed to the *candidate themselves* (interview prep,
  company briefing, skill-gap report, etc.) — written in the
  **user's language** (``User.preferred_language``).

* When the template explicitly sets ``language_source``, that wins.
"""
from types import SimpleNamespace

import pytest

from app.tasks import (
    CANDIDATE_FACING_DOC_TYPES,
    _resolve_doc_language,
    generate_document_prompt_from_template,
    get_language_instruction,
)


def _user(preferred="de", documentation="de"):
    return SimpleNamespace(
        id=1,
        preferred_language=preferred,
        documentation_language=documentation,
    )


def _application(doc_lang="en", company_profile_lang=None):
    return SimpleNamespace(
        id=42,
        documentation_language=doc_lang,
        company_profile_language=company_profile_lang,
    )


def _template(doc_type, *, language_source="documentation_language", template="X {language} Y"):
    return SimpleNamespace(
        doc_type=doc_type,
        display_name=doc_type.replace("_", " ").title(),
        language_source=language_source,
        prompt_template=template,
    )


class TestResolveDocLanguage:
    """Recipient-aware resolution between job-language and user-language."""

    def test_employer_facing_cv_uses_job_language(self):
        # User speaks German, applies for a job in English → CV in English.
        lang = _resolve_doc_language(
            _template("tailored_cv_pdf"),
            _application(doc_lang="en"),
            _user(preferred="de"),
        )
        assert lang == "en"

    def test_employer_facing_cover_letter_uses_job_language(self):
        lang = _resolve_doc_language(
            _template("motivational_letter_pdf"),
            _application(doc_lang="fr"),
            _user(preferred="de"),
        )
        assert lang == "fr"

    def test_candidate_facing_briefing_uses_user_language(self):
        # Job in English, user speaks German → company briefing in German
        # because the candidate reads it themselves to prep for the interview.
        lang = _resolve_doc_language(
            _template("company_intelligence_briefing"),
            _application(doc_lang="en"),
            _user(preferred="de"),
        )
        assert lang == "de"

    def test_candidate_facing_skill_gap_uses_user_language(self):
        lang = _resolve_doc_language(
            _template("skill_gap_report"),
            _application(doc_lang="en"),
            _user(preferred="de-CH"),
        )
        assert lang == "de-CH"

    def test_explicit_language_source_overrides_doc_type(self):
        # If admin explicitly pins a template to user language, honour that
        # even for doc types that are usually employer-facing.
        lang = _resolve_doc_language(
            _template("tailored_cv_pdf", language_source="preferred_language"),
            _application(doc_lang="en"),
            _user(preferred="de"),
        )
        assert lang == "de"

    def test_company_profile_language_source(self):
        lang = _resolve_doc_language(
            _template("tailored_cv_pdf", language_source="company_profile_language"),
            _application(doc_lang="en", company_profile_lang="fr"),
            _user(preferred="de"),
        )
        assert lang == "fr"

    def test_company_profile_language_falls_back_to_user(self):
        lang = _resolve_doc_language(
            _template("tailored_cv_pdf", language_source="company_profile_language"),
            _application(doc_lang="en", company_profile_lang=None),
            _user(preferred="de"),
        )
        assert lang == "de"

    def test_falls_back_to_user_documentation_language_when_app_missing(self):
        lang = _resolve_doc_language(
            _template("tailored_cv_pdf"),
            _application(doc_lang=None),
            _user(preferred="de", documentation="de-CH"),
        )
        assert lang == "de-CH"

    def test_unknown_doc_type_defaults_to_employer_facing(self):
        # Conservative default: unknown doc types are treated as
        # employer-facing — failing closed on the side of "send to recruiter
        # in their own language" rather than accidentally writing the CV
        # in the user's language.
        lang = _resolve_doc_language(
            _template("brand_new_doc_type"),
            _application(doc_lang="en"),
            _user(preferred="de"),
        )
        assert lang == "en"


class TestCandidateFacingSet:
    """Guard against accidentally moving doc-types between recipient classes."""

    def test_known_employer_facing_doc_types_are_not_in_set(self):
        for doc_type in [
            "tailored_cv_pdf",
            "tailored_cv_editable",
            "tailored_cv_one_page",
            "motivational_letter_pdf",
            "motivational_letter_editable",
            "email_formal",
            "email_linkedin",
        ]:
            assert doc_type not in CANDIDATE_FACING_DOC_TYPES, doc_type

    def test_known_candidate_facing_doc_types_are_in_set(self):
        for doc_type in [
            "match_score_report",
            "company_intelligence_briefing",
            "interview_preparation_pack",
            "skill_gap_report",
            "reference_summary",
        ]:
            assert doc_type in CANDIDATE_FACING_DOC_TYPES, doc_type


class TestGetLanguageInstruction:
    """Plain 'de' must default to Swiss orthography (no ß) — CH-focused product."""

    def test_plain_de_uses_swiss_orthography(self):
        instr = get_language_instruction("de")
        assert "ss" in instr
        # The instruction must NOT tell the model to use ß for plain "de".
        assert "include 'ß'" not in instr
        assert "use 'ß'" not in instr

    def test_de_ch_explicitly_swiss(self):
        instr = get_language_instruction("de-CH")
        assert "ss" in instr
        assert "Mundart" in instr  # warning against dialect

    def test_de_de_keeps_german_orthography(self):
        # Users explicitly targeting Germany still get standard German.
        instr = get_language_instruction("de-DE")
        assert "ß" in instr


class TestPromptPlaceholderResolution:
    """End-to-end: ``generate_document_prompt_from_template`` substitutes the
    correct language per placeholder type."""

    def test_language_placeholder_resolved_for_employer_doc(self):
        tpl = _template(
            "tailored_cv_pdf",
            template="Output Language: {language}\nJob: {job_description}\nCV: {cv_text}",
        )
        prompt = generate_document_prompt_from_template(
            tpl, "Job description here", "CV here",
            _user(preferred="de"), _application(doc_lang="en"),
        )
        # CV is employer-facing → uses job-language (English)
        assert "Output Language: English" in prompt
        # And the input fields were not garbled
        assert "Job description here" in prompt
        assert "CV here" in prompt

    def test_language_placeholder_resolved_for_candidate_doc(self):
        tpl = _template(
            "company_intelligence_briefing",
            template="Output Language: {language}\nJob: {job_description}",
        )
        prompt = generate_document_prompt_from_template(
            tpl, "JD", "CV",
            _user(preferred="de"), _application(doc_lang="en"),
        )
        # Briefing is candidate-facing → user's language wins
        assert "Schweizer Hochdeutsch" in prompt or "ss" in prompt

    def test_distinct_placeholders_get_distinct_languages(self):
        tpl = _template(
            "tailored_cv_pdf",
            template="MAIN={language}|JOB={job_language}|USER={user_language}",
        )
        prompt = generate_document_prompt_from_template(
            tpl, "JD", "CV",
            _user(preferred="de"), _application(doc_lang="en"),
        )
        assert "MAIN=English" in prompt
        assert "JOB=English" in prompt
        # USER is German, instruction text starts with 'Swiss Standard German'
        assert "USER=Swiss Standard German" in prompt or "USER=Schweizer" in prompt

    def test_template_language_source_override_applies(self):
        tpl = _template(
            "tailored_cv_pdf",
            language_source="preferred_language",
            template="Output Language: {language}",
        )
        prompt = generate_document_prompt_from_template(
            tpl, "JD", "CV",
            _user(preferred="fr"), _application(doc_lang="en"),
        )
        # Forced override: French even though doc is employer-facing
        assert "French" in prompt
