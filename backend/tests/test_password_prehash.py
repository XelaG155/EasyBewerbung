"""Verify SHA256 prehashing closes the bcrypt 72-byte truncation gap.

bcrypt silently truncates inputs at 72 bytes, so any password longer than
72 bytes had an effective entropy ceiling: a user with an 80-character
password could authenticate with the 72-character prefix. Pydantic permits
up to 100 chars on registration (UserRegister.password) so this was a
real gap, not a theoretical one.

The fix prehashes the user's password with SHA256 before handing it to
bcrypt — the digest is always 32 bytes, well under the truncation limit.
"""
import bcrypt

from app.auth import get_password_hash, verify_password


class TestLongPasswords:
    def test_two_long_passwords_with_same_72_byte_prefix_have_distinct_hashes(self):
        prefix = "a" * 72
        password_a = prefix + "_TAIL_A"
        password_b = prefix + "_TAIL_B"

        # Pre-2026-04-26 behaviour: bcrypt truncated both to 72 bytes, so
        # the SAME hash matched BOTH passwords. With prehashing, the SHA256
        # digest of A and B differ → hashes differ, neither cross-verifies.
        hash_a = get_password_hash(password_a)
        assert verify_password(password_a, hash_a) is True
        assert verify_password(password_b, hash_a) is False

    def test_password_with_long_prefix_does_not_authenticate_via_prefix(self):
        password = "x" * 80
        prefix = "x" * 72  # what bcrypt would have seen pre-fix
        h = get_password_hash(password)
        assert verify_password(password, h) is True
        assert verify_password(prefix, h) is False


class TestRoundTrip:
    def test_short_password_round_trips(self):
        h = get_password_hash("hunter2-very-secret")
        assert verify_password("hunter2-very-secret", h) is True
        assert verify_password("wrong", h) is False

    def test_unicode_password_round_trips(self):
        # German with Swiss-style non-ASCII characters.
        pw = "Müesli&Grüezi-äöüß-2025"
        h = get_password_hash(pw)
        assert verify_password(pw, h) is True
        assert verify_password(pw + "!", h) is False


class TestLegacyHashCompatibility:
    """Hashes created before the prehash change must still verify."""

    def test_legacy_raw_hash_still_verifies(self):
        # Recreate the old hashing code-path: raw bytes, no prehashing.
        legacy = bcrypt.hashpw(
            b"old-school-password",
            bcrypt.gensalt(),
        ).decode("utf-8")
        # New verify_password must accept it via the fallback branch.
        assert verify_password("old-school-password", legacy) is True
        assert verify_password("wrong", legacy) is False
