"""Central list of supported interface and generation languages.

The catalog is organized around ISO 639-1 language codes with human-friendly labels
and text direction metadata to support RTL locales.
"""

from dataclasses import dataclass
from typing import List, Optional


@dataclass(frozen=True)
class LanguageOption:
    code: str  # ISO 639-1 code (optionally with region, e.g., zh-Hant)
    label: str  # UI-facing label
    direction: str = "ltr"  # "ltr" | "rtl"


LANGUAGE_OPTIONS: List[LanguageOption] = [
    LanguageOption("en", "English"),
    LanguageOption("de", "Deutsch (German)"),
    LanguageOption("de-CH", "Deutsch (Schweiz)"),
    LanguageOption("fr", "Français (French)"),
    LanguageOption("it", "Italiano (Italian)"),
    LanguageOption("es", "Español (Spanish)"),
    LanguageOption("pt", "Português (Portuguese)"),
    LanguageOption("gsw", "Svizzeru / Schweizerdeutsch (Swiss German)"),
    LanguageOption("rm", "Rumantsch (Romansh)"),
    LanguageOption("sq", "Albanian"),
    LanguageOption("bs", "Bosnian"),
    LanguageOption("bg", "Bulgarian"),
    LanguageOption("hr", "Croatian"),
    LanguageOption("sr", "Serbian"),
    LanguageOption("sl", "Slovenian"),
    LanguageOption("ro", "Romanian"),
    LanguageOption("ru", "Russian"),
    LanguageOption("uk", "Ukrainian"),
    LanguageOption("pl", "Polish"),
    LanguageOption("cs", "Czech"),
    LanguageOption("sk", "Slovak"),
    LanguageOption("hu", "Hungarian"),
    LanguageOption("tr", "Turkish"),
    LanguageOption("ar", "Arabic", direction="rtl"),
    LanguageOption("he", "Hebrew", direction="rtl"),
    LanguageOption("fa", "Persian (Farsi)", direction="rtl"),
    LanguageOption("ku", "Kurdish"),
    LanguageOption("el", "Greek"),
    LanguageOption("fil", "Filipino (Tagalog)"),
    LanguageOption("th", "Thai"),
    LanguageOption("vi", "Vietnamese"),
    LanguageOption("ms", "Malay / Indonesian"),
    LanguageOption("zh-Hans", "Chinese (Simplified)"),
    LanguageOption("zh-Hant", "Chinese (Traditional)"),
    LanguageOption("ja", "Japanese"),
    LanguageOption("ko", "Korean"),
    LanguageOption("hi", "Hindi"),
    LanguageOption("ur", "Urdu", direction="rtl"),
    LanguageOption("bn", "Bengali"),
    LanguageOption("pa", "Punjabi"),
    LanguageOption("ta", "Tamil"),
    LanguageOption("te", "Telugu"),
    LanguageOption("kn", "Kannada"),
    LanguageOption("ml", "Malayalam"),
    LanguageOption("si", "Sinhala"),
    LanguageOption("ne", "Nepali"),
    LanguageOption("am", "Amharic"),
    LanguageOption("ti", "Tigrinya"),
    LanguageOption("so", "Somali"),
    LanguageOption("sw", "Swahili"),
    LanguageOption("yo", "Yoruba"),
    LanguageOption("ig", "Igbo"),
    LanguageOption("ha", "Hausa"),
    LanguageOption("wo", "Wolof"),
    LanguageOption("bm", "Bambara"),
    LanguageOption("rw", "Kinyarwanda"),
    LanguageOption("rn", "Kirundi"),
    LanguageOption("ln", "Lingala"),
    LanguageOption("zu", "Zulu"),
    LanguageOption("xh", "Xhosa"),
    LanguageOption("sn", "Shona"),
]

SUPPORTED_LANGUAGES = [option.label for option in LANGUAGE_OPTIONS]
SUPPORTED_LANGUAGES_SET = set(SUPPORTED_LANGUAGES)
DEFAULT_LANGUAGE = SUPPORTED_LANGUAGES[0]

# Minimal alias map to bridge ISO codes and UI-friendly names. Keys are lower-cased.
LANGUAGE_ALIASES = {
    option.code.lower(): option.label for option in LANGUAGE_OPTIONS
}
LANGUAGE_ALIASES.update({option.label.lower(): option.label for option in LANGUAGE_OPTIONS})


def normalize_language(value: Optional[str], field_name: str = "language") -> str:
    """Normalize and validate a provided language value.

    - Maps ISO aliases to the canonical display form used across the UI.
    - Ensures the resulting value is in ``SUPPORTED_LANGUAGES``.
    - Raises ``ValueError`` for ``None`` or invalid inputs to surface validation issues.
    """

    if value is None:
        raise ValueError(f"{field_name} cannot be empty")

    candidate = value.strip()
    alias_key = candidate.lower()
    normalized = LANGUAGE_ALIASES.get(alias_key, candidate)

    if normalized not in SUPPORTED_LANGUAGES_SET:
        raise ValueError(f"{field_name} must be one of the supported languages")

    return normalized


def get_language_options() -> List[LanguageOption]:
    """Return the full language option set for UI consumption."""

    return LANGUAGE_OPTIONS
