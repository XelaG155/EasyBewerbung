"""Tests for the admin endpoints that manage document types and LLM models.

These verify:
- the seeder populates both tables and is idempotent;
- create/update/delete round-trip through the endpoint functions;
- duplicate-key and not-found errors return the right HTTP status codes;
- non-admin users cannot see inactive entries (403);
- ``ALLOWED_GENERATED_DOC_TYPES`` is fully covered by the seed (no regression
  for the document generation pipeline).
"""
from __future__ import annotations

import asyncio
from typing import Iterator

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.endpoints.document_types import (
    DocumentTypeCreate,
    DocumentTypeUpdate,
    LlmModelCreate,
    LlmModelUpdate,
    PREVIEW_SAMPLE_VALUES,
    PromptPreviewRequest,
    create_document_type,
    create_llm_model,
    delete_document_type,
    delete_llm_model,
    list_document_types,
    list_llm_models,
    preview_document_template_prompt,
    render_preview,
    seed_catalog_endpoint,
    update_document_type,
    update_llm_model,
)
from app.document_catalog import ALLOWED_GENERATED_DOC_TYPES
from app.models import Base, DocumentTemplate, DocumentType, LlmModel, User
from app.seed_catalog_to_db import seed_document_types, seed_llm_models


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def session_factory():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autocommit=False, autoflush=False)


@pytest.fixture()
def db_session(session_factory) -> Iterator:
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def admin_user(db_session) -> User:
    admin = User(
        email="admin@example.com",
        hashed_password="hashed",
        is_admin=True,
        credits=0,
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin


@pytest.fixture()
def regular_user(db_session) -> User:
    user = User(
        email="user@example.com",
        hashed_password="hashed",
        is_admin=False,
        credits=0,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _req():
    """Build a real starlette Request the ``@limiter.limit`` decorator accepts."""
    from starlette.requests import Request

    scope = {
        "type": "http",
        "method": "POST",
        "path": "/",
        "headers": [],
        "query_string": b"",
        "client": ("127.0.0.1", 0),
        "server": ("testserver", 80),
        "scheme": "http",
        "root_path": "",
        # slowapi reads request.app.state.limiter; providing a stub keeps it happy.
        "app": type(
            "AppStub",
            (),
            {
                "state": type(
                    "StateStub",
                    (),
                    {"limiter": None, "view_rate_limit": None, "_rate_limit_exceeded": None},
                )()
            },
        )(),
    }
    return Request(scope)


# ---------------------------------------------------------------------------
# Seed tests
# ---------------------------------------------------------------------------


def test_seed_document_types_creates_all_catalog_entries(db_session):
    result = seed_document_types(db_session, force_update=False)
    assert result["created"] > 0
    assert result["updated"] == 0
    assert result["skipped"] == 0

    rows = db_session.query(DocumentType).all()
    keys = {row.key for row in rows}

    # Everything the document-generation pipeline is allowed to produce
    # must exist in the new catalog.
    assert ALLOWED_GENERATED_DOC_TYPES.issubset(keys), (
        f"Missing keys: {ALLOWED_GENERATED_DOC_TYPES - keys}"
    )


def test_seed_document_types_is_idempotent(db_session):
    first = seed_document_types(db_session, force_update=False)
    second = seed_document_types(db_session, force_update=False)

    assert second["created"] == 0
    assert second["updated"] == 0
    assert second["skipped"] == first["created"]


def test_seed_document_types_force_update_refreshes_rows(db_session):
    seed_document_types(db_session, force_update=False)

    # Tamper with one row to prove force-update overwrites it.
    row = db_session.query(DocumentType).first()
    row.title = "Tampered title"
    db_session.commit()

    result = seed_document_types(db_session, force_update=True)
    assert result["updated"] > 0

    db_session.refresh(row)
    assert row.title != "Tampered title"


def test_seed_llm_models_creates_all_providers(db_session):
    result = seed_llm_models(db_session, force_update=False)
    assert result["created"] > 0

    providers = {row.provider for row in db_session.query(LlmModel).all()}
    assert providers == {"openai", "anthropic", "google"}


# ---------------------------------------------------------------------------
# DocumentType CRUD
# ---------------------------------------------------------------------------


def test_create_document_type_roundtrip(db_session, admin_user):
    payload = DocumentTypeCreate(
        key="custom_briefing",
        title="Custom Briefing",
        description="A user-defined briefing document.",
        outputs=["PDF"],
        category="high_impact_addons",
        sort_order=99,
    )
    result = asyncio.run(
        create_document_type(
            payload=payload,
            request=_req(),
            db=db_session,
            admin=admin_user,
        )
    )

    assert result["key"] == "custom_briefing"
    assert result["category"] == "high_impact_addons"
    assert result["outputs"] == ["PDF"]
    assert result["is_active"] is True

    # The row is really persisted.
    row = (
        db_session.query(DocumentType)
        .filter(DocumentType.key == "custom_briefing")
        .one()
    )
    assert row.title == "Custom Briefing"


def test_create_document_type_rejects_duplicate_key(db_session, admin_user):
    payload = DocumentTypeCreate(key="dupe_key", title="First")
    asyncio.run(
        create_document_type(
            payload=payload, request=_req(), db=db_session, admin=admin_user
        )
    )

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            create_document_type(
                payload=DocumentTypeCreate(key="dupe_key", title="Second"),
                request=_req(),
                db=db_session,
                admin=admin_user,
            )
        )
    assert exc_info.value.status_code == 409
    assert "existiert bereits" in str(exc_info.value.detail).lower()


def test_update_document_type_patches_fields(db_session, admin_user):
    asyncio.run(
        create_document_type(
            payload=DocumentTypeCreate(key="patchme", title="Original"),
            request=_req(),
            db=db_session,
            admin=admin_user,
        )
    )
    row = db_session.query(DocumentType).filter(DocumentType.key == "patchme").one()

    result = asyncio.run(
        update_document_type(
            document_type_id=row.id,
            payload=DocumentTypeUpdate(title="Updated", is_active=False),
            request=_req(),
            db=db_session,
            admin=admin_user,
        )
    )
    assert result["title"] == "Updated"
    assert result["is_active"] is False


def test_update_document_type_not_found(db_session, admin_user):
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            update_document_type(
                document_type_id=999_999,
                payload=DocumentTypeUpdate(title="x"),
                request=_req(),
                db=db_session,
                admin=admin_user,
            )
        )
    assert exc_info.value.status_code == 404


