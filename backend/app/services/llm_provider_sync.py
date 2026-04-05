"""Query LLM providers for their currently-available model lists.

Used by the admin "LLM-Update prüfen" button to compare the ``llm_models``
table with what each provider actually offers right now:

- Models that we have in the DB but the provider no longer lists → *deprecated*
- Models that the provider lists but we don't have in the DB → *new*

Each provider is queried independently and failures (missing SDK, missing
API key, network error) are reported per-provider, so one broken provider
does not break the whole sync view.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Iterable

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Result dataclasses
# ---------------------------------------------------------------------------


@dataclass
class LiveModel:
    """One model as returned by a provider's live catalog."""

    provider: str
    model_id: str
    display_name: str
    created_at: str | None = None  # ISO-8601 if the provider returns it
    notes: str | None = None


@dataclass
class ProviderListResult:
    """Outcome of calling one provider's list-models endpoint."""

    provider: str
    available: bool
    models: list[LiveModel] = field(default_factory=list)
    error: str | None = None

    @property
    def model_ids(self) -> set[str]:
        return {m.model_id for m in self.models}


# ---------------------------------------------------------------------------
# Chat-model filters (non-chat models are irrelevant for us)
# ---------------------------------------------------------------------------


def _is_openai_chat_model(model_id: str) -> bool:
    """Filter OpenAI's list to chat-completion-capable models.

    The ``/v1/models`` endpoint returns every model the key can access,
    including embeddings, whisper, TTS, image and legacy completion models.
    We only care about models usable in ``chat.completions.create``.
    """
    mid = model_id.lower()

    # Exclude non-chat modalities by prefix
    non_chat_prefixes = (
        "dall-e",
        "whisper",
        "tts-",
        "text-embedding",
        "text-moderation",
        "text-davinci",
        "text-curie",
        "text-babbage",
        "text-ada",
        "davinci-",
        "babbage-",
        "ada-",
        "curie-",
        "omni-moderation",
    )
    if any(mid.startswith(p) for p in non_chat_prefixes):
        return False

    # Exclude non-chat modalities by substring (catches e.g. "chatgpt-image-latest",
    # "gpt-4o-transcribe", "gpt-4o-audio-preview", "gpt-4o-realtime-preview", etc.)
    non_chat_substrings = (
        "image",
        "audio",
        "realtime",
        "transcribe",
        "tts",
        "embedding",
        "moderation",
        "search",  # e.g. gpt-4o-search-preview
    )
    if any(sub in mid for sub in non_chat_substrings):
        return False

    # Exclude the "instruct" completion variants (not chat)
    if "-instruct" in mid:
        return False

    # Include the chat model families
    chat_prefixes = ("gpt-", "o1", "o3", "o4", "chatgpt-")
    return any(mid.startswith(p) for p in chat_prefixes)


# ---------------------------------------------------------------------------
# Per-provider fetchers
# ---------------------------------------------------------------------------


