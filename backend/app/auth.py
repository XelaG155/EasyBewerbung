from datetime import datetime, timedelta, timezone
from typing import Optional
import os
import secrets
import logging
from dotenv import load_dotenv
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Security configuration
#
# SECRET_KEY MUST be set explicitly outside development. The previous
# behaviour ("generate a random key when ENVIRONMENT != production")
# silently invalidated every user session on every container restart
# because the bigvmcontrol auto-deploy pipeline did not set ENVIRONMENT
# at all. We now fail fast unless ENVIRONMENT is one of the dev/test
# whitelist.
_DEV_ENVIRONMENTS = {"dev", "development", "test", "testing", "ci", "local"}
_default_secret = "your-secret-key-change-this-in-production"

_environment = (os.getenv("ENVIRONMENT") or "").strip().lower()
SECRET_KEY = os.getenv("SECRET_KEY", _default_secret)

if SECRET_KEY == _default_secret or not SECRET_KEY:
    if _environment in _DEV_ENVIRONMENTS:
        SECRET_KEY = secrets.token_hex(32)
        logger.warning(
            "SECRET_KEY not configured (ENVIRONMENT=%s) — generated ephemeral key. "
            "Sessions will not persist across restarts. Set SECRET_KEY in .env file.",
            _environment or "<unset>",
        )
    else:
        raise RuntimeError(
            "SECRET_KEY must be set explicitly when ENVIRONMENT is not one of "
            f"{sorted(_DEV_ENVIRONMENTS)}. Current ENVIRONMENT={_environment or '<unset>'!r}. "
            "Generate one with: openssl rand -hex 32, then add SECRET_KEY=... to .env."
        )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

security = HTTPBearer(auto_error=False)  # Don't auto-raise errors for optional auth


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash using bcrypt directly."""
    try:
        # bcrypt handles encoding internally
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception as e:
        print(f"Password verification error: {e}")
        return False


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt directly."""
    # bcrypt.hashpw automatically handles the 72 byte limit
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> dict:
    """Decode and verify a JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Get the current authenticated user from the JWT token."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = decode_token(token)

    user_id_str: str = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in token",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Get the current user if authenticated, otherwise None."""
    if credentials is None:
        return None
    try:
        return get_current_user(credentials, db)
    except HTTPException:
        return None


def get_current_admin_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get the current user and verify they have admin privileges."""
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user
