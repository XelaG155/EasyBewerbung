import logging
import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr, Field, validator, field_validator
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
import os

from app.language_catalog import (
    DEFAULT_LANGUAGE,
    normalize_language,
    get_language_options,
)
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.database import get_db
from app.models import User, UserActivityLog
from app.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
    get_current_admin_user,
)
from app.limiter import limiter
from app.privacy_policy import PRIVACY_POLICY_TEXT

logger = logging.getLogger(__name__)

router = APIRouter()

# Security constants for authentication
MAX_FAILED_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15


def record_activity(db: Session, user: User, action: str, request: Optional[Request] = None, metadata: Optional[str] = None):
    ip_address = request.client.host if request and request.client else None
    log_entry = UserActivityLog(
        user_id=user.id,
        action=action,
        ip_address=ip_address,
        metadata_=metadata,
    )
    db.add(log_entry)
    db.commit()


def _safe_language(value: Optional[str], field_name: str) -> str:
    try:
        return normalize_language(value or DEFAULT_LANGUAGE, field_name=field_name) or DEFAULT_LANGUAGE
    except ValueError:
        logger.warning(
            "Invalid language value replaced with default",
            extra={"field": field_name, "provided": value, "fallback": DEFAULT_LANGUAGE},
        )
        return DEFAULT_LANGUAGE


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)

    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')

        # Password complexity requirements
        has_upper = any(c.isupper() for c in v)
        has_lower = any(c.islower() for c in v)
        has_digit = any(c.isdigit() for c in v)
        has_special = any(c in '!@#$%^&*(),.?":{}|<>_-+=[]\\;\'/' for c in v)

        if not has_upper:
            raise ValueError('Password must contain at least one uppercase letter')
        if not has_lower:
            raise ValueError('Password must contain at least one lowercase letter')
        if not has_digit:
            raise ValueError('Password must contain at least one number')
        if not has_special:
            raise ValueError('Password must contain at least one special character (!@#$%^&*(),.?":{}|<>_-+=[]\\;\'/)')

        return v
    full_name: Optional[str] = None
    preferred_language: str = DEFAULT_LANGUAGE
    mother_tongue: str = DEFAULT_LANGUAGE
    documentation_language: str = DEFAULT_LANGUAGE
    privacy_policy_accepted: bool = False

    @field_validator("preferred_language", "mother_tongue", "documentation_language", mode="before")
    @classmethod
    def validate_language(cls, value: Optional[str], info):
        return normalize_language(value, field_name=info.field_name)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str]
    preferred_language: str
    mother_tongue: str
    documentation_language: str
    # Extended profile fields
    employment_status: Optional[str]
    education_type: Optional[str]
    additional_profile_context: Optional[str]
    # Display preferences
    date_format: str
    credits: int
    created_at: str
    is_admin: bool
    is_active: bool
    last_login_at: Optional[str]
    password_changed_at: Optional[str]

    class Config:
        from_attributes = True


def serialize_user(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        preferred_language=_safe_language(user.preferred_language, "preferred_language"),
        mother_tongue=_safe_language(user.mother_tongue, "mother_tongue"),
        documentation_language=_safe_language(user.documentation_language, "documentation_language"),
        employment_status=getattr(user, "employment_status", None),
        education_type=getattr(user, "education_type", None),
        additional_profile_context=getattr(user, "additional_profile_context", None),
        date_format=getattr(user, "date_format", "DD/MM/YYYY"),
        credits=user.credits,
        created_at=user.created_at.isoformat(),
        is_admin=bool(getattr(user, "is_admin", False)),
        is_active=bool(getattr(user, "is_active", True)),
        last_login_at=user.last_login_at.isoformat() if getattr(user, "last_login_at", None) else None,
        password_changed_at=user.password_changed_at.isoformat()
        if getattr(user, "password_changed_at", None)
        else None,
    )


class LanguageOptionResponse(BaseModel):
    code: str
    label: str
    direction: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


LANGUAGE_OPTIONS_RESPONSE: List[LanguageOptionResponse] = [
    LanguageOptionResponse(**option.__dict__) for option in get_language_options()
]


class GoogleLoginRequest(BaseModel):
    credential: str  # Google ID token
    preferred_language: str = DEFAULT_LANGUAGE
    mother_tongue: str = DEFAULT_LANGUAGE
    documentation_language: str = DEFAULT_LANGUAGE
    privacy_policy_accepted: bool = False

    @field_validator("preferred_language", "mother_tongue", "documentation_language", mode="before")
    @classmethod
    def validate_language(cls, value: Optional[str], info):
        return normalize_language(value, field_name=info.field_name)