def fetch_openai_models() -> ProviderListResult:
    """Query OpenAI's ``/v1/models`` endpoint and return chat-capable models."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return ProviderListResult(
            provider="openai",
            available=False,
            error="OPENAI_API_KEY ist nicht gesetzt.",
        )

    try:
        from openai import OpenAI  # type: ignore
    except ImportError:
        return ProviderListResult(
            provider="openai",
            available=False,
            error="Das openai SDK ist nicht installiert.",
        )

    try:
        client = OpenAI(api_key=api_key)
        page = client.models.list()
    except Exception as e:  # noqa: BLE001 — report, don't crash
        logger.warning("OpenAI models.list() failed: %s", e)
        return ProviderListResult(
            provider="openai",
            available=False,
            error=f"OpenAI-API-Aufruf fehlgeschlagen: {e}",
        )

    models: list[LiveModel] = []
    for m in page.data:
        if not _is_openai_chat_model(m.id):
            continue
        created = None
        if getattr(m, "created", None):
            try:
                from datetime import datetime, timezone

                created = (
                    datetime.fromtimestamp(m.created, tz=timezone.utc).isoformat()
                )
            except Exception:  # noqa: BLE001
                created = None
        models.append(
            LiveModel(
                provider="openai",
                model_id=m.id,
                display_name=m.id,  # OpenAI doesn't give a separate display name
                created_at=created,
            )
        )

    return ProviderListResult(provider="openai", available=True, models=models)


def fetch_anthropic_models() -> ProviderListResult:
    """Query Anthropic's ``/v1/models`` endpoint.

    Requires the ``anthropic`` SDK (>= 0.39) and ``ANTHROPIC_API_KEY``.
    Falls back gracefully when either is missing.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return ProviderListResult(
            provider="anthropic",
            available=False,
            error=(
                "ANTHROPIC_API_KEY ist nicht gesetzt. Füge den Key in der "
                ".env hinzu, installiere ggf. das anthropic SDK und starte "
                "den Backend-Container neu."
            ),
        )

    try:
        import anthropic  # type: ignore
    except ImportError:
        return ProviderListResult(
            provider="anthropic",
            available=False,
            error=(
                "Das anthropic SDK ist im Backend-Container nicht "
                "installiert. `pip install anthropic>=0.39` und Container neu starten."
            ),
        )

    try:
        client = anthropic.Anthropic(api_key=api_key)
        # SDK >= 0.39: client.models.list() returns a page of ModelInfo
        if not hasattr(client, "models"):
            return ProviderListResult(
                provider="anthropic",
                available=False,
                error=(
                    "Installierte anthropic SDK-Version zu alt — "
                    "benötigt >= 0.39."
                ),
            )
        response = client.models.list(limit=100)
    except Exception as e:  # noqa: BLE001
        logger.warning("Anthropic models.list() failed: %s", e)
        return ProviderListResult(
            provider="anthropic",
            available=False,
            error=f"Anthropic-API-Aufruf fehlgeschlagen: {e}",
        )

    models: list[LiveModel] = []
    data = getattr(response, "data", None) or list(response)
    for m in data:
        model_id = getattr(m, "id", None)
        if not model_id:
            continue
        display_name = getattr(m, "display_name", None) or model_id
        created_at = getattr(m, "created_at", None)
        if created_at is not None and hasattr(created_at, "isoformat"):
            created_at = created_at.isoformat()
        models.append(
            LiveModel(
                provider="anthropic",
                model_id=model_id,
                display_name=display_name,
                created_at=created_at,
            )
        )

    return ProviderListResult(provider="anthropic", available=True, models=models)


def fetch_google_models() -> ProviderListResult:
    """Query Google Gemini's model list.

    Requires the ``google-generativeai`` SDK and ``GOOGLE_API_KEY``.
    """
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return ProviderListResult(
            provider="google",
            available=False,
            error=(
                "GOOGLE_API_KEY ist nicht gesetzt. Füge den Key in der "
                ".env hinzu, installiere ggf. google-generativeai und starte "
                "den Backend-Container neu."
            ),
        )

    try:
        import google.generativeai as genai  # type: ignore
    except ImportError:
        return ProviderListResult(
            provider="google",
            available=False,
            error=(
                "Das google-generativeai SDK ist im Backend-Container "
                "nicht installiert. `pip install google-generativeai` "
                "und Container neu starten."
            ),
        )

    try:
        genai.configure(api_key=api_key)
        raw_models = list(genai.list_models())
    except Exception as e:  # noqa: BLE001
        logger.warning("Google list_models() failed: %s", e)
        return ProviderListResult(
            provider="google",
            available=False,
            error=f"Google-API-Aufruf fehlgeschlagen: {e}",
        )

    models: list[LiveModel] = []
    for m in raw_models:
        methods = getattr(m, "supported_generation_methods", None) or []
        if "generateContent" not in methods:
            continue
        full_name = getattr(m, "name", "") or ""
        # Gemini returns "models/gemini-2.0-flash" — strip the prefix.
        model_id = full_name.removeprefix("models/")
        if not model_id:
            continue
        display = getattr(m, "display_name", None) or model_id
        models.append(
            LiveModel(
                provider="google",
                model_id=model_id,
                display_name=display,
            )
        )

    return ProviderListResult(provider="google", available=True, models=models)


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------


def fetch_all_providers() -> dict[str, ProviderListResult]:
    """Call all three provider fetchers and return the results by provider name.

    Each fetcher handles its own errors, so this function never raises.
    """
    return {
        "openai": fetch_openai_models(),
        "anthropic": fetch_anthropic_models(),
        "google": fetch_google_models(),
    }


def result_to_dict(result: ProviderListResult) -> dict:
    """Serialize a ProviderListResult for the API response."""
    return {
        "provider": result.provider,
        "available": result.available,
        "error": result.error,
        "live_model_count": len(result.models),
        "live_models": [
            {
                "provider": m.provider,
                "model_id": m.model_id,
                "display_name": m.display_name,
                "created_at": m.created_at,
                "notes": m.notes,
            }
            for m in result.models
        ],
    }
