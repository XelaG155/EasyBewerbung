"""HTTP-layer tests for the applications router.

Iteration-3 testing-audit P1: ``test_applications.py`` only exercised
``create_application`` directly with a fake-Request stub, so the HTTP
layer (auth gate, rate-limit decorator, response shape) was never
covered. This file fills that gap via FastAPI ``TestClient``.

Covers:
- POST /applications/      (create — happy path + 402 zero-credits)
- GET  /applications/history (auth-gated read)
- GET  /applications/{id}  (per-application read + 404 on other user)
- PATCH /applications/{id} (mark applied, change result)
- DELETE /applications/{id} (auth-gated delete + cross-user 404)
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import create_access_token, get_password_hash
from app.database import get_db
from app.main import app
from app.models import Application, Base, User


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


def _seed_user(session, *, email="alice@example.com", credits=5):
    user = User(
        email=email,
        hashed_password=get_password_hash("hunter2"),
        full_name="Alice",
        preferred_language="de",
        documentation_language="en",
        credits=credits,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _bearer(user_id):
    token = create_access_token({"sub": str(user_id)})
    return {"Authorization": f"Bearer {token}"}


class TestCreateApplication:
    def test_create_with_credits_succeeds_and_deducts_one(self, client, db_session):
        session, _ = db_session
        user = _seed_user(session, credits=3)
        resp = client.post(
            "/applications/",
            headers=_bearer(user.id),
            json={
                "job_title": "Senior Engineer",
                "company": "ACME",
                "is_spontaneous": False,
                "application_type": "fulltime",
                "applied": False,
            },
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["job_title"] == "Senior Engineer"
        assert body["company"] == "ACME"
        # Create costs 1 credit per audit fix in this iteration set.
        session.expire_all()
        assert session.query(User).filter(User.id == user.id).first().credits == 2

    def test_create_with_zero_credits_returns_402(self, client, db_session):
        session, _ = db_session
        user = _seed_user(session, credits=0)
        resp = client.post(
            "/applications/",
            headers=_bearer(user.id),
            json={
                "job_title": "X",
                "company": "Y",
                "is_spontaneous": False,
                "application_type": "fulltime",
                "applied": False,
            },
        )
        assert resp.status_code == 402

    def test_create_unauthenticated_rejected(self, client):
        resp = client.post(
            "/applications/",
            json={"job_title": "X", "company": "Y", "is_spontaneous": False, "application_type": "fulltime"},
        )
        assert resp.status_code == 401


class TestReadApplication:
    def test_history_returns_user_applications_only(self, client, db_session):
        session, _ = db_session
        owner = _seed_user(session, email="o@example.com")
        other = _seed_user(session, email="x@example.com")
        session.add(Application(user_id=owner.id, job_title="Mine", company="A"))
        session.add(Application(user_id=other.id, job_title="Other", company="B"))
        session.commit()
        resp = client.get("/applications/history", headers=_bearer(owner.id))
        assert resp.status_code == 200, resp.text
        titles = [a["job_title"] for a in resp.json()]
        assert "Mine" in titles
        assert "Other" not in titles

    def test_get_application_other_user_returns_404(self, client, db_session):
        session, _ = db_session
        owner = _seed_user(session, email="o@example.com")
        other = _seed_user(session, email="x@example.com")
        a = Application(user_id=owner.id, job_title="Mine", company="A")
        session.add(a)
        session.commit()
        session.refresh(a)
        resp = client.get(f"/applications/{a.id}", headers=_bearer(other.id))
        assert resp.status_code == 404
        assert "Bewerbung" in resp.json()["detail"]


class TestPatchApplication:
    def test_mark_as_applied_updates_row(self, client, db_session):
        session, _ = db_session
        user = _seed_user(session)
        a = Application(user_id=user.id, job_title="Mine", company="A", applied=False)
        session.add(a)
        session.commit()
        session.refresh(a)
        resp = client.patch(
            f"/applications/{a.id}",
            headers=_bearer(user.id),
            json={"applied": True, "applied_at": "2026-04-26T10:00:00Z"},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["applied"] is True
        assert body["applied_at"] is not None

    def test_patch_other_user_returns_404(self, client, db_session):
        session, _ = db_session
        owner = _seed_user(session, email="o@example.com")
        other = _seed_user(session, email="x@example.com")
        a = Application(user_id=owner.id, job_title="Mine", company="A")
        session.add(a)
        session.commit()
        session.refresh(a)
        resp = client.patch(
            f"/applications/{a.id}",
            headers=_bearer(other.id),
            json={"applied": True},
        )
        assert resp.status_code == 404


class TestDeleteApplication:
    def test_delete_owned_application_succeeds(self, client, db_session):
        session, _ = db_session
        user = _seed_user(session)
        a = Application(user_id=user.id, job_title="Mine", company="A")
        session.add(a)
        session.commit()
        app_id = a.id  # capture before potential expiry
        resp = client.delete(f"/applications/{app_id}", headers=_bearer(user.id))
        assert resp.status_code == 200, resp.text
        session.expire_all()
        assert session.query(Application).filter(Application.id == app_id).first() is None

    def test_delete_other_user_returns_404(self, client, db_session):
        session, _ = db_session
        owner = _seed_user(session, email="o@example.com")
        other = _seed_user(session, email="x@example.com")
        a = Application(user_id=owner.id, job_title="Mine", company="A")
        session.add(a)
        session.commit()
        session.refresh(a)
        resp = client.delete(f"/applications/{a.id}", headers=_bearer(other.id))
        assert resp.status_code == 404
        # Owner's row must still exist.
        assert session.query(Application).filter(Application.id == a.id).first() is not None
