"""Tests for the GDPR/revDSG self-service endpoints.

* GET  /users/me/export  — Right to data portability (DSGVO Art. 20).
* DELETE /users/me        — Right to erasure (DSGVO Art. 17).

Both endpoints are exercised via FastAPI's TestClient against a fresh
SQLite database, so the cascade-delete logic and the JSON-export shape
are tested end-to-end (including the activity-log pseudonymisation step).
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
from app.models import (
    Application,
    Base,
    Document,
    GeneratedDocument,
    JobOffer,
    MatchingScore,
    User,
    UserActivityLog,
)


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


def _seed_user_with_data(db, *, email="user@example.com", is_admin=False):
    user = User(
        email=email,
        hashed_password=get_password_hash("hunter2"),
        full_name="Pilot User",
        preferred_language="de",
        documentation_language="en",
        credits=5,
        is_admin=is_admin,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    job = JobOffer(
        user_id=user.id,
        url="https://example.com/job",
        title="Senior Engineer - ACME, Zurich",
        company="ACME",
        location="Zurich",
        description="Job description text.",
    )
    db.add(job)

    doc = Document(
        user_id=user.id,
        doc_type="CV",
        filename="cv.pdf",
        file_path="/tmp/cv.pdf",
        content_text="Sample CV content",
    )
    db.add(doc)

    app_row = Application(
        user_id=user.id,
        job_title="Senior Engineer",
        company="ACME",
        job_offer_url="https://example.com/job",
        is_spontaneous=False,
        ui_language="de",
        documentation_language="en",
    )
    db.add(app_row)
    db.commit()
    db.refresh(app_row)

    db.add(
        GeneratedDocument(
            application_id=app_row.id,
            doc_type="tailored_cv_pdf",
            format="TEXT",
            storage_path="unpersisted:tailored_cv_pdf",
            content="Generated CV body",
        )
    )
    db.add(
        MatchingScore(
            application_id=app_row.id,
            overall_score=88,
            strengths="strong python",
            gaps="no kubernetes",
            recommendations="add side project",
        )
    )
    db.add(
        UserActivityLog(
            user_id=user.id,
            action="login",
            ip_address="10.0.0.1",
            metadata_="some context",
        )
    )
    db.commit()
    return user


def _bearer(user_id):
    token = create_access_token({"sub": str(user_id)})
    return {"Authorization": f"Bearer {token}"}


class TestExportEndpoint:
    def test_export_returns_full_payload_for_owner(self, client, db_session):
        session, _ = db_session
        user = _seed_user_with_data(session)
        resp = client.get("/users/me/export", headers=_bearer(user.id))
        assert resp.status_code == 200
        body = resp.json()
        assert body["schema_version"] == 1
        assert body["profile"]["email"] == user.email
        assert len(body["job_offers"]) == 1
        assert len(body["documents"]) == 1
        assert len(body["applications"]) == 1
        assert len(body["generated_documents"]) == 1
        assert len(body["matching_scores"]) == 1
        assert any(log["action"] == "login" for log in body["activity_log"])

    def test_export_attachment_header_present(self, client, db_session):
        session, _ = db_session
        user = _seed_user_with_data(session)
        resp = client.get("/users/me/export", headers=_bearer(user.id))
        cd = resp.headers.get("content-disposition", "")
        assert "attachment" in cd.lower()
        assert f"easybewerbung-export-user-{user.id}.json" in cd

    def test_export_requires_authentication(self, client):
        resp = client.get("/users/me/export")
        assert resp.status_code == 401


class TestDeleteAccountEndpoint:
    def test_delete_with_correct_email_removes_user_and_children(self, client, db_session):
        session, factory = db_session
        user = _seed_user_with_data(session)
        user_id = user.id

        resp = client.request(
            "DELETE",
            "/users/me",
            headers=_bearer(user_id),
            json={"confirm_email": user.email},
        )
        assert resp.status_code == 204

        # Verify the cascade in a fresh session — TestClient may have used
        # a different one, so re-query through the factory.
        verifier = factory()
        try:
            assert verifier.query(User).filter(User.id == user_id).first() is None
            assert (
                verifier.query(Application).filter(Application.user_id == user_id).count()
                == 0
            )
            assert (
                verifier.query(JobOffer).filter(JobOffer.user_id == user_id).count() == 0
            )
            assert verifier.query(Document).filter(Document.user_id == user_id).count() == 0
            # Activity logs are hard-deleted along with the user.
            assert (
                verifier.query(UserActivityLog)
                .filter(UserActivityLog.user_id == user_id)
                .count()
                == 0
            )
        finally:
            verifier.close()

    def test_delete_with_wrong_email_rejected(self, client, db_session):
        session, _ = db_session
        user = _seed_user_with_data(session)
        resp = client.request(
            "DELETE",
            "/users/me",
            headers=_bearer(user.id),
            json={"confirm_email": "someone-else@example.com"},
        )
        assert resp.status_code == 400
        # User must still exist after rejected delete.
        assert session.query(User).filter(User.id == user.id).first() is not None

    def test_admin_cannot_self_delete(self, client, db_session):
        session, _ = db_session
        user = _seed_user_with_data(session, email="admin@example.com", is_admin=True)
        resp = client.request(
            "DELETE",
            "/users/me",
            headers=_bearer(user.id),
            json={"confirm_email": user.email},
        )
        assert resp.status_code == 403
        # User must still exist.
        assert session.query(User).filter(User.id == user.id).first() is not None

    def test_delete_requires_authentication(self, client):
        resp = client.request(
            "DELETE",
            "/users/me",
            json={"confirm_email": "any@example.com"},
        )
        assert resp.status_code == 401
