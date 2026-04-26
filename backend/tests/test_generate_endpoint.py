"""End-to-end tests for POST /applications/{id}/generate.

Covers the credit-deduction path now that it uses ``with_for_update``,
the new doc_type validation guard, the audit log entry for credit
spend, and the response shape (remaining_credits reflects the locked
read, not the SQLAlchemy identity-cache snapshot).

The Celery task itself is patched out so we don't hit Redis or any LLM
during the tests — we only verify the synchronous endpoint behaviour.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import tasks as tasks_module
from app.auth import create_access_token, get_password_hash
from app.database import get_db
from app.main import app
from app.models import (
    Application,
    Base,
    Document,
    DocumentTemplate,
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
def client(db_session, monkeypatch):
    session, factory = db_session

    def override_get_db():
        s = factory()
        try:
            yield s
        finally:
            s.close()

    # Patch out the Celery dispatch so the test doesn't need a broker.
    class _FakeAsyncResult:
        id = "fake-task-id"

    monkeypatch.setattr(
        tasks_module.generate_documents_task,
        "delay",
        lambda *args, **kwargs: _FakeAsyncResult(),
    )

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_db, None)


def _seed(session, *, credits=5, with_template=True, with_cv=True):
    user = User(
        email="alice@example.com",
        hashed_password=get_password_hash("hunter2"),
        full_name="Alice",
        preferred_language="de",
        documentation_language="en",
        credits=credits,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    if with_cv:
        session.add(
            Document(
                user_id=user.id,
                doc_type="CV",
                filename="cv.pdf",
                file_path="/tmp/cv.pdf",
                content_text="Alice is a backend engineer with 5 years experience.",
            )
        )

    if with_template:
        session.add(
            DocumentTemplate(
                doc_type="tailored_cv_pdf",
                display_name="CV",
                credit_cost=2,
                language_source="documentation_language",
                llm_provider="openai",
                llm_model="gpt-4o-mini",
                prompt_template="Write a CV for {language}",
                is_active=True,
            )
        )
        session.add(
            DocumentTemplate(
                doc_type="motivational_letter_pdf",
                display_name="Motivation",
                credit_cost=1,
                language_source="documentation_language",
                llm_provider="openai",
                llm_model="gpt-4o-mini",
                prompt_template="Write a motivation letter for {language}",
                is_active=True,
            )
        )

    app_row = Application(
        user_id=user.id,
        job_title="Senior Engineer",
        company="ACME",
        documentation_language="en",
    )
    session.add(app_row)
    session.commit()
    session.refresh(app_row)

    return user, app_row


def _bearer(user_id):
    token = create_access_token({"sub": str(user_id)})
    return {"Authorization": f"Bearer {token}"}


class TestGenerateHappyPath:
    def test_credits_deducted_and_response_reports_remaining(self, client, db_session):
        session, _ = db_session
        user, application = _seed(session, credits=5)
        resp = client.post(
            f"/applications/{application.id}/generate",
            headers=_bearer(user.id),
            json=["tailored_cv_pdf", "motivational_letter_pdf"],
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["credits_used"] == 3  # 2 + 1
        assert body["remaining_credits"] == 2  # 5 - 3
        assert body["total_documents"] == 2
        # User row in DB reflects the deduction.
        session.expire_all()
        assert session.query(User).filter(User.id == user.id).first().credits == 2

    def test_audit_log_entry_recorded(self, client, db_session):
        session, _ = db_session
        user, application = _seed(session)
        client.post(
            f"/applications/{application.id}/generate",
            headers=_bearer(user.id),
            json=["tailored_cv_pdf"],
        )
        log = (
            session.query(UserActivityLog)
            .filter(
                UserActivityLog.user_id == user.id,
                UserActivityLog.action == "generate_documents",
            )
            .first()
        )
        assert log is not None
        assert "tailored_cv_pdf" in (log.metadata_ or "")
        assert "cost=2" in (log.metadata_ or "")


class TestGenerateValidation:
    def test_unknown_doc_type_rejected_with_400(self, client, db_session):
        session, _ = db_session
        user, application = _seed(session)
        resp = client.post(
            f"/applications/{application.id}/generate",
            headers=_bearer(user.id),
            json=["tailored_cv_pdf", "no_such_type"],
        )
        assert resp.status_code == 400
        assert "no_such_type" in resp.json()["detail"]
        # Credits NOT deducted on validation failure.
        session.expire_all()
        assert session.query(User).filter(User.id == user.id).first().credits == 5

    def test_empty_doc_types_rejected(self, client, db_session):
        session, _ = db_session
        user, application = _seed(session)
        resp = client.post(
            f"/applications/{application.id}/generate",
            headers=_bearer(user.id),
            json=[],
        )
        assert resp.status_code == 400

    def test_insufficient_credits_returns_402(self, client, db_session):
        session, _ = db_session
        user, application = _seed(session, credits=1)
        resp = client.post(
            f"/applications/{application.id}/generate",
            headers=_bearer(user.id),
            json=["tailored_cv_pdf"],  # cost 2 > balance 1
        )
        assert resp.status_code == 402

    def test_missing_cv_returns_400(self, client, db_session):
        session, _ = db_session
        user, application = _seed(session, with_cv=False)
        resp = client.post(
            f"/applications/{application.id}/generate",
            headers=_bearer(user.id),
            json=["tailored_cv_pdf"],
        )
        assert resp.status_code == 400


class TestGenerateAuth:
    def test_unauthenticated_rejected(self, client):
        resp = client.post(
            "/applications/1/generate",
            json=["tailored_cv_pdf"],
        )
        assert resp.status_code == 401

    def test_other_user_application_rejected(self, client, db_session):
        session, _ = db_session
        owner, application = _seed(session)
        # Create a second user with their own credits.
        other = User(
            email="bob@example.com",
            hashed_password=get_password_hash("xx"),
            credits=10,
        )
        session.add(other)
        session.commit()
        session.refresh(other)
        resp = client.post(
            f"/applications/{application.id}/generate",
            headers=_bearer(other.id),
            json=["tailored_cv_pdf"],
        )
        # Application belongs to ``owner``, so ``other`` gets 404.
        assert resp.status_code == 404