def test_delete_document_type(db_session, admin_user):
    # create_draft_template=False so the DocumentType has no dependent rows
    # and can be deleted cleanly in this test.
    asyncio.run(
        create_document_type(
            payload=DocumentTypeCreate(
                key="deleteme",
                title="DeleteMe",
                create_draft_template=False,
            ),
            request=_req(),
            db=db_session,
            admin=admin_user,
        )
    )
    row = db_session.query(DocumentType).filter(DocumentType.key == "deleteme").one()

    result = asyncio.run(
        delete_document_type(
            document_type_id=row.id,
            request=_req(),
            db=db_session,
            admin=admin_user,
        )
    )
    assert result["key"] == "deleteme"
    assert (
        db_session.query(DocumentType)
        .filter(DocumentType.key == "deleteme")
        .first()
        is None
    )


def test_delete_document_type_refuses_when_referenced(db_session, admin_user):
    """Orphan protection: cannot delete a DocumentType that a template uses."""
    asyncio.run(
        create_document_type(
            payload=DocumentTypeCreate(
                key="still_used",
                title="Still Used",
                create_draft_template=True,  # also creates a DocumentTemplate
            ),
            request=_req(),
            db=db_session,
            admin=admin_user,
        )
    )
    row = db_session.query(DocumentType).filter(DocumentType.key == "still_used").one()

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            delete_document_type(
                document_type_id=row.id,
                request=_req(),
                db=db_session,
                admin=admin_user,
            )
        )
    assert exc_info.value.status_code == 409
    assert "referenziert" in str(exc_info.value.detail)


