import pytest

from app.language_catalog import DEFAULT_LANGUAGE, normalize_language


def test_normalize_language_rejects_none():
    with pytest.raises(ValueError):
        normalize_language(None)


def test_normalize_language_accepts_supported_labels():
    assert normalize_language(DEFAULT_LANGUAGE) == DEFAULT_LANGUAGE
    assert normalize_language("en") == DEFAULT_LANGUAGE


def test_normalize_language_rejects_unknown_values():
    with pytest.raises(ValueError):
        normalize_language("unknown-language", field_name="preferred_language")
