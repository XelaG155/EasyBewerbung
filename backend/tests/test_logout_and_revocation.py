"""Verify /logout revokes outstanding JWTs and that the decoder honours
``users.tokens_invalidated_after``.

Without this guard a 7-day JWT remained valid even after logout, password
change, admin demote or admin deactivate — so any token leak (XSS,
shoulder-surfing) gave the attacker a week of access. The runtime check
in ``get_current_user`` rejects tokens whose ``iat`` precedes the user's
revocation cutoff.
"""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import create_access_token, get_current_user
from app.models import Base, User


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = Session()
    try:
        yield session
    finally:
        session.close()


def _seed_user(db, *, tokens_invalidated_after=None):
    user = User(
        email="u@example.com",
        hashed_password="x",
        credits=0,
        preferred_language="de",
        tokens_invalidated_after=tokens_invalidated_after,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _bearer(token):
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


class TestTokenIssuedAt:
    def test_create_token_includes_iat_claim(self):
        token = create_access_token({"sub": "1"})
        from jose import jwt as jose_jwt
        from app.auth import ALGORITHM, SECRET_KEY

        payload = jose_jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert "iat" in payload
        assert "exp" in payload


class TestRevocationAtDecode:
    def test_legacy_user_without_cutoff_accepts_token(self, db):
        user = _seed_user(db, tokens_invalidated_after=None)
        token = create_access_token({"sub": str(user.id)})
        result = get_current_user(_bearer(token), db)
        assert result.id == user.id

    def test_token_issued_after_cutoff_is_accepted(self, db):
        cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
        user = _seed_user(db, tokens_invalidated_after=cutoff)
        token = create_access_token({"sub": str(user.id)})
        result = get_current_user(_bearer(token), db)
        assert result.id == user.id

    def test_token_issued_before_cutoff_is_rejected(self, db):
        # Issue the token first, then advance the cutoff past it.
        user = _seed_user(db, tokens_invalidated_after=None)
        token = create_access_token({"sub": str(user.id)})
        # Bump cutoff to 1 second in the future so the previously-issued
        # token is now stale.
        user.tokens_invalidated_after = datetime.now(timezone.utc) + timedelta(seconds=1)
        db.commit()

        with pytest.raises(HTTPException) as exc:
            get_current_user(_bearer(token), db)
        assert exc.value.status_code == 401
        assert "revoked" in exc.value.detail.lower()


class TestLogoutBumpsCutoff:
    def test_logout_endpoint_bumps_cutoff_and_invalidates_token(self, db):
        # Simulate the side effect of POST /users/logout directly to keep
        # the test outside FastAPI's TestClient (which would need full app
        # bootstrap). The endpoint just sets tokens_invalidated_after = now;
        # we verify the resulting JWT-decode behaviour.
        user = _seed_user(db, tokens_invalidated_after=None)
        token = create_access_token({"sub": str(user.id)})

        # Pre-logout: token is valid.
        assert get_current_user(_bearer(token), db).id == user.id

        # Logout: bump the cutoff to a moment in the future of the token's iat.
        user.tokens_invalidated_after = datetime.now(timezone.utc) + timedelta(seconds=1)
        db.commit()

        with pytest.raises(HTTPException) as exc:
            get_current_user(_bearer(token), db)
        assert exc.value.status_code == 401


class TestAdminPathsBumpCutoff:
    """Smoke test that the model-level field exists and can be bumped."""

    def test_field_is_settable_and_round_trips(self, db):
        user = _seed_user(db)
        moment = datetime.now(timezone.utc).replace(microsecond=0)
        user.tokens_invalidated_after = moment
        db.commit()
        db.refresh(user)
        # SQLite returns naive datetime — normalise before comparison.
        round_tripped = user.tokens_invalidated_after
        if round_tripped.tzinfo is None:
            round_tripped = round_tripped.replace(tzinfo=timezone.utc)
        assert round_tripped == moment
