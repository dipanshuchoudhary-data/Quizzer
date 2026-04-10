from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import settings
from backend.core.database import get_db
from backend.core.security import decode_token
from backend.models.auth_session import AuthSession
from backend.models.user import User
from backend.services.auth_sessions import AuthenticatedRequestContext, get_authenticated_context


async def get_current_auth_context(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AuthenticatedRequestContext:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        scheme, _, credentials = auth_header.partition(" ")
        if scheme.lower() == "bearer" and credentials.strip():
            token = credentials.strip()

    if not token:
        if settings.DEMO_MODE:
            demo_result = await db.execute(select(User).where(User.is_active.is_(True)).limit(1))
            demo_user = demo_result.scalar_one_or_none()
            if demo_user:
                demo_session = AuthSession(
                    user_id=demo_user.id,
                    device="Demo device",
                    ip_address="127.0.0.1",
                    status="active",
                    expires_at=demo_user.created_at,
                    last_seen_at=demo_user.created_at,
                )
                return AuthenticatedRequestContext(user=demo_user, session=demo_session, token_payload={})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    payload = decode_token(token, expected_type="access")
    user_id = payload.get("sub")
    session_id = payload.get("sid")
    if not user_id or not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    context = await get_authenticated_context(db, session_id=session_id, user_id=user_id)
    context.token_payload = payload
    return context


async def get_current_user(context: AuthenticatedRequestContext = Depends(get_current_auth_context)):
    return context.user


async def get_optional_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User | None:
    try:
        context = await get_current_auth_context(request=request, db=db)
    except HTTPException as exc:
        if exc.status_code == status.HTTP_401_UNAUTHORIZED:
            return None
        raise
    return context.user


async def get_current_auth_session(context: AuthenticatedRequestContext = Depends(get_current_auth_context)):
    return context.session


async def require_staff(user: User = Depends(get_current_user)):
    if user.role not in ["ADMIN", "STAFF"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )
    return user
