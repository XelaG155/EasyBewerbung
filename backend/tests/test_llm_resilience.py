"""Tests for LLM-resilience features:

* Per-call timeout config (constant on the module, surfaced through
  the SDK constructor and the per-call kwargs).
* Anthropic prompt caching for prompts above the cache threshold.
* Retry-on-transient-error helper, including the auth-error fast-fail.

The provider SDKs are stubbed with simple fakes — we only verify the
glue logic in ``app.tasks``.
"""
from types import SimpleNamespace

import pytest

import app.tasks as tasks


class _OpenAIFake:
    """OpenAI client fake exposing chat.completions.create."""

    def __init__(self):
        self.calls = []

        class _Completions:
            def __init__(outer):
                outer.parent = self

            def create(_outer_self, **kwargs):
                self.calls.append(kwargs)
                return SimpleNamespace(
                    choices=[SimpleNamespace(message=SimpleNamespace(content="ok"))]
                )

        self.chat = SimpleNamespace(completions=_Completions())


class _AnthropicFake:
    def __init__(self):
        outer = self
        outer.calls = []

        class _Messages:
            def create(_self, **kwargs):
                outer.calls.append(kwargs)
                return SimpleNamespace(content=[SimpleNamespace(text="ok")])

        self.messages = _Messages()


class TestOpenAITimeoutPropagation:
    def test_per_call_kwargs_include_timeout(self):
        client = _OpenAIFake()
        out = tasks._call_openai(client, "gpt-4", "hello")
        assert out == "ok"
        assert client.calls[0]["timeout"] == tasks.LLM_REQUEST_TIMEOUT_SECONDS


class TestAnthropicPromptCaching:
    def test_short_prompt_does_not_use_cache_block(self):
        client = _AnthropicFake()
        out = tasks._call_anthropic(client, "claude-3", "x" * 100)
        assert out == "ok"
        kwargs = client.calls[0]
        assert "system" not in kwargs
        assert kwargs["messages"] == [{"role": "user", "content": "x" * 100}]

    def test_long_prompt_uses_cached_system_block(self):
        client = _AnthropicFake()
        prompt = "y" * 5000  # > CACHE_THRESHOLD_CHARS
        tasks._call_anthropic(client, "claude-3", prompt)
        kwargs = client.calls[0]
        # System is a list of blocks with cache_control set on the bulk.
        assert isinstance(kwargs["system"], list)
        block = kwargs["system"][0]
        assert block["text"] == prompt
        assert block["cache_control"] == {"type": "ephemeral"}
        # Beta header for prompt caching is set.
        assert kwargs["extra_headers"] == {
            "anthropic-beta": "prompt-caching-2024-07-31"
        }
        # The user message is a small dynamic trigger, not the bulk content.
        assert kwargs["messages"][0]["role"] == "user"
        assert prompt not in kwargs["messages"][0]["content"]


class TestRetryHelper:
    def test_transient_classification(self):
        class _RateLimitError(Exception):
            pass

        class _APIConnectionError(Exception):
            pass

        class _OverloadedError(Exception):
            pass

        assert tasks._is_transient_llm_error(_RateLimitError("x")) is True
        assert tasks._is_transient_llm_error(_APIConnectionError("x")) is True
        assert tasks._is_transient_llm_error(_OverloadedError("x")) is True

    def test_fatal_classification(self):
        class _AuthenticationError(Exception):
            pass

        class _PermissionDeniedError(Exception):
            pass

        class _BadRequestError(Exception):
            pass

        class _InvalidRequestError(Exception):
            pass

        assert tasks._is_transient_llm_error(_AuthenticationError("x")) is False
        assert tasks._is_transient_llm_error(_PermissionDeniedError("x")) is False
        assert tasks._is_transient_llm_error(_BadRequestError("x")) is False
        assert tasks._is_transient_llm_error(_InvalidRequestError("x")) is False


class TestGenerateWithLlmRetries:
    def test_transient_error_triggers_retry_then_success(self, monkeypatch):
        # Provider call fails twice with a transient error, succeeds on
        # the third attempt. With LLM_MAX_RETRIES=2 we get 3 total tries.
        attempts = {"n": 0}

        class _RateLimitError(Exception):
            pass

        def fake_openai(client, model, prompt):
            attempts["n"] += 1
            if attempts["n"] < 3:
                raise _RateLimitError("rate limited")
            return "final"

        monkeypatch.setattr(tasks, "_call_openai", fake_openai)
        monkeypatch.setattr(tasks.time, "sleep", lambda *_: None)
        monkeypatch.setattr(tasks, "LLM_MAX_RETRIES", 2)

        result = tasks.generate_with_llm(object(), "gpt-4", "openai", "hi")
        assert result == "final"
        assert attempts["n"] == 3

    def test_fatal_error_is_not_retried(self, monkeypatch):
        attempts = {"n": 0}

        class _AuthenticationError(Exception):
            pass

        def fake_openai(client, model, prompt):
            attempts["n"] += 1
            raise _AuthenticationError("bad key")

        monkeypatch.setattr(tasks, "_call_openai", fake_openai)
        monkeypatch.setattr(tasks.time, "sleep", lambda *_: None)

        with pytest.raises(Exception):
            tasks.generate_with_llm(object(), "gpt-4", "openai", "hi")
        assert attempts["n"] == 1

    def test_max_retries_exhausted_reraises(self, monkeypatch):
        attempts = {"n": 0}

        class _RateLimitError(Exception):
            pass

        def fake_openai(client, model, prompt):
            attempts["n"] += 1
            raise _RateLimitError("nope")

        monkeypatch.setattr(tasks, "_call_openai", fake_openai)
        monkeypatch.setattr(tasks.time, "sleep", lambda *_: None)
        monkeypatch.setattr(tasks, "LLM_MAX_RETRIES", 2)

        with pytest.raises(Exception):
            tasks.generate_with_llm(object(), "gpt-4", "openai", "hi")
        assert attempts["n"] == 3  # initial + 2 retries

    def test_unknown_provider_raises_unavailable(self):
        with pytest.raises(tasks.LlmProviderUnavailable):
            tasks.generate_with_llm(object(), "x", "azure", "hi")
