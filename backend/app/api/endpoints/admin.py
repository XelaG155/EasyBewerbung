import logging
from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.language_catalog import get_language_options
from app.models import (
    User,
    LanguageSetting,
    PromptTemplate,
    UserActivityLog,
)
from app.api.endpoints.users import serialize_user, record_activity, UserResponse
from app.limiter import limiter

logger = logging.getLogger(__name__)

router = APIRouter()

# Constants
MAX_SEARCH_RESULTS = 50
MAX_ACTIVITY_LOGS = 50


def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required"
        )
    if not getattr(current_user, "is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account is locked"
        )
    return current_user


class LanguageSettingResponse(BaseModel):
    id: int
    code: str
    label: str
    direction: str
    is_active: bool
    sort_order: int

    class Config:
        from_attributes = True


class LanguageSettingUpdate(BaseModel):
    code: str
    is_active: bool
    sort_order: int = Field(..., ge=0)


class AdminUserSummary(BaseModel):
    id: int
    email: str
    full_name: Optional[str]
    is_admin: bool
    is_active: bool
    credits: int
    last_login_at: Optional[str]

    class Config:
        from_attributes = True


class ActivityEntry(BaseModel):
    action: str
    ip_address: Optional[str] = None
    metadata: Optional[str] = None
    created_at: str


class UserDetailResponse(BaseModel):
    user: UserResponse
    activity: List[ActivityEntry]


class CreditUpdateRequest(BaseModel):
    amount: int = Field(..., ge=-1000000, le=1000000, description="Credit adjustment amount (can be negative)")
    reason: Optional[str] = None


class PromptResponse(BaseModel):
    id: int
    doc_type: str
    name: str
    content: str
    updated_at: str

    class Config:
        from_attributes = True


class PromptUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = Field(None, min_length=1, max_length=50000)


class ToggleActiveRequest(BaseModel):
    is_active: bool


class ToggleAdminRequest(BaseModel):
    is_admin: bool


DEFAULT_PROMPTS = [
    ("cover_letter", "Cover Letter", "Default cover letter prompt"),
    ("cv", "CV", "Default CV prompt"),
    ("motivation", "Motivation", "Default motivation prompt"),
]


def ensure_language_settings(db: Session) -> None:
    existing_codes = {ls.code for ls in db.query(LanguageSetting).all()}
    if existing_codes:
        return

    for order, option in enumerate(get_language_options()):
        db.add(
            LanguageSetting(
                code=option.code,
                label=option.label,
                direction=option.direction,
                sort_order=order,
                is_active=True,
            )
        )
    db.commit()


def ensure_prompts(db: Session) -> None:
    if db.query(PromptTemplate).count() > 0:
        return
    for doc_type, name, content in DEFAULT_PROMPTS:
        db.add(PromptTemplate(doc_type=doc_type, name=name, content=content))
    db.commit()