def test_delete_llm_model_refuses_when_referenced(db_session, admin_user):
    """Orphan protection: cannot delete an LLM model that a template uses."""
    llm = asyncio.run(
        create_llm_model(
            payload=LlmModelCreate(
                provider="openai",
                model_id="gpt-test-refused",
                display_name="GPT Test Refused",
            ),
            request=_req(),
            db=db_session,
            admin=admin_user,
        )
    )

    # Template referencing this model
    template = DocumentTemplate(
        doc_type="orphan_check",
        display_name="Orphan Check",
        credit_cost=1,
        language_source="documentation_language",
        llm_provider="openai",
        llm_model="gpt-test-refused",
        prompt_template="x {language}",
        is_active=True,
    )
    db_session.add(template)
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            delete_llm_model(
                llm_model_id=llm["id"],
                request=_req(),
                db=db_session,
                admin=admin_user,
            )
        )
    assert exc_info.value.status_code == 409
    assert "Template" in str(exc_info.value.detail)


def test_create_document_type_also_creates_draft_template(db_session, admin_user):
    """Blocker #8: admins must not land in a dead end. Creating a DocumentType
    should by default also create a draft DocumentTemplate so the admin can
    open the drawer and configure it immediately.
    """
    result = asyncio.run(
        create_document_type(
            payload=DocumentTypeCreate(
                key="brand_new_type",
                title="Brand New Type",
                category="high_impact_addons",
            ),
            request=_req(),
            db=db_session,
            admin=admin_user,
        )
    )
    assert result["draft_template_id"] is not None

    template = (
        db_session.query(DocumentTemplate)
        .filter(DocumentTemplate.doc_type == "brand_new_type")
        .one()
    )
    assert template.display_name == "Brand New Type"
    assert template.is_active is False  # draft starts disabled
    assert "{language}" in template.prompt_template


def test_update_document_type_outputs_null_is_ignored(db_session, admin_user):
    """Simplifier #1: payload {"outputs": null} must not violate NOT NULL."""
    asyncio.run(
        create_document_type(
            payload=DocumentTypeCreate(
                key="null_outputs",
                title="Null Outputs",
                outputs=["PDF"],
                create_draft_template=False,
            ),
            request=_req(),
            db=db_session,
            admin=admin_user,
        )
    )
    row = db_session.query(DocumentType).filter(DocumentType.key == "null_outputs").one()

    # Simulate a client sending an explicit null for outputs.
    result = asyncio.run(
        update_document_type(
            document_type_id=row.id,
            payload=DocumentTypeUpdate(outputs=None, title="Patched"),
            request=_req(),
            db=db_session,
            admin=admin_user,
        )
    )
    assert result["title"] == "Patched"
    # outputs untouched because None was ignored
    assert result["outputs"] == ["PDF"]


def test_list_document_types_hides_inactive_by_default(db_session, admin_user, regular_user):
    asyncio.run(
        create_document_type(
            payload=DocumentTypeCreate(
                key="active_one", title="Active", is_active=True
            ),
            request=_req(),
            db=db_session,
            admin=admin_user,
        )
    )
    asyncio.run(
        create_document_type(
            payload=DocumentTypeCreate(
                key="inactive_one", title="Inactive", is_active=False
            ),
            request=_req(),
            db=db_session,
            admin=admin_user,
        )
    )

    default_list = asyncio.run(
        list_document_types(
            request=_req(),
            include_inactive=False,
            db=db_session,
            current_user=regular_user,
        )
    )
    keys = {d["key"] for d in default_list}
    assert "active_one" in keys
    assert "inactive_one" not in keys

    # Non-admin requesting inactive should be rejected.
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            list_document_types(
                request=_req(),
                include_inactive=True,
                db=db_session,
                current_user=regular_user,
            )
        )
    assert exc_info.value.status_code == 403


# ---------------------------------------------------------------------------
# LlmModel CRUD
# ---------------------------------------------------------------------------


def test_create_llm_model_roundtrip(db_session, admin_user):
    payload = LlmModelCreate(
        provider="openai",
        model_id="gpt-test-1",
        display_name="GPT Test 1",
    )
    result = asyncio.run(
        create_llm_model(
            payload=payload, request=_req(), db=db_session, admin=admin_user
        )
    )
    assert result["provider"] == "openai"
    assert result["model_id"] == "gpt-test-1"


