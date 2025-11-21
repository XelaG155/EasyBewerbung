import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr, Field, validator, field_validator
from sqlalchemy.orm import Session
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
from app.models import User
from app.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
)
from app.limiter import limiter

logger = logging.getLogger(__name__)

router = APIRouter()


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
        return v
    full_name: Optional[str] = None
    preferred_language: str = DEFAULT_LANGUAGE
    mother_tongue: str = DEFAULT_LANGUAGE
    documentation_language: str = DEFAULT_LANGUAGE

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
    credits: int
    created_at: str

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
        credits=user.credits,
        created_at=user.created_at.isoformat(),
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

    @field_validator("preferred_language", "mother_tongue", "documentation_language", mode="before")
    @classmethod
    def validate_language(cls, value: Optional[str], info):
        return normalize_language(value, field_name=info.field_name)


@router.post("/google", response_model=TokenResponse)
async def google_login(request: GoogleLoginRequest, db: Session = Depends(get_db)):
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
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # Create access token
        access_token = create_access_token(data={"sub": str(user.id)})

        return TokenResponse(access_token=access_token, token_type="bearer", user=serialize_user(user))

    except ValueError as e:
        # Invalid token
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {str(e)}",
        )
    except HTTPException:
        raise
    except Exception as e:
        # In a real app, log this error
        print(f"Google auth error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google authentication failed",
        )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """Register a new user."""
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
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
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Create access token
    access_token = create_access_token(data={"sub": str(new_user.id)})

    return TokenResponse(access_token=access_token, token_type="bearer", user=serialize_user(new_user))


@router.post("/login", response_model=TokenResponse)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """Login an existing user."""
    # Find user by email
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # Check if user registered with OAuth (no password)
    if user.oauth_provider == "google" and not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account uses Google Sign-In. Please login with Google.",
        )

    # Verify password
    if not user.hashed_password or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

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

    @field_validator("preferred_language", "mother_tongue", "documentation_language", mode="before")
    @classmethod
    def validate_language(cls, value: Optional[str], info):
        return normalize_language(value, field_name=info.field_name) if value else value


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

    db.commit()
    db.refresh(current_user)

    return serialize_user(current_user)


@router.get("/languages", response_model=List[LanguageOptionResponse])
async def list_supported_languages():
    """Expose the platform language list for UI and generation toggles."""
    return LANGUAGE_OPTIONS_RESPONSE


@router.post("/admin/credits", response_model=UserResponse)
@limiter.limit("5/minute")
async def grant_credits(
    payload: AdminCreditUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Admin-only endpoint to add credits. Protects with a static token header.
    """
    admin_token_header = request.headers.get("X-Admin-Token")
    admin_token_env = os.getenv("ADMIN_TOKEN")
    client_ip = request.client.host if request.client else "unknown"
    timestamp = datetime.now(timezone.utc).isoformat()
    if not admin_token_env or admin_token_header != admin_token_env:
        logger.warning(
            "Admin credit grant denied", extra={"ip": client_ip, "timestamp": timestamp, "user_id": payload.user_id}
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin token invalid")

    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.credits += payload.credits_to_add
    db.commit()
    db.refresh(user)

    logger.info(
        "Admin credit grant succeeded",
        extra={
            "ip": client_ip,
            "timestamp": timestamp,
            "user_id": payload.user_id,
            "credits_added": payload.credits_to_add,
        },
    )

    return serialize_user(user)
