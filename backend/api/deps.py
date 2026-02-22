from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.database import get_db
from backend.core.security import decode_access_token
from backend.models.user import User


bearer_scheme = HTTPBearer()


# --------------------------------------------------
# Get Current User (JWT Required)
# --------------------------------------------------

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:

    token = credentials.credentials
    user_id = decode_access_token(token)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    result = await db.execute(
        select(User).where(User.id == user_id)
    )

    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )

    return user


# --------------------------------------------------
# Professor Only Access
# --------------------------------------------------

async def require_staff(
    current_user: User = Depends(get_current_user),
) -> User:

    if not current_user.is_staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff access required",
        )

    return current_user