def test_create_llm_model_rejects_duplicate(db_session, admin_user):
    payload = LlmModelCreate(
        provider="openai", model_id="gpt-dupe", display_name="Dupe"
    )
    asyncio.run(
        create_llm_model(
            payload=payload, request=_req(), db=db_session, admin=admin_user
        )
    )

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            create_llm_model(
                payload=payload,
                request=_req(),
                db=db_session,
                admin=admin_user,
            )
        )
    assert exc_info.value.status_code == 409


def test_update_llm_model_toggles_active(db_session, admin_user):
    payload = LlmModelCreate(
        provider="anthropic", model_id="claude-test", display_name="Claude Test"
    )
    created = asyncio.run(
        create_llm_model(
            payload=payload, request=_req(), db=db_session, admin=admin_user
        )
    )

    toggled = asyncio.run(
        update_llm_model(
            llm_model_id=created["id"],
            payload=LlmModelUpdate(is_active=False),
            request=_req(),
            db=db_session,
            admin=admin_user,
        )
    )
    assert toggled["is_active"] is False


def test_delete_llm_model(db_session, admin_user):
    payload = LlmModelCreate(
        provider="google", model_id="gemini-test", display_name="Gemini Test"
    )
    created = asyncio.run(
        create_llm_model(
            payload=payload, request=_req(), db=db_session, admin=admin_user
        )
    )

    result = asyncio.run(
        delete_llm_model(
            llm_model_id=created["id"],
            request=_req(),
            db=db_session,
            admin=admin_user,
        )
    )
    assert result["model_id"] == "gemini-test"


# ---------------------------------------------------------------------------
# Seed endpoint
# ---------------------------------------------------------------------------


def test_seed_catalog_endpoint_runs_both_seeders(db_session, admin_user):
    result = asyncio.run(
        seed_catalog_endpoint(
            request=_req(),
            force_update=False,
            db=db_session,
            admin=admin_user,
        )
    )
    assert result["document_types"]["created"] > 0
    assert result["llm_models"]["created"] > 0

    assert db_session.query(DocumentType).count() > 0
    assert db_session.query(LlmModel).count() > 0


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def test_document_type_invalid_category_rejected(db_session, admin_user):
    with pytest.raises(ValueError):
        DocumentTypeCreate(key="bad_cat", title="Bad", category="not_a_category")


def test_llm_model_invalid_provider_rejected(db_session, admin_user):
    with pytest.raises(ValueError):
        LlmModelCreate(provider="openapi", model_id="x", display_name="x")


def test_document_type_key_must_match_snake_case(db_session, admin_user):
    with pytest.raises(ValueError):
        DocumentTypeCreate(key="Bad-Key", title="Bad")


# ---------------------------------------------------------------------------
# Prompt preview (dry-run)
# ---------------------------------------------------------------------------


def test_render_preview_substitutes_known_placeholders():
    rendered, unresolved = render_preview(
        "Sprache: {language}. Typ: {doc_type_display}. Aufgabe: {task}."
    )
    assert "{language}" not in rendered
    assert "{doc_type_display}" not in rendered
    assert "{task}" not in rendered
    assert "Deutsch" in rendered
    assert unresolved == []


def test_render_preview_flags_unknown_placeholders():
    rendered, unresolved = render_preview(
        "Sprache: {language}. Extra: {unknown_variable}. Auch: {another_missing}."
    )
    assert "Deutsch" in rendered
    assert set(unresolved) == {"{unknown_variable}", "{another_missing}"}


def test_render_preview_handles_empty_template():
    rendered, unresolved = render_preview("")
    assert rendered == ""
    assert unresolved == []


def test_preview_endpoint_uses_saved_prompt(db_session, admin_user):
    template = DocumentTemplate(
        doc_type="preview_test",
        display_name="Preview Test",
        credit_cost=1,
        language_source="documentation_language",
        llm_provider="openai",
        llm_model="gpt-4o",
        prompt_template="Hello {language}, please {task}",
        is_active=True,
    )
    db_session.add(template)
    db_session.commit()
    db_session.refresh(template)

    result = asyncio.run(
        preview_document_template_prompt(
            template_id=template.id,
            payload=PromptPreviewRequest(prompt_template=None),
            request=_req(),
            db=db_session,
            admin=admin_user,
        )
    )
    assert result["doc_type"] == "preview_test"
    assert "{language}" not in result["rendered_prompt"]
    assert "{task}" not in result["rendered_prompt"]
    assert result["unresolved_placeholders"] == []
    assert result["source_length"] == len("Hello {language}, please {task}")


