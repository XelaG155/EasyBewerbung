"""Tests for credits-refund and partial-failure settlement.

Exercises ``app.tasks.settle_generation_task`` directly with an in-memory
SQLite database. The full Celery task is not invoked — settlement is the
risk surface (status derivation + refund math + idempotency) and is now
factored out so it can be unit-tested without mocking the LLM stack.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.models import Base, GenerationTask, User
from app.tasks import settle_generation_task


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


def _seed(db, *, credits=0, total=5, completed=0, failed=0, held=5, refunded=0):
    user = User(
        email="u@example.com",
        hashed_password="x",
        credits=credits,
        preferred_language="de",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    task = GenerationTask(
        application_id=1,
        user_id=user.id,
        status="processing",
        total_docs=total,
        completed_docs=completed,
        failed_docs=failed,
        credits_held=held,
        credits_refunded=refunded,
        progress=50,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return user, task


class TestStatusDerivation:
    """Status must reflect what really happened, not the loop's exit point."""

    def test_all_succeeded_marks_completed(self, db):
        user, task = _seed(db, credits=10, total=3, completed=3, failed=0, held=3)
        settle_generation_task(task, db, user.id)
        assert task.status == "completed"
        assert task.progress == 100

    def test_all_failed_marks_failed(self, db):
        user, task = _seed(db, credits=10, total=3, completed=0, failed=3, held=3)
        settle_generation_task(task, db, user.id)
        assert task.status == "failed"

    def test_some_failed_marks_partial_failure(self, db):
        user, task = _seed(db, credits=10, total=5, completed=3, failed=2, held=5)
        settle_generation_task(task, db, user.id)
        assert task.status == "partial_failure"


class TestProportionalRefund:
    """Failed docs must be refunded proportionally."""

    def test_full_failure_refunds_all_credits(self, db):
        user, task = _seed(db, credits=0, total=3, completed=0, failed=3, held=3)
        settle_generation_task(task, db, user.id)
        db.refresh(user)
        assert user.credits == 3
        assert task.credits_refunded == 3

    def test_partial_failure_refunds_proportional(self, db):
        # 5 docs, 5 credits held, 2 failed → refund 2 credits.
        user, task = _seed(db, credits=10, total=5, completed=3, failed=2, held=5)
        settle_generation_task(task, db, user.id)
        db.refresh(user)
        assert user.credits == 12
        assert task.credits_refunded == 2

    def test_full_success_refunds_nothing(self, db):
        user, task = _seed(db, credits=10, total=3, completed=3, failed=0, held=3)
        settle_generation_task(task, db, user.id)
        db.refresh(user)
        assert user.credits == 10
        assert task.credits_refunded == 0

    def test_uneven_refund_floors_conservatively(self, db):
        # 7 docs, 10 credits held (uneven cost), 3 failed.
        # owed = 10 * 3 // 7 = 4 (not 4.28).
        user, task = _seed(db, credits=0, total=7, completed=4, failed=3, held=10)
        settle_generation_task(task, db, user.id)
        db.refresh(user)
        assert user.credits == 4
        assert task.credits_refunded == 4

    def test_zero_credits_held_refunds_nothing(self, db):
        # Edge case: legacy task with credits_held=0 (pre-migration row).
        user, task = _seed(db, credits=10, total=3, completed=0, failed=3, held=0)
        settle_generation_task(task, db, user.id)
        db.refresh(user)
        assert user.credits == 10
        assert task.credits_refunded == 0


class TestIdempotency:
    """Settling twice must not double-refund. Critical for Celery retries."""

    def test_settle_twice_does_not_double_refund(self, db):
        user, task = _seed(db, credits=0, total=5, completed=3, failed=2, held=5)
        settle_generation_task(task, db, user.id)
        db.refresh(user)
        first_credits = user.credits
        first_refund = task.credits_refunded

        # Run again — same counters, same task → no further effect.
        settle_generation_task(task, db, user.id)
        db.refresh(user)
        assert user.credits == first_credits
        assert task.credits_refunded == first_refund

    def test_settle_after_more_failures_refunds_only_delta(self, db):
        # First settle: 1 failed, refunds 1.
        user, task = _seed(db, credits=0, total=5, completed=4, failed=1, held=5)
        settle_generation_task(task, db, user.id)
        db.refresh(user)
        assert user.credits == 1
        assert task.credits_refunded == 1

        # Worker discovers more failures after a retry — total now 3 failed,
        # 5 credits held, owed = 3. Already refunded 1, so refund delta of 2.
        task.completed_docs = 2
        task.failed_docs = 3
        db.commit()
        settle_generation_task(task, db, user.id)
        db.refresh(user)
        assert user.credits == 3  # 1 + 2 delta
        assert task.credits_refunded == 3
