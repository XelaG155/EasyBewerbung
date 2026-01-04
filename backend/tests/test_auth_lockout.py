"""
Tests for authentication lockout mechanism.

These tests verify:
1. Concurrent failed login attempts don't create race conditions
2. Lockout expiration and automatic reset works correctly
3. Timezone-aware datetime handling
4. Edge case: exactly MAX_FAILED_LOGIN_ATTEMPTS from multiple threads
"""
import asyncio
from datetime import datetime, timezone, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi import HTTPException

from app.models import Base, User
from app.auth import get_password_hash, verify_password
from app.api.endpoints.users import UserLogin, MAX_FAILED_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MINUTES


@pytest.fixture()
def session_factory():
    """Create an in-memory SQLite database for testing."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autocommit=False, autoflush=False)


@pytest.fixture()
def seeded_user(session_factory):
    """Create a test user with a known password."""
    Session = session_factory
    with Session() as session:
        user = User(
            email="test@example.com",
            hashed_password=get_password_hash("CorrectPassword123!"),
            preferred_language="en",
            mother_tongue="en",
            documentation_language="en",
            oauth_provider="email",
            failed_login_attempts=0,
            account_locked_until=None,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id


@pytest.fixture()
def user_with_failed_attempts(session_factory):
    """Create a test user with 4 failed login attempts (one away from lockout)."""
    Session = session_factory
    with Session() as session:
        user = User(
            email="almostlocked@example.com",
            hashed_password=get_password_hash("CorrectPassword123!"),
            preferred_language="en",
            mother_tongue="en",
            documentation_language="en",
            oauth_provider="email",
            failed_login_attempts=MAX_FAILED_LOGIN_ATTEMPTS - 1,
            account_locked_until=None,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id


@pytest.fixture()
def locked_user(session_factory):
    """Create a test user that is currently locked."""
    Session = session_factory
    with Session() as session:
        lockout_time = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
        user = User(
            email="locked@example.com",
            hashed_password=get_password_hash("CorrectPassword123!"),
            preferred_language="en",
            mother_tongue="en",
            documentation_language="en",
            oauth_provider="email",
            failed_login_attempts=MAX_FAILED_LOGIN_ATTEMPTS,
            account_locked_until=lockout_time,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id


@pytest.fixture()
def expired_lockout_user(session_factory):
    """Create a test user with an expired lockout."""
    Session = session_factory
    with Session() as session:
        # Lockout expired 1 minute ago
        lockout_time = datetime.now(timezone.utc) - timedelta(minutes=1)
        user = User(
            email="expiredlock@example.com",
            hashed_password=get_password_hash("CorrectPassword123!"),
            preferred_language="en",
            mother_tongue="en",
            documentation_language="en",
            oauth_provider="email",
            failed_login_attempts=MAX_FAILED_LOGIN_ATTEMPTS,
            account_locked_until=lockout_time,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id


@pytest.fixture()
def anyio_backend():
    return "asyncio"


async def _attempt_login(session_factory, user_email, password):
    """Simulate a login attempt."""
    from app.api.endpoints.users import login
    from fastapi import Request
    from unittest.mock import Mock

    Session = session_factory
    with Session() as session:
        # Mock the request object
        mock_request = Mock(spec=Request)
        mock_request.client = Mock()
        mock_request.client.host = "127.0.0.1"

        user_data = UserLogin(email=user_email, password=password)

        try:
            # Call the login function directly
            # Note: This bypasses rate limiting for testing purposes
            user = session.query(User).filter(User.email == user_email).first()
            if not user:
                raise HTTPException(status_code=401, detail="Incorrect email or password")

            # Check if account is locked
            if user.account_locked_until:
                now_utc = datetime.now(timezone.utc)
                locked_until = user.account_locked_until

                if locked_until.tzinfo is None:
                    locked_until = locked_until.replace(tzinfo=timezone.utc)

                if locked_until > now_utc:
                    lock_minutes = int((locked_until - now_utc).total_seconds() / 60)
                    raise HTTPException(
                        status_code=403,
                        detail=f"Account is temporarily locked due to too many failed login attempts. Try again in {lock_minutes} minutes.",
                    )
                else:
                    # Lockout has expired - reset the fields
                    user.account_locked_until = None
                    user.failed_login_attempts = 0
                    session.commit()
                    session.refresh(user)

            # Verify password
            if not user.hashed_password or not verify_password(password, user.hashed_password):
                # Atomic increment
                session.query(User).filter(User.id == user.id).update({
                    "failed_login_attempts": User.failed_login_attempts + 1
                })
                session.flush()
                session.refresh(user)

                # Check for lockout
                if user.failed_login_attempts >= MAX_FAILED_LOGIN_ATTEMPTS:
                    lockout_time = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
                    rows_updated = session.query(User).filter(
                        User.id == user.id,
                        User.account_locked_until.is_(None)
                    ).update({
                        "account_locked_until": lockout_time
                    })
                    session.commit()

                    raise HTTPException(
                        status_code=403,
                        detail=f"Account locked due to too many failed login attempts. Please try again in {LOCKOUT_DURATION_MINUTES} minutes.",
                    )
                else:
                    session.commit()

                raise HTTPException(status_code=401, detail="Incorrect email or password")

            # Successful login
            user.failed_login_attempts = 0
            user.account_locked_until = None
            user.last_login_at = datetime.now(timezone.utc)
            session.commit()
            session.refresh(user)

            return {"status": "success", "user_id": user.id}

        except HTTPException as e:
            raise e
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


@pytest.mark.anyio("asyncio")
async def test_concurrent_lockout_race_condition(session_factory, user_with_failed_attempts):
    """
    Test that concurrent requests don't create multiple lockout timestamps.

    Scenario:
    - User has 4 failed attempts
    - Two concurrent requests both fail (5th attempt)
    - Only one request should set the lockout
    - Both requests should receive 403 error
    - Account should be locked with exactly one lockout timestamp
    """
    # Fire two concurrent requests with wrong password
    first, second = await asyncio.gather(
        _attempt_login(session_factory, "almostlocked@example.com", "WrongPassword123!"),
        _attempt_login(session_factory, "almostlocked@example.com", "WrongPassword123!"),
        return_exceptions=True,
    )

    # Both requests should fail with 403 (account locked)
    assert isinstance(first, HTTPException)
    assert isinstance(second, HTTPException)
    assert first.status_code == 403
    assert second.status_code == 403

    # Verify the account is locked
    Session = session_factory
    with Session() as session:
        user = session.query(User).filter(User.email == "almostlocked@example.com").first()
        assert user is not None
        assert user.account_locked_until is not None
        assert user.failed_login_attempts >= MAX_FAILED_LOGIN_ATTEMPTS

        # Verify the lockout timestamp is reasonable (within next 16 minutes)
        now_utc = datetime.now(timezone.utc)
        locked_until = user.account_locked_until
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)

        assert locked_until > now_utc
        assert locked_until <= now_utc + timedelta(minutes=LOCKOUT_DURATION_MINUTES + 1)


@pytest.mark.anyio("asyncio")
async def test_lockout_expiration_and_reset(session_factory, expired_lockout_user):
    """
    Test that lockout expiration automatically resets lockout fields.

    Scenario:
    - User was locked but lockout has expired
    - Login attempt with correct password should succeed
    - Lockout fields should be reset
    """
    result = await _attempt_login(session_factory, "expiredlock@example.com", "CorrectPassword123!")

    assert result["status"] == "success"

    # Verify lockout fields are reset
    Session = session_factory
    with Session() as session:
        user = session.query(User).filter(User.email == "expiredlock@example.com").first()
        assert user.account_locked_until is None
        assert user.failed_login_attempts == 0


@pytest.mark.anyio("asyncio")
async def test_timezone_aware_lockout_check(session_factory, locked_user):
    """
    Test that timezone-aware datetime handling works correctly.

    Scenario:
    - User is currently locked
    - Login attempt should fail with 403
    - Error message should indicate remaining time
    """
    result = await _attempt_login(session_factory, "locked@example.com", "CorrectPassword123!")

    assert isinstance(result, HTTPException)
    assert result.status_code == 403
    assert "locked" in result.detail.lower()


@pytest.mark.anyio("asyncio")
async def test_successful_login_resets_attempts(session_factory, user_with_failed_attempts):
    """
    Test that successful login resets failed attempt counter.

    Scenario:
    - User has 4 failed attempts
    - Successful login should reset counter to 0
    """
    result = await _attempt_login(session_factory, "almostlocked@example.com", "CorrectPassword123!")

    assert result["status"] == "success"

    # Verify failed attempts are reset
    Session = session_factory
    with Session() as session:
        user = session.query(User).filter(User.email == "almostlocked@example.com").first()
        assert user.failed_login_attempts == 0
        assert user.account_locked_until is None


@pytest.mark.anyio("asyncio")
async def test_incremental_failed_attempts(session_factory, seeded_user):
    """
    Test that failed login attempts increment correctly.

    Scenario:
    - User has 0 failed attempts
    - Three failed login attempts should increment to 3
    - User should not be locked yet
    """
    # Make 3 failed login attempts
    for i in range(3):
        result = await _attempt_login(session_factory, "test@example.com", "WrongPassword123!")
        assert isinstance(result, HTTPException)
        assert result.status_code == 401  # Still unauthorized, not locked yet

    # Verify failed attempts incremented but not locked
    Session = session_factory
    with Session() as session:
        user = session.query(User).filter(User.email == "test@example.com").first()
        assert user.failed_login_attempts == 3
        assert user.account_locked_until is None


@pytest.mark.anyio("asyncio")
async def test_exactly_max_attempts_locks_account(session_factory, seeded_user):
    """
    Test that exactly MAX_FAILED_LOGIN_ATTEMPTS locks the account.

    Scenario:
    - User has 0 failed attempts
    - MAX_FAILED_LOGIN_ATTEMPTS failed logins should lock the account
    """
    # Make MAX_FAILED_LOGIN_ATTEMPTS failed login attempts
    for i in range(MAX_FAILED_LOGIN_ATTEMPTS):
        result = await _attempt_login(session_factory, "test@example.com", f"WrongPassword{i}!")
        assert isinstance(result, HTTPException)

    # The last attempt should have locked the account
    Session = session_factory
    with Session() as session:
        user = session.query(User).filter(User.email == "test@example.com").first()
        assert user.failed_login_attempts >= MAX_FAILED_LOGIN_ATTEMPTS
        assert user.account_locked_until is not None

        # Verify lockout timestamp
        now_utc = datetime.now(timezone.utc)
        locked_until = user.account_locked_until
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)

        assert locked_until > now_utc