def test_preview_endpoint_uses_override_prompt(db_session, admin_user):
    template = DocumentTemplate(
        doc_type="preview_override",
        display_name="Preview Override",
        credit_cost=1,
        language_source="documentation_language",
        llm_provider="openai",
        llm_model="gpt-4o",
        prompt_template="Saved prompt {language}",
        is_active=True,
    )
    db_session.add(template)
    db_session.commit()
    db_session.refresh(template)

    result = asyncio.run(
        preview_document_template_prompt(
            template_id=template.id,
            payload=PromptPreviewRequest(
                prompt_template="Override prompt {doc_type_display} — {nonsense_field}"
            ),
            request=_req(),
            db=db_session,
            admin=admin_user,
        )
    )
    assert "Override prompt" in result["rendered_prompt"]
    assert "Saved prompt" not in result["rendered_prompt"]
    assert "{nonsense_field}" in result["unresolved_placeholders"]


def test_preview_endpoint_template_not_found(db_session, admin_user):
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            preview_document_template_prompt(
                template_id=999_999,
                payload=PromptPreviewRequest(prompt_template="x {language}"),
                request=_req(),
                db=db_session,
                admin=admin_user,
            )
        )
    assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# LLM provider sync (mocked provider responses)
# ---------------------------------------------------------------------------


def _make_mocked_sync(monkeypatch, *, openai_live_ids, anthropic_live_ids=None, google_live_ids=None):
    """Patch fetch_all_providers with canned responses."""
    from app.services.llm_provider_sync import LiveModel, ProviderListResult
    import app.api.endpoints.document_types as endpoint_module

    def fake_fetch_all():
        return {
            "openai": ProviderListResult(
                provider="openai",
                available=True,
                models=[
                    LiveModel(provider="openai", model_id=mid, display_name=mid)
                    for mid in openai_live_ids
                ],
            ),
            "anthropic": ProviderListResult(
                provider="anthropic",
                available=False,
                error="ANTHROPIC_API_KEY nicht gesetzt",
            )
            if anthropic_live_ids is None
            else ProviderListResult(
                provider="anthropic",
                available=True,
                models=[
                    LiveModel(provider="anthropic", model_id=mid, display_name=mid)
                    for mid in anthropic_live_ids
                ],
            ),
            "google": ProviderListResult(
                provider="google",
                available=False,
                error="GOOGLE_API_KEY nicht gesetzt",
            )
            if google_live_ids is None
            else ProviderListResult(
                provider="google",
                available=True,
                models=[
                    LiveModel(provider="google", model_id=mid, display_name=mid)
                    for mid in google_live_ids
                ],
            ),
        }

    monkeypatch.setattr(endpoint_module, "fetch_all_providers", fake_fetch_all)


def test_sync_check_detects_deprecated_and_new(db_session, admin_user, monkeypatch):
    from app.api.endpoints.document_types import sync_check_llm_models

    # Existing DB state: two models
    for sort_order, mid in enumerate(["gpt-4o", "gpt-3.5-turbo-legacy"]):
        db_session.add(
            LlmModel(
                provider="openai",
                model_id=mid,
                display_name=mid,
                sort_order=sort_order,
                is_active=True,
            )
        )
    db_session.commit()

    # Live: gpt-4o still there, gpt-3.5-turbo-legacy gone, gpt-5.0 is new.
    _make_mocked_sync(
        monkeypatch, openai_live_ids=["gpt-4o", "gpt-5.0"]
    )

    result = asyncio.run(
        sync_check_llm_models(
            request=_req(),
            db=db_session,
            admin=admin_user,
        )
    )

    openai_result = result["providers"]["openai"]
    assert openai_result["available"] is True

    deprecated_ids = [d["model_id"] for d in openai_result["deprecated"]]
    assert deprecated_ids == ["gpt-3.5-turbo-legacy"]

    new_ids = [n["model_id"] for n in openai_result["new"]]
    assert new_ids == ["gpt-5.0"]

    # Unavailable providers pass through cleanly
    assert result["providers"]["anthropic"]["available"] is False
    assert "ANTHROPIC_API_KEY" in result["providers"]["anthropic"]["error"]
    assert result["providers"]["anthropic"]["deprecated"] == []
    assert result["providers"]["anthropic"]["new"] == []


