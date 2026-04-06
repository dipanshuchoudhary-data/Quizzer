from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_auth_context, get_current_user
from backend.core.config import settings
from backend.core.database import get_db
from backend.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from backend.models.auth_session import AuthSession
from backend.models.user import User
from backend.schemas.auth import ChangePasswordRequest, LoginRequest, RegisterRequest
from backend.services.auth_sessions import (
    AuthenticatedRequestContext,
    create_auth_session,
    expire_all_user_sessions,
    expire_other_user_sessions,
    expire_session,
    get_authenticated_context,
    list_user_sessions,
    touch_auth_session,
)
from backend.services.cloudinary import build_avatar_thumbnail_url


router = APIRouter(prefix="/auth", tags=["Auth"])


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(key="access_token", path="/", domain=settings.COOKIE_DOMAIN)
    response.delete_cookie(key="refresh_token", path="/", domain=settings.COOKIE_DOMAIN)


def set_auth_cookies(response: Response, *, user_id: str, session_id: str) -> None:
    access_token = create_access_token({"sub": user_id, "sid": session_id, "typ": "access"})
    refresh_token = create_refresh_token({"sub": user_id, "sid": session_id, "typ": "refresh"})

    secure_cookie = settings.COOKIE_SECURE
    samesite_policy = settings.COOKIE_SAMESITE.lower()
    cookie_domain = settings.COOKIE_DOMAIN

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=secure_cookie,
        samesite=samesite_policy,
        domain=cookie_domain,
        path="/",
        max_age=settings.JWT_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=secure_cookie,
        samesite=samesite_policy,
        domain=cookie_domain,
        path="/",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )


def serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "display_name": user.full_name,
        "phone_number": user.phone_number,
        "institution": user.institution,
        "country": user.country,
        "timezone": user.timezone,
        "subject_area": user.subject_area,
        "courses_taught": user.courses_taught,
        "teaching_experience": user.teaching_experience,
        "avatar_url": user.avatar_url,
        "avatar_thumbnail_url": build_avatar_thumbnail_url(user.avatar_url),
        "is_verified": user.is_verified,
        "onboarding_completed": user.onboarding_completed,
        "is_staff": user.is_staff,
        "is_active": user.is_active,
        "role": user.role,
    }


def serialize_auth_session(auth_session: AuthSession, *, current_session_id: str | None) -> dict:
    return {
        "id": str(auth_session.id),
        "device": auth_session.device,
        "ip_address": auth_session.ip_address,
        "user_agent": auth_session.user_agent,
        "status": auth_session.status,
        "created_at": auth_session.created_at.isoformat(),
        "last_seen_at": auth_session.last_seen_at.isoformat(),
        "expires_at": auth_session.expires_at.isoformat(),
        "is_current": str(auth_session.id) == current_session_id,
    }


@router.post("/register", response_model=dict)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    normalized_email = payload.email.strip().lower()
    result = await db.execute(select(User).where(User.email == normalized_email))
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    if payload.phone_number:
        phone_result = await db.execute(select(User).where(User.phone_number == payload.phone_number))
        if phone_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Phone number already in use")

    user = User(
        full_name=payload.full_name.strip(),
        email=normalized_email,
        hashed_password=hash_password(payload.password),
        is_active=True,
        is_staff=False,
        is_verified=True,
        phone_number=payload.phone_number,
        institution=payload.institution,
        country=payload.country,
        timezone=payload.timezone,
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    return {"message": "Registration successful"}


@router.post("/login")
async def login(payload: LoginRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email.strip().lower()))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    auth_session = await create_auth_session(db, user, request)
    await db.commit()
    await db.refresh(auth_session)

    set_auth_cookies(response, user_id=str(user.id), session_id=str(auth_session.id))
    return {
        "success": True,
        "onboarding_completed": user.onboarding_completed,
        "is_verified": user.is_verified,
    }


@router.post("/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    token_value = request.cookies.get("access_token") or request.cookies.get("refresh_token")
    expected_type = "access" if request.cookies.get("access_token") else "refresh"
    if token_value:
        try:
            payload = decode_token(token_value, expected_type=expected_type)
            session_id = payload.get("sid")
            if session_id:
                result = await db.execute(select(AuthSession).where(AuthSession.id == session_id))
                auth_session = result.scalar_one_or_none()
                if auth_session and auth_session.status == "active":
                    await expire_session(db, auth_session)
        except HTTPException:
            pass

    clear_auth_cookies(response)
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return serialize_user(current_user)


@router.post("/refresh")
async def refresh_token(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    refresh_token_value = request.cookies.get("refresh_token")
    if not refresh_token_value:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")

    payload = decode_token(refresh_token_value, expected_type="refresh")
    user_id = payload.get("sub")
    session_id = payload.get("sid")
    if not user_id or not session_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    context = await get_authenticated_context(db, session_id=session_id, user_id=user_id)
    await touch_auth_session(db, context.session)
    set_auth_cookies(response, user_id=str(context.user.id), session_id=str(context.session.id))
    return {"message": "Token refreshed"}


@router.get("/sessions")
async def get_sessions(
    context: AuthenticatedRequestContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    sessions = await list_user_sessions(db, context.user.id)
    return {
        "sessions": [serialize_auth_session(auth_session, current_session_id=str(context.session.id)) for auth_session in sessions],
    }


@router.post("/logout-all")
async def logout_all_sessions(
    response: Response,
    context: AuthenticatedRequestContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    await expire_all_user_sessions(db, context.user.id)
    clear_auth_cookies(response)
    return {"message": "All sessions ended"}


@router.post("/logout-others")
async def logout_other_sessions(
    context: AuthenticatedRequestContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    await expire_other_user_sessions(db, str(context.user.id), str(context.session.id))
    return {"message": "Other sessions ended"}


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    response: Response,
    context: AuthenticatedRequestContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(payload.current_password, context.user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if payload.new_password == payload.current_password:
        raise HTTPException(status_code=400, detail="New password must be different from the current password")

    context.user.hashed_password = hash_password(payload.new_password)
    db.add(context.user)
    await db.flush()
    await expire_all_user_sessions(db, context.user.id)
    clear_auth_cookies(response)
    return {"message": "Password updated successfully"}