@router.get("/admin/languages", response_model=List[LanguageSettingResponse])
@limiter.limit("30/minute")
async def list_languages(request: Request, db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    ensure_language_settings(db)
    languages = db.query(LanguageSetting).order_by(LanguageSetting.sort_order).all()
    return languages


@router.put("/admin/languages", response_model=List[LanguageSettingResponse])
@limiter.limit("20/minute")
async def update_languages(
    payload: List[LanguageSettingUpdate],
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    ensure_language_settings(db)
    code_to_setting = {ls.code: ls for ls in db.query(LanguageSetting).all()}
    invalid_codes = []
    for item in payload:
        setting = code_to_setting.get(item.code)
        if not setting:
            invalid_codes.append(item.code)
            continue
        setting.is_active = item.is_active
        setting.sort_order = item.sort_order

    if invalid_codes:
        logger.warning(f"Invalid language codes in update request: {invalid_codes}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid language codes: {', '.join(invalid_codes)}"
        )

    db.commit()
    languages = db.query(LanguageSetting).order_by(LanguageSetting.sort_order).all()
    return languages


@router.get("/admin/users", response_model=List[AdminUserSummary])
@limiter.limit("30/minute")
async def search_users(
    request: Request,
    query: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    q = db.query(User)
    if query:
        # Escape SQL wildcards to prevent SQL injection
        escaped_query = query.replace("%", "\\%").replace("_", "\\_")
        like_query = f"%{escaped_query}%"
        q = q.filter((User.email.ilike(like_query)) | (User.full_name.ilike(like_query)))
    users = q.order_by(User.created_at.desc()).limit(MAX_SEARCH_RESULTS).all()
    return [
        AdminUserSummary(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            is_admin=bool(getattr(user, "is_admin", False)),
            is_active=bool(getattr(user, "is_active", True)),
            credits=user.credits,
            last_login_at=user.last_login_at.isoformat() if user.last_login_at else None,
        )
        for user in users
    ]


@router.get("/admin/users/{user_id}", response_model=UserDetailResponse)
@limiter.limit("30/minute")
async def get_user_detail(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    activity = (
        db.query(UserActivityLog)
        .filter(UserActivityLog.user_id == user.id)
        .order_by(UserActivityLog.created_at.desc())
        .limit(MAX_ACTIVITY_LOGS)
        .all()
    )
    return UserDetailResponse(
        user=serialize_user(user),
        activity=[
            {
                "action": log.action,
                "ip_address": log.ip_address,
                "metadata": log.metadata_,
                "created_at": log.created_at.isoformat(),
            }
            for log in activity
        ],
    )


@router.post("/admin/users/{user_id}/credits", response_model=UserDetailResponse)
@limiter.limit("20/minute")
async def adjust_credits(
    user_id: int,
    payload: CreditUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Validate that credits won't go negative
    new_credits = user.credits + payload.amount
    if new_credits < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Credit adjustment would result in negative balance ({new_credits})"
        )

    user.credits = new_credits
    db.commit()
    db.refresh(user)
    record_activity(db, user, "credit_update", request=request, metadata=payload.reason)
    return await get_user_detail(user_id, request, db, admin)


@router.post("/admin/users/{user_id}/active", response_model=UserDetailResponse)
@limiter.limit("20/minute")
async def toggle_active(
    user_id: int,
    payload: ToggleActiveRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify your own active status"
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = payload.is_active
    db.commit()
    record_activity(db, user, "unlock" if user.is_active else "lock", request=request)
    return await get_user_detail(user_id, request, db, admin)


@router.post("/admin/users/{user_id}/admin", response_model=UserDetailResponse)
@limiter.limit("20/minute")
async def toggle_admin(
    user_id: int,
    payload: ToggleAdminRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify your own admin status"
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_admin = payload.is_admin
    db.commit()
    record_activity(db, user, "grant_admin" if user.is_admin else "revoke_admin", request=request)
    return await get_user_detail(user_id, request, db, admin)


@router.get("/admin/prompts", response_model=List[PromptResponse])
@limiter.limit("30/minute")
async def list_prompts(request: Request, db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    ensure_prompts(db)
    prompts = db.query(PromptTemplate).order_by(PromptTemplate.id).all()
    return [
        PromptResponse(
            id=prompt.id,
            doc_type=prompt.doc_type,
            name=prompt.name,
            content=prompt.content,
            updated_at=prompt.updated_at.isoformat(),
        )
        for prompt in prompts
    ]


@router.put("/admin/prompts/{prompt_id}", response_model=PromptResponse)
@limiter.limit("20/minute")
async def update_prompt(
    prompt_id: int,
    payload: PromptUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    prompt = db.query(PromptTemplate).filter(PromptTemplate.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    # Validate that at least one field is being updated
    if payload.name is None and payload.content is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one field (name or content) must be provided"
        )

    if payload.name is not None:
        # Basic sanitization: strip whitespace
        sanitized_name = payload.name.strip()
        if not sanitized_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Name cannot be empty or whitespace only"
            )
        prompt.name = sanitized_name

    if payload.content is not None:
        # Basic sanitization: strip leading/trailing whitespace but preserve internal formatting
        sanitized_content = payload.content.strip()
        if not sanitized_content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Content cannot be empty or whitespace only"
            )
        prompt.content = sanitized_content

    prompt.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(prompt)
    record_activity(db, admin, "update_prompt", request=request, metadata=f"prompt:{prompt_id}")
    return PromptResponse(
        id=prompt.id,
        doc_type=prompt.doc_type,
        name=prompt.name,
        content=prompt.content,
        updated_at=prompt.updated_at.isoformat(),
    )
