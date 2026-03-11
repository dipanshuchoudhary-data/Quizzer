from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user
from backend.core.config import settings
from backend.core.database import get_db
from backend.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from backend.models.user import User
from backend.schemas.auth import (
    LoginRequest,
    RegisterRequest,
)


router = APIRouter(prefix="/auth", tags=["Auth"])


def set_auth_cookies(response: Response, user_id: str) -> None:
    access_token = create_access_token({"sub": user_id})
    refresh_token = create_access_token({"sub": user_id})

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
        max_age=60 * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=secure_cookie,
        samesite=samesite_policy,
        domain=cookie_domain,
        path="/",
        max_age=60 * 60 * 24 * 7,
    )


def serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "phone_number": user.phone_number,
        "institution": user.institution,
        "country": user.country,
        "timezone": user.timezone,
        "subject_area": user.subject_area,
        "courses_taught": user.courses_taught,
        "teaching_experience": user.teaching_experience,
        "avatar_url": user.avatar_url,
        "is_verified": user.is_verified,
        "onboarding_completed": user.onboarding_completed,
        "is_staff": user.is_staff,
        "is_active": user.is_active,
        "role": user.role,
    }


@router.post("/register", response_model=dict)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    if payload.phone_number:
        phone_result = await db.execute(select(User).where(User.phone_number == payload.phone_number))
        if phone_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Phone number already in use")

    user = User(
        full_name=payload.full_name.strip(),
        email=payload.email,
        hashed_password=hash_password(payload.password),
        is_active=True,
        is_staff=False,
        is_verified=True,
        phone_number=payload.phone_number,
        institution=payload.institution,
        country=payload.country,
        timezone=payload.timezone,
        email_verification_token_hash=None,
        email_verification_expires_at=None,
    )
    db.add(user)
    await db.commit()

    return {"message": "Registration successful"}


@router.post("/login")
async def login(payload: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    set_auth_cookies(response, str(user.id))
    return {"success": True, "onboarding_completed": user.onboarding_completed}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="access_token", path="/", domain=settings.COOKIE_DOMAIN)
    response.delete_cookie(key="refresh_token", path="/", domain=settings.COOKIE_DOMAIN)
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return serialize_user(current_user)


@router.post("/refresh")
async def refresh_token(request: Request, response: Response):
    refresh_token_value = request.cookies.get("refresh_token")
    if not refresh_token_value:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")

    payload = decode_access_token(refresh_token_value)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    secure_cookie = settings.COOKIE_SECURE
    samesite_policy = settings.COOKIE_SAMESITE.lower()
    cookie_domain = settings.COOKIE_DOMAIN

    response.set_cookie(
        key="access_token",
        value=create_access_token({"sub": str(user_id)}),
        httponly=True,
        secure=secure_cookie,
        samesite=samesite_policy,
        domain=cookie_domain,
        path="/",
        max_age=60 * 60,
    )
    return {"message": "Token refreshed"}


@router.post("/change-password")
async def change_password(
    current_password: str,
    new_password: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    current_user.hashed_password = hash_password(new_password)
    db.add(current_user)
    await db.commit()
    return {"message": "Password updated successfully"}