@router.post("/google", response_model=TokenResponse)
@limiter.limit("10/minute")
async def google_login(http_request: Request, request: GoogleLoginRequest, db: Session = Depends(get_db)):
    """Login or register with Google OAuth."""
    try:
        # Get Google Client ID from environment
        google_client_id = os.getenv("GOOGLE_CLIENT_ID")
        if not google_client_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Google OAuth not configured",
            )

        # Verify the Google ID token
        idinfo = id_token.verify_oauth2_token(
            request.credential,
            google_requests.Request(),
            google_client_id
        )

        # Extract user information from token
        google_user_id = idinfo.get("sub")
        email = idinfo.get("email")
        full_name = idinfo.get("name")
        profile_picture = idinfo.get("picture")

        if not email or not google_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Google token",
            )

        # Check if user exists by Google ID
        user = db.query(User).filter(User.google_id == google_user_id).first()

        # If not found by Google ID, check by email
        if not user:
            user = db.query(User).filter(User.email == email).first()
            if user and user.oauth_provider != "google":
                # User exists with email/password, update to link Google account
                user.google_id = google_user_id
                user.oauth_provider = "google"
                if not user.full_name and full_name:
                    user.full_name = full_name
                if profile_picture:
                    user.profile_picture = profile_picture
                db.commit()
                db.refresh(user)

        # If still no user, create new one
        if not user:
            if not request.privacy_policy_accepted:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You must accept the privacy policy to register",
                )
            user = User(
                email=email,
                google_id=google_user_id,
                full_name=full_name,
                profile_picture=profile_picture,
                oauth_provider="google",
                preferred_language=request.preferred_language,
                mother_tongue=request.mother_tongue,
                documentation_language=request.documentation_language,
                hashed_password=None,  # OAuth users don't have passwords
                privacy_policy_accepted_at=datetime.now(timezone.utc) if request.privacy_policy_accepted else None,
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        user.last_login_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)

        record_activity(db, user, "login", metadata="google")

        # Create access token
        access_token = create_access_token(data={"sub": str(user.id)})

        return TokenResponse(access_token=access_token, token_type="bearer", user=serialize_user(user))

    except ValueError:
        # Invalid token
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google auth error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google authentication failed",
        )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(request: Request, user_data: UserRegister, db: Session = Depends(get_db)):
    """Register a new user."""
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    if not user_data.privacy_policy_accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must accept the privacy policy to register",
        )

    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        preferred_language=user_data.preferred_language,
        mother_tongue=user_data.mother_tongue,
        documentation_language=user_data.documentation_language,
        oauth_provider="email",  # Mark as email/password user
        password_changed_at=datetime.now(timezone.utc),
        privacy_policy_accepted_at=datetime.now(timezone.utc) if user_data.privacy_policy_accepted else None,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Create access token
    access_token = create_access_token(data={"sub": str(new_user.id)})

    return TokenResponse(access_token=access_token, token_type="bearer", user=serialize_user(new_user))


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, user_data: UserLogin, db: Session = Depends(get_db)):
    """Login an existing user."""
    # Find user by email
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # Check if account is locked
    if getattr(user, "account_locked_until", None):
        # Convert to timezone-aware datetime for comparison
        now_utc = datetime.now(timezone.utc)
        locked_until = user.account_locked_until

        # Handle both naive and aware datetimes
        if locked_until.tzinfo is None:
            # If stored as naive, assume it's UTC and make it aware
            locked_until = locked_until.replace(tzinfo=timezone.utc)

        if locked_until > now_utc:
            lock_minutes = int((locked_until - now_utc).total_seconds() / 60)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Account is temporarily locked due to too many failed login attempts. Try again in {lock_minutes} minutes.",
            )
        else:
            # Lockout has expired - reset the fields to clean up database
            user.account_locked_until = None
            user.failed_login_attempts = 0
            db.commit()
            db.refresh(user)

    # Check if user registered with OAuth (no password)
    if user.oauth_provider == "google" and not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account uses Google Sign-In. Please login with Google.",
        )

    # Verify password
    if not user.hashed_password or not verify_password(user_data.password, user.hashed_password):
        # Use atomic increment to prevent race conditions
        db.query(User).filter(User.id == user.id).update({
            "failed_login_attempts": User.failed_login_attempts + 1
        })
        db.flush()
        db.refresh(user)

        # Lock account after MAX_FAILED_LOGIN_ATTEMPTS failed attempts for LOCKOUT_DURATION_MINUTES minutes
        # The WHERE clause (account_locked_until.is_(None)) prevents race condition
        # where multiple concurrent requests could each try to set the lockout timestamp
        if user.failed_login_attempts >= MAX_FAILED_LOGIN_ATTEMPTS:
            lockout_time = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
            # Only set lockout if not already locked (WHERE clause prevents race condition)
            rows_updated = db.query(User).filter(
                User.id == user.id,
                User.account_locked_until.is_(None)
            ).update({
                "account_locked_until": lockout_time
            })
            db.commit()

            if rows_updated > 0:
                logger.warning(
                    f"Account locked for user {user.email} after {user.failed_login_attempts} failed attempts"
                )

            # Always raise the exception - account is locked whether we set it or another request did
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Account locked due to too many failed login attempts. Please try again in {LOCKOUT_DURATION_MINUTES} minutes.",
            )
        else:
            # Commit the incremented attempts for non-lockout case
            db.commit()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if getattr(user, "is_active", True) is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is locked",
        )

    # Successful login - reset failed attempts and clear lockout
    user.failed_login_attempts = 0
    user.account_locked_until = None
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    record_activity(db, user, "login")

    # Create access token
    access_token = create_access_token(data={"sub": str(user.id)})

    return TokenResponse(access_token=access_token, token_type="bearer", user=serialize_user(user))


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information."""
    return serialize_user(current_user)


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    preferred_language: Optional[str] = None
    mother_tongue: Optional[str] = None
    documentation_language: Optional[str] = None
    # Extended profile fields
    employment_status: Optional[str] = None  # "employed", "unemployed", "student", "transitioning"
    education_type: Optional[str] = None  # "wms", "bms", "university", "apprenticeship", "other"
    additional_profile_context: Optional[str] = None  # Free text for additional info
    # Display preferences
    date_format: Optional[str] = None  # "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", etc.

    @field_validator("preferred_language", "mother_tongue", "documentation_language", mode="before")
    @classmethod
    def validate_language(cls, value: Optional[str], info):
        return normalize_language(value, field_name=info.field_name) if value else value

    @field_validator("employment_status", mode="before")
    @classmethod
    def validate_employment_status(cls, value: Optional[str]):
        if value is None:
            return value
        valid_statuses = ["employed", "unemployed", "student", "transitioning"]
        if value not in valid_statuses:
            raise ValueError(f"employment_status must be one of: {', '.join(valid_statuses)}")
        return value

    @field_validator("education_type", mode="before")
    @classmethod
    def validate_education_type(cls, value: Optional[str]):
        if value is None:
            return value
        valid_types = ["wms", "bms", "university", "apprenticeship", "other"]
        if value not in valid_types:
            raise ValueError(f"education_type must be one of: {', '.join(valid_types)}")
        return value

    @field_validator("date_format", mode="before")
    @classmethod
    def validate_date_format(cls, value: Optional[str]):
        if value is None:
            return value
        valid_formats = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD.MM.YYYY", "DD-MM-YYYY"]
        if value not in valid_formats:
            raise ValueError(f"date_format must be one of: {', '.join(valid_formats)}")
        return value


class AdminCreditUpdate(BaseModel):
    user_id: int
    credits_to_add: int = Field(..., gt=0, description="Number of credits to add for the user")


@router.patch("/me", response_model=UserResponse)
async def update_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update current user information."""
    if user_update.full_name is not None:
        current_user.full_name = user_update.full_name
    if user_update.preferred_language is not None:
        current_user.preferred_language = user_update.preferred_language
    if user_update.mother_tongue is not None:
        current_user.mother_tongue = user_update.mother_tongue
    if user_update.documentation_language is not None:
        current_user.documentation_language = user_update.documentation_language
    # Extended profile fields
    if user_update.employment_status is not None:
        current_user.employment_status = user_update.employment_status
    if user_update.education_type is not None:
        current_user.education_type = user_update.education_type
    if user_update.additional_profile_context is not None:
        current_user.additional_profile_context = user_update.additional_profile_context
    # Display preferences
    if user_update.date_format is not None:
        current_user.date_format = user_update.date_format

    db.commit()
    db.refresh(current_user)

    return serialize_user(current_user)


