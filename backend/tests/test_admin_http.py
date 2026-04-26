"""HTTP-layer tests for admin user-management endpoints.

Iteration-3 testing-audit P1: ``backend/app/api/endpoints/admin.py``
had zero direct tests; the credit-grant, lock/unlock, demote/promote
flows were exercised only indirectly. This file covers them via
``TestClient`` to guard against regressions in the auth gate, the
admin-self-modify protection, the credit-balance validation, and the
new token-revocation hook on deactivate / demote (Iteration-1
``tokens_invalidated_after`` work).
"""
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import create_access_token, get_password_hash
from app.database import get_db
from app.main import app
from app.models import Base, User


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = Session()
    try:
        yield session, Session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    session, factory = db_session

    def override_get_db():
        s = factory()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_db, None)


def _seed_user(session, *, email="alice@example.com", credits=5, is_admin=False):
    user = User(
        email=email,
        hashed_password=get_password_hash("hunter2"),
        full_name="Alice",
        preferred_language="de",
        documentation_language="en",
        credits=credits,
        is_admin=is_admin,
        is_active=True,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _bearer(user_id):
    return {"Authorization": f"Bearer {create_access_token({'sub': str(user_id)})}"}


class TestAdminGate:
    def test_non_admin_credit_grant_rejected(self, client, db_session):
        session, _ = db_session
        admin = _seed_user(session, email="admin@x", is_admin=True)
        non_admin = _seed_user(session, email="bob@x", is_admin=False)
        target = _seed_user(session, email="t@x")
        resp = client.post(
            f"/admin/users/{target.id}/credits",
            headers=_bearer(non_admin.id),
            json={"amount": 5},
        )
        assert resp.status_code == 403

    def test_unauthenticated_credit_grant_rejected(self, client, db_session):
        session, _ = db_session
        target = _seed_user(session)
        resp = client.post(
            f"/admin/users/{target.id}/credits",
            json={"amount": 5},
        )
        assert resp.status_code == 401


class TestCreditAdjust:
    def test_positive_amount_increases_balance(self, client, db_session):
        session, _ = db_session
        admin = _seed_user(session, email="admin@x", is_admin=True)
        target = _seed_user(session, email="t@x", credits=2)
        resp = client.post(
            f"/admin/users/{target.id}/credits",
            headers=_bearer(admin.id),
            json={"amount": 10, "reason": "pilot bonus"},
        )
        assert resp.status_code == 200, resp.text
        session.expire_all()
        assert session.query(User).filter(User.id == target.id).first().credits == 12

    def test_negative_amount_within_balance_succeeds(self, client, db_session):
        session, _ = db_session
        admin = _seed_user(session, email="admin@x", is_admin=True)
        target = _seed_user(session, email="t@x", credits=10)
        resp = client.post(
            f"/admin/users/{target.id}/credits",
            headers=_bearer(admin.id),
            json={"amount": -3, "reason": "claw back"},
        )
        assert resp.status_code == 200
        session.expire_all()
        assert session.query(User).filter(User.id == target.id).first().credits == 7

    def test_negative_amount_below_zero_rejected(self, client, db_session):
        session, _ = db_session
        admin = _seed_user(session, email="admin@x", is_admin=True)
        target = _seed_user(session, email="t@x", credits=2)
        resp = client.post(
            f"/admin/users/{target.id}/credits",
            headers=_bearer(admin.id),
            json={"amount": -10},
        )
        assert resp.status_code == 400
        assert "negative balance" in resp.json()["detail"].lower()
        session.expire_all()
        # Balance unchanged
        assert session.query(User).filter(User.id == target.id).first().credits == 2

    def test_credit_grant_to_unknown_user_returns_404(self, client, db_session):
        session, _ = db_session
        admin = _seed_user(session, email="admin@x", is_admin=True)
        resp = client.post(
            "/admin/users/99999/credits",
            headers=_bearer(admin.id),
            json={"amount": 5},
        )
        assert resp.status_code == 404


class TestToggleActive:
    def test_deactivate_bumps_token_revocation_cutoff(self, client, db_session):
        session, _ = db_session
        admin = _seed_user(session, email="admin@x", is_admin=True)
        target = _seed_user(session, email="t@x")
        # Pre-deactivation: cutoff is None
        assert target.tokens_invalidated_after is None
        resp = client.post(
            f"/admin/users/{target.id}/active",
            headers=_bearer(admin.id),
            json={"is_active": False},
        )
        assert resp.status_code == 200, resp.text
        session.expire_all()
        refreshed = session.query(User).filter(User.id == target.id).first()
        assert refreshed.is_active is False
        # The cutoff was bumped on deactivation.
        assert refreshed.tokens_invalidated_after is not None

    def test_reactivate_does_not_bump_cutoff(self, client, db_session):
        session, _ = db_session
        admin = _seed_user(session, email="admin@x", is_admin=True)
        target = _seed_user(session, email="t@x")
        target.is_active = False
        session.commit()
        target_id = target.id
        resp = client.post(
            f"/admin/users/{target_id}/active",
            headers=_bearer(admin.id),
            json={"is_active": True},
        )
        assert resp.status_code == 200
        session.expire_all()
        refreshed = session.query(User).filter(User.id == target_id).first()
        assert refreshed.is_active is True

    def test_admin_cannot_self_deactivate(self, client, db_session):
        session, _ = db_session
        admin = _seed_user(session, email="admin@x", is_admin=True)
        resp = client.post(
            f"/admin/users/{admin.id}/active",
            headers=_bearer(admin.id),
            json={"is_active": False},
        )
        assert resp.status_code == 400


class TestToggleAdmin:
    def test_demote_admin_bumps_token_revocation_cutoff(self, client, db_session):
        session, _ = db_session
        admin = _seed_user(session, email="admin@x", is_admin=True)
        peer_admin = _seed_user(session, email="peer@x", is_admin=True)
        peer_id = peer_admin.id
        assert peer_admin.tokens_invalidated_after is None
        resp = client.post(
            f"/admin/users/{peer_id}/admin",
            headers=_bearer(admin.id),
            json={"is_admin": False},
        )
        assert resp.status_code == 200, resp.text
        session.expire_all()
        refreshed = session.query(User).filter(User.id == peer_id).first()
        assert refreshed.is_admin is False
        # Demotion bumps cutoff so the demoted admin's tokens are revoked.
        assert refreshed.tokens_invalidated_after is not None

    def test_promote_user_does_not_bump_cutoff(self, client, db_session):
        session, _ = db_session
        admin = _seed_user(session, email="admin@x", is_admin=True)
        target = _seed_user(session, email="t@x")
        target_id = target.id
        resp = client.post(
            f"/admin/users/{target_id}/admin",
            headers=_bearer(admin.id),
            json={"is_admin": True},
        )
        assert resp.status_code == 200
        session.expire_all()
        refreshed = session.query(User).filter(User.id == target_id).first()
        assert refreshed.is_admin is True
        # Promotion doesn't need revocation — the new privilege is read
        # fresh on every request from the DB.

    def test_admin_cannot_self_demote(self, client, db_session):
        session, _ = db_session
        admin = _seed_user(session, email="admin@x", is_admin=True)
        resp = client.post(
            f"/admin/users/{admin.id}/admin",
            headers=_bearer(admin.id),
            json={"is_admin": False},
        )
        assert resp.status_code == 400
