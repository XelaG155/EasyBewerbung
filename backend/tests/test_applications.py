import asyncio

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.endpoints.applications import ApplicationCreate, create_application
from app.models import Base, User


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
def seeded_user(session_factory):
    Session = session_factory
    with Session() as session:
        user = User(
            email="worker@example.com",
            hashed_password="hashed",
            credits=1,
            preferred_language="English",
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id


@pytest.fixture()
def anyio_backend():
    return "asyncio"


def _fake_request():
    """Build a minimal starlette Request that satisfies slowapi's type check.

    The real admin endpoint requires an actual ``starlette.requests.Request``
    as its first parameter (for rate limiting); the old test called
    ``create_application`` without it and started failing once slowapi
    tightened its type guard. This helper produces an object the decorator
    accepts without needing an HTTP round-trip.
    """
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
        "app": type(
            "AppStub",
            (),
            {
                "state": type(
                    "StateStub",
                    (),
                    {
                        "limiter": None,
                        "view_rate_limit": None,
                        "_rate_limit_exceeded": None,
                    },
                )()
            },
        )(),
    }
    return Request(scope)


async def _attempt_application(session_factory, user_id):
    Session = session_factory
    with Session() as session:
        user = session.get(User, user_id)
        payload = ApplicationCreate(job_title="Engineer", company="ACME", applied=False)
        return await create_application(
            request=_fake_request(),
            payload=payload,
            current_user=user,
            db=session,
        )


@pytest.mark.anyio("asyncio")
async def test_credit_deduction_prevents_overuse(session_factory, seeded_user):
    # Two concurrent calls from a user with exactly 1 credit: exactly one
    # must succeed, the other must fail with 402. asyncio.gather returns
    # results in submission order, not completion order — so we inspect
    # both and don't assume which one won.
    results = await asyncio.gather(
        _attempt_application(session_factory, seeded_user),
        _attempt_application(session_factory, seeded_user),
        return_exceptions=True,
    )

    successes = [r for r in results if not isinstance(r, Exception)]
    failures = [r for r in results if isinstance(r, Exception)]

    assert len(successes) == 1, (
        f"expected exactly one successful application, got {len(successes)}: {results}"
    )
    assert len(failures) == 1, (
        f"expected exactly one failed application, got {len(failures)}: {results}"
    )
    assert successes[0]["job_title"] == "Engineer"
    assert getattr(failures[0], "status_code", None) == 402

    Session = session_factory
    with Session() as session:
        user = session.get(User, seeded_user)
        assert user.credits == 0
        assert session.query(User).count() == 1
        assert session.query(User).first().applications[0].job_title == "Engineer"
