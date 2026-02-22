from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.database import get_db
from backend.core.security import (
    verify_password,
    hash_password,
    create_access_token,
)
from backend.models.user import User
from backend.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


# --------------------------------------------------
# Register
# --------------------------------------------------

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
        is_staff=True,
    )

    db.add(user)
    await db.commit()

    return {"message": "User registered successfully"}


# --------------------------------------------------
# Login
# --------------------------------------------------

@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
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

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )

    token = create_access_token(str(user.id))

    return TokenResponse(access_token=token)
