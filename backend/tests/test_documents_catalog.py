"""Smoke test for GET /documents/catalog.

Iteration-3 testing-audit P1: ``app/api/endpoints/documents.py`` had
33% coverage and the catalog endpoint had no test at all. The endpoint
combines a DB-read (``get_document_catalog_for_api``) with the static
``DOCUMENT_PACKAGES`` constant; a regression in either silently 500s
or returns a malformed shape.

Public endpoint — no auth required.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.main import app
from app.models import Base, DocumentType


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


class TestDocumentsCatalog:
    def test_endpoint_returns_200_and_correct_shape(self, client):
        resp = client.get("/documents/catalog")
        assert resp.status_code == 200
        body = resp.json()
        assert "catalog" in body
        assert "packages" in body
        # Even on an empty DB, the static fallback supplies entries.
        assert isinstance(body["catalog"], (list, dict))
        assert isinstance(body["packages"], (list, dict))

    def test_no_auth_required(self, client):
        # Catalog is intentionally public; no Authorization header sent.
        resp = client.get("/documents/catalog")
        assert resp.status_code == 200

    def test_db_seeded_doctype_appears_in_catalog(self, client, db_session):
        session, _ = db_session
        # Seed a single DocumentType row in the "essential_pack" category;
        # the endpoint groups by category, so we look for our seeded title
        # under the "essential_pack" key rather than at the top level.
        session.add(
            DocumentType(
                key="custom_type_xyz",
                title="Custom XYZ Type",
                category="essential_pack",
                description="Custom test type",
                outputs="[]",
                is_active=True,
            )
        )
        session.commit()
        resp = client.get("/documents/catalog")
        assert resp.status_code == 200
        body = resp.json()
        # Walk the structure to find our seeded title; whether the catalog
        # groups by category as a dict-of-lists or as a flat list is an
        # implementation detail this test deliberately tolerates.
        haystack = repr(body["catalog"])
        assert "Custom XYZ Type" in haystack or "custom_type_xyz" in haystack