def test_sync_check_includes_referencing_templates_and_replacement(
    db_session, admin_user, monkeypatch
):
    from app.api.endpoints.document_types import sync_check_llm_models

    # Seed two models: gpt-4o (newer, active) and gpt-3.5-old (to be deprecated)
    new_model = LlmModel(
        provider="openai",
        model_id="gpt-4o",
        display_name="GPT-4o",
        sort_order=0,
        is_active=True,
    )
    old_model = LlmModel(
        provider="openai",
        model_id="gpt-3.5-old",
        display_name="GPT-3.5 Old",
        sort_order=10,
        is_active=True,
    )
    db_session.add_all([new_model, old_model])
    db_session.commit()

    # Template uses the old model
    tmpl = DocumentTemplate(
        doc_type="some_type",
        display_name="Some Type",
        credit_cost=1,
        language_source="documentation_language",
        llm_provider="openai",
        llm_model="gpt-3.5-old",
        prompt_template="{language}",
        is_active=True,
    )
    db_session.add(tmpl)
    db_session.commit()

    _make_mocked_sync(monkeypatch, openai_live_ids=["gpt-4o"])

    result = asyncio.run(
        sync_check_llm_models(
            request=_req(),
            db=db_session,
            admin=admin_user,
        )
    )

    deprecated = result["providers"]["openai"]["deprecated"]
    assert len(deprecated) == 1
    entry = deprecated[0]
    assert entry["model_id"] == "gpt-3.5-old"

    refs = entry["referencing_templates"]
    assert len(refs) == 1
    assert refs[0]["doc_type"] == "some_type"

    # Replacement should suggest the newer active model that still exists live
    assert entry["suggested_replacement"] is not None
    assert entry["suggested_replacement"]["model_id"] == "gpt-4o"


def test_import_llm_models_creates_and_skips(db_session, admin_user):
    from app.api.endpoints.document_types import (
        LlmImportItem,
        LlmImportRequest,
        import_llm_models,
    )

    # Pre-existing model
    db_session.add(
        LlmModel(
            provider="openai",
            model_id="gpt-existing",
            display_name="Existing",
            sort_order=0,
            is_active=True,
        )
    )
    db_session.commit()

    payload = LlmImportRequest(
        models=[
            LlmImportItem(
                provider="openai",
                model_id="gpt-existing",  # should be skipped
                display_name="Existing again",
            ),
            LlmImportItem(
                provider="openai",
                model_id="gpt-brand-new",
                display_name="Brand New",
            ),
            LlmImportItem(
                provider="anthropic",
                model_id="claude-imported",
                display_name="Claude Imported",
            ),
        ]
    )

    result = asyncio.run(
        import_llm_models(
            payload=payload,
            request=_req(),
            db=db_session,
            admin=admin_user,
        )
    )

    assert result["created"] == 2
    assert result["skipped"] == 1

    # The two new rows exist in DB
    assert (
        db_session.query(LlmModel)
        .filter(LlmModel.model_id == "gpt-brand-new")
        .count()
        == 1
    )
    assert (
        db_session.query(LlmModel)
        .filter(LlmModel.model_id == "claude-imported")
        .count()
        == 1
    )


def test_sync_check_no_changes_when_db_matches_live(db_session, admin_user, monkeypatch):
    from app.api.endpoints.document_types import sync_check_llm_models

    db_session.add(
        LlmModel(
            provider="openai",
            model_id="gpt-4o",
            display_name="GPT-4o",
            sort_order=0,
            is_active=True,
        )
    )
    db_session.commit()

    _make_mocked_sync(monkeypatch, openai_live_ids=["gpt-4o"])

    result = asyncio.run(
        sync_check_llm_models(
            request=_req(),
            db=db_session,
            admin=admin_user,
        )
    )
    assert result["providers"]["openai"]["deprecated"] == []
    assert result["providers"]["openai"]["new"] == []


