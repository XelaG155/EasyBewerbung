"""Verify SECRET_KEY bootstrap fails closed in production.

The previous behaviour generated a random key when ENVIRONMENT was
anything other than "production". The bigvmcontrol auto-deploy stack
did not set ENVIRONMENT at all, so every container restart silently
invalidated all user sessions. The new contract:

* dev/test environments → ephemeral key allowed with a warning
* anything else (including unset) → fail fast with a clear error
"""
import importlib
import sys

import pytest


DEFAULT_PLACEHOLDER = "your-secret-key-change-this-in-production"


def _reload_auth(monkeypatch, *, secret=None, environment=None):
    """Re-import app.auth with a controlled env snapshot.

    The repository ships a real .env file with a working SECRET_KEY, and
    auth.py calls ``load_dotenv()`` at import time. To get deterministic
    tests we (a) stub out load_dotenv so the .env file is not read, and
    (b) explicitly seed SECRET_KEY/ENVIRONMENT before re-importing.
    """
    monkeypatch.setattr("dotenv.load_dotenv", lambda *a, **kw: None)

    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    if secret is not None:
        monkeypatch.setenv("SECRET_KEY", secret)
    if environment is not None:
        monkeypatch.setenv("ENVIRONMENT", environment)

    sys.modules.pop("app.auth", None)
    return importlib.import_module("app.auth")


class TestProductionBootstrap:
    def test_unset_environment_with_default_secret_raises(self, monkeypatch):
        with pytest.raises(RuntimeError, match="SECRET_KEY must be set"):
            _reload_auth(monkeypatch)

    def test_unset_environment_with_default_placeholder_raises(self, monkeypatch):
        with pytest.raises(RuntimeError, match="SECRET_KEY must be set"):
            _reload_auth(monkeypatch, secret=DEFAULT_PLACEHOLDER)

    def test_production_environment_with_default_secret_raises(self, monkeypatch):
        with pytest.raises(RuntimeError, match="SECRET_KEY must be set"):
            _reload_auth(
                monkeypatch, environment="production", secret=DEFAULT_PLACEHOLDER
            )

    def test_staging_environment_with_default_secret_raises(self, monkeypatch):
        with pytest.raises(RuntimeError, match="SECRET_KEY must be set"):
            _reload_auth(
                monkeypatch, environment="staging", secret=DEFAULT_PLACEHOLDER
            )

    def test_production_with_explicit_secret_succeeds(self, monkeypatch):
        # Synthetic test value — anything that is not the literal placeholder
        # works. Length is unconstrained at the auth-layer; we just need a
        # non-default value to verify the happy path.
        explicit = "test-prod-fixture-not-a-real-secret"
        auth = _reload_auth(
            monkeypatch,
            environment="production",
            secret=explicit,
        )
        assert auth.SECRET_KEY == explicit


class TestDevBootstrap:
    @pytest.mark.parametrize(
        "env_name", ["dev", "development", "test", "testing", "ci", "local"]
    )
    def test_dev_envs_allow_ephemeral_key(self, monkeypatch, env_name):
        auth = _reload_auth(monkeypatch, environment=env_name)
        # Ephemeral key is generated, never the literal default placeholder.
        assert auth.SECRET_KEY != DEFAULT_PLACEHOLDER
        assert len(auth.SECRET_KEY) >= 32

    def test_dev_with_explicit_key_uses_it(self, monkeypatch):
        explicit = "test-dev-fixture-not-a-real-secret"
        auth = _reload_auth(
            monkeypatch,
            environment="dev",
            secret=explicit,
        )
        assert auth.SECRET_KEY == explicit