@router.get("/languages", response_model=List[LanguageOptionResponse])
async def list_supported_languages(db: Session = Depends(get_db)):
    """Expose only active languages configured by admin."""
    from app.models import LanguageSetting

    # Query only active languages from database
    active_languages = db.query(LanguageSetting).filter(
        LanguageSetting.is_active == True
    ).order_by(LanguageSetting.sort_order).all()

    # Convert to response format
    return [
        LanguageOptionResponse(
            code=lang.code,
            label=lang.label,
            direction=lang.direction
        )
        for lang in active_languages
    ]


@router.get("/privacy-policy")
async def get_privacy_policy():
    """Return the privacy policy text."""
    return {"policy": PRIVACY_POLICY_TEXT}


@router.post("/admin/credits", response_model=UserResponse)
@limiter.limit("5/minute")
async def grant_credits(
    payload: AdminCreditUpdate,
    request: Request,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Admin-only endpoint to add credits. Requires JWT authentication with admin privileges.
    """
    client_ip = request.client.host if request.client else "unknown"
    timestamp = datetime.now(timezone.utc).isoformat()

    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.credits += payload.credits_to_add
    db.commit()
    db.refresh(user)

    logger.info(
        "Admin credit grant succeeded",
        extra={
            "admin_id": current_admin.id,
            "admin_email": current_admin.email,
            "ip": client_ip,
            "timestamp": timestamp,
            "user_id": payload.user_id,
            "credits_added": payload.credits_to_add,
        },
    )

    return serialize_user(user)
