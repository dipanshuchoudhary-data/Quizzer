from fastapi import APIRouter, Depends, HTTPException, Response, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.database import get_db
from backend.core.security import (
    verify_password,
    hash_password,
    create_access_token,
    decode_access_token,
)
from backend.schemas.auth import RegisterRequest, LoginRequest
from backend.models.user import User
from backend.api.deps import get_current_user


router = APIRouter(prefix="/auth", tags=["Auth"])


# =========================
# REGISTER
# =========================
@router.post("/register", response_model=dict)
async def register(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.email == payload.email)
    )
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered",
        )

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        is_active=True,
        is_staff=False,
    )

    db.add(user)
    await db.commit()

    return {"message": "User registered successfully"}


# =========================
# LOGIN
# =========================
@router.post("/login")
async def login(
    payload: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.email == payload.email)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # Access Token (short-lived)
    access_token = create_access_token(
        {"sub": str(user.id)}
    )

    # Refresh Token (long-lived)
    refresh_token = create_access_token(
        {"sub": str(user.id)}
    )

    # Set Access Cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,  # TRUE in production (HTTPS)
        samesite="lax",
        path="/",
        max_age=60 * 60,  # 1 hour
    )

    # Set Refresh Cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,  # TRUE in production
        samesite="lax",
        path="/",
        max_age=60 * 60 * 24 * 7,  # 7 days
    )

    return {"success": True}


# =========================
# LOGOUT
# =========================
@router.post("/logout")
async def logout(response: Response):
    """
    Explicitly remove authentication cookies.
    """

    response.delete_cookie(
        key="access_token",
        path="/",
    )

    response.delete_cookie(
        key="refresh_token",
        path="/",
    )

    return {"message": "Logged out successfully"}


# =========================
# CURRENT USER
# =========================
@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_user),
):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "is_staff": current_user.is_staff,
        "is_active": current_user.is_active,
    }


# =========================
# REFRESH TOKEN
# =========================
@router.post("/refresh")
async def refresh_token(
    request: Request,
    response: Response,
):
    refresh_token = request.cookies.get("refresh_token")

    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token",
        )

    payload = decode_access_token(refresh_token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user_id = payload.get("sub")

    new_access_token = create_access_token(
        {"sub": str(user_id)}
    )

    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        secure=False,  # TRUE in production
        samesite="lax",
        path="/",
        max_age=60 * 60,
    )

    return {"message": "Token refreshed"}


# =========================
# CHANGE PASSWORD
# =========================
@router.post("/change-password")
async def change_password(
    current_password: str,
    new_password: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect",
        )

    current_user.hashed_password = hash_password(new_password)

    db.add(current_user)
    await db.commit()

    return {"message": "Password updated successfully"}