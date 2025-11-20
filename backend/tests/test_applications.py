import asyncio

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.endpoints.applications import ApplicationCreate, create_application
from app.models import Base, User


@pytest.fixture()
def session_factory():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
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


async def _attempt_application(session_factory, user_id):
    Session = session_factory
    with Session() as session:
        user = session.get(User, user_id)
        payload = ApplicationCreate(job_title="Engineer", company="ACME", applied=False)
        return await create_application(payload, current_user=user, db=session)


@pytest.mark.asyncio
async def test_credit_deduction_prevents_overuse(session_factory, seeded_user):
    first, second = await asyncio.gather(
        _attempt_application(session_factory, seeded_user),
        _attempt_application(session_factory, seeded_user),
        return_exceptions=True,
    )

    assert first["job_title"] == "Engineer"

    assert isinstance(second, Exception)
    assert getattr(second, "status_code", None) == 402

    Session = session_factory
    with Session() as session:
        user = session.get(User, seeded_user)
        assert user.credits == 0
        assert session.query(User).count() == 1
        assert session.query(User).first().applications[0].job_title == "Engineer"
