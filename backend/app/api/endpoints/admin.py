import logging
import os
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


class ToggleActiveRequest(BaseModel):
    is_active: bool


class ToggleAdminRequest(BaseModel):
    is_admin: bool


# NOTE: The legacy Prompt Builder (PromptBuilderRequest/Response,
# get_llm_client, generate_with_prompt_builder_llm, and the
# /admin/generate-prompt endpoint) used to live here. It was replaced by
# the new drawer editor + dry-run preview flow in
# `app/api/endpoints/document_types.py::preview_document_template_prompt`,
# which resolves role/task/instructions from `document_prompts.json` and
# never produced an orphaned prompt that could silently diverge from the
# template stored in the DB. The legacy surface was removed on 2026-04-05
# (post-commit 6991e9c) together with its frontend counterpart
# `components/PromptBuilderModal.tsx`.


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
        raise HTTPException(status_code=404, detail="Benutzer/-in nicht gefunden.")

    # Validate that credits won't go negative
    new_credits = user.credits + payload.amount
    if new_credits < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Anpassung wuerde negatives Guthaben ergeben ({new_credits}). "
                "Bitte den Betrag korrigieren."
            ),
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
    # Deactivating a user must invalidate their outstanding JWTs — otherwise
    # the deactivated user keeps full access for up to 7 days.
    if not user.is_active:
        user.tokens_invalidated_after = datetime.now(timezone.utc)
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
    was_admin = bool(user.is_admin)
    user.is_admin = payload.is_admin
    # Demoting an admin must invalidate any admin-level JWTs they hold.
    # Promotion does not need revocation — the new privilege takes effect on
    # the next request because get_current_admin_user reads is_admin from DB.
    if was_admin and not user.is_admin:
        user.tokens_invalidated_after = datetime.now(timezone.utc)
    db.commit()
    record_activity(db, user, "grant_admin" if user.is_admin else "revoke_admin", request=request)
    return await get_user_detail(user_id, request, db, admin)


# NOTE: The legacy /admin/prompts endpoints (list_prompts, update_prompt)
# and their supporting helpers (ensure_prompts, DEFAULT_PROMPTS,
# PromptResponse, PromptUpdateRequest) used to live here. They backed a
# separate "Prompts verwalten" admin UI that only contained three
# placeholder rows (cover_letter, cv, motivation) with dummy content
# ("Default cover letter prompt" etc.) and were never read by the actual
# document-generation pipeline in app/tasks.py. The real prompts come
# from `document_templates.prompt_template` (DB) joined with
# `document_prompts.json` (per-doc-type role/task/instructions) via
# `_resolve_prompt_components`. Removed on 2026-04-05 together with the
# frontend "Prompts verwalten" section to stop confusing admins.
#
# The underlying `prompt_templates` DB table and SQLAlchemy model are
# intentionally left in place so that a downgrade from this commit does
# not require a destructive migration. If you also want the table gone,
# add an Alembic migration to drop it.