def test_openai_chat_model_filter():
    """Regression guard around the _is_openai_chat_model heuristic."""
    from app.services.llm_provider_sync import _is_openai_chat_model

    # Include: chat models
    for mid in ("gpt-4o", "gpt-4.1", "gpt-4.1-mini", "o1-preview", "chatgpt-4o-latest"):
        assert _is_openai_chat_model(mid), f"{mid} should be chat"

    # Exclude: non-chat modalities
    for mid in (
        "dall-e-3",
        "whisper-1",
        "tts-1",
        "text-embedding-3-small",
        "gpt-3.5-turbo-instruct",
        "gpt-4o-audio-preview",
        "gpt-4o-realtime-preview",
        "gpt-4o-transcribe",
        "chatgpt-image-latest",
        "text-moderation-latest",
    ):
        assert not _is_openai_chat_model(mid), f"{mid} should NOT be chat"


# ---------------------------------------------------------------------------
# Per-doc-type prompt components from document_prompts.json
# ---------------------------------------------------------------------------


def test_tasks_resolves_role_task_instructions_from_json():
    """Runtime must pull role/task/instructions from document_prompts.json,
    not from hard-coded generic fallbacks. This is the bug that made the
    deep-prompt overhaul invisible to the LLM — guard against regression.
    """
    from app.tasks import (
        DOCUMENT_PROMPTS,
        _FALLBACK_ROLE,
        _resolve_prompt_components,
    )

    # document_prompts.json must actually load — not be empty
    assert len(DOCUMENT_PROMPTS) >= 15, (
        "document_prompts.json did not load correctly or is missing doc types"
    )

    # A known doc type must resolve to its specific (non-fallback) role
    role, task, instructions = _resolve_prompt_components("reference_summary")
    assert role != _FALLBACK_ROLE, (
        "reference_summary must use its JSON-defined role, not the generic fallback"
    )
    assert "Arbeitszeugnis" in role or "Swiss" in role, (
        "reference_summary role should reflect its Swiss Arbeitszeugnis specialization"
    )

    # Instructions must be long and rich — at least 2000 characters, since every
    # non-trivial template now has >30 instructions
    assert len(instructions) > 2000, (
        f"reference_summary instructions should be deep (got {len(instructions)} chars)"
    )

    # Numbered rendering: first line must start with '1.'
    assert instructions.startswith("1. "), (
        "Instructions must be rendered as a numbered list"
    )


def test_tasks_falls_back_for_unknown_doc_type():
    from app.tasks import (
        _FALLBACK_ROLE,
        _FALLBACK_TASK,
        _resolve_prompt_components,
    )

    role, task, instructions = _resolve_prompt_components("nonexistent_doc_type")
    assert role == _FALLBACK_ROLE
    assert task == _FALLBACK_TASK
    assert "1. Be completely honest" in instructions


def test_tasks_preserves_section_dividers_in_instructions():
    """Instructions that start with '===' should be kept as visual section
    headers in the rendered output, not numbered like regular steps."""
    from app.tasks import _resolve_prompt_components

    _, _, instructions = _resolve_prompt_components("company_intelligence_briefing")

    # Dividers should be present and NOT prefixed with numbers
    assert "=== EPISTEMIC HONESTY" in instructions or "=== SECTION 1" in instructions
    # The first real instruction should still be numbered "1."
    assert "1. " in instructions


def test_sample_values_cover_tasks_py_placeholders():
    """Ensures every placeholder that app/tasks.py resolves at runtime has a
    corresponding entry in PREVIEW_SAMPLE_VALUES, so the admin preview stays
    in sync with the real generation pipeline.
    """
    runtime_placeholders = {
        "{job_description}",
        "{cv_text}",
        "{cv_summary}",
        "{language}",
        "{company_profile_language}",
        "{role}",
        "{task}",
        "{instructions}",
        "{documentation_language}",
        "{reference_letters}",
        "{doc_type}",
        "{doc_type_display}",
    }
    missing = runtime_placeholders - set(PREVIEW_SAMPLE_VALUES.keys())
    assert not missing, (
        f"PREVIEW_SAMPLE_VALUES is missing {missing}. "
        "Every placeholder resolved in app/tasks.py must have a preview sample."
    )
