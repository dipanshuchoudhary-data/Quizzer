from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import settings
from backend.models.auth_session import AuthSession
from backend.models.user import User


@dataclass
class AuthenticatedRequestContext:
    user: User
    session: AuthSession
    token_payload: dict


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


def parse_device_label(user_agent: str | None) -> str:
    agent = (user_agent or "").lower()
    if not agent:
        return "Unknown device"

    browser = "Browser"
    if "edg/" in agent:
        browser = "Edge"
    elif "chrome/" in agent and "edg/" not in agent:
        browser = "Chrome"
    elif "firefox/" in agent:
        browser = "Firefox"
    elif "safari/" in agent and "chrome/" not in agent:
        browser = "Safari"

    os_name = "Unknown OS"
    if "windows" in agent:
        os_name = "Windows"
    elif "iphone" in agent or "ipad" in agent or "ios" in agent:
        os_name = "iOS"
    elif "mac os x" in agent or "macintosh" in agent:
        os_name = "macOS"
    elif "android" in agent:
        os_name = "Android"
    elif "linux" in agent:
        os_name = "Linux"

    device_type = "Desktop"
    if "ipad" in agent or "tablet" in agent:
        device_type = "Tablet"
    elif "iphone" in agent or "android" in agent or "mobile" in agent:
        device_type = "Mobile"

    return f"{browser} on {os_name} ({device_type})"


def get_session_expiry() -> datetime:
    return utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)


async def create_auth_session(db: AsyncSession, user: User, request: Request) -> AuthSession:
    now = utcnow()
    auth_session = AuthSession(
        user_id=user.id,
        device=parse_device_label(request.headers.get("user-agent")),
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        status="active",
        expires_at=get_session_expiry(),
        last_seen_at=now,
    )
    db.add(auth_session)
    await db.flush()
    return auth_session


async def get_authenticated_context(db: AsyncSession, *, session_id: str, user_id: str | None = None) -> AuthenticatedRequestContext:
    query = select(AuthSession, User).join(User, User.id == AuthSession.user_id).where(AuthSession.id == session_id)
    if user_id is not None:
        query = query.where(User.id == user_id)
    result = await db.execute(query)
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session not found")

    auth_session, user = row
    now = utcnow()
    if auth_session.status != "active" or auth_session.revoked_at is not None or auth_session.expires_at <= now:
        if auth_session.status != "expired":
            auth_session.status = "expired"
            auth_session.revoked_at = auth_session.revoked_at or now
            db.add(auth_session)
            await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not active")

    return AuthenticatedRequestContext(user=user, session=auth_session, token_payload={})


async def touch_auth_session(db: AsyncSession, auth_session: AuthSession) -> None:
    auth_session.last_seen_at = utcnow()
    db.add(auth_session)
    await db.commit()
    await db.refresh(auth_session)


async def expire_session(db: AsyncSession, auth_session: AuthSession) -> None:
    auth_session.status = "expired"
    auth_session.revoked_at = utcnow()
    db.add(auth_session)
    await db.commit()


async def expire_all_user_sessions(db: AsyncSession, user_id: str) -> None:
    result = await db.execute(select(AuthSession).where(AuthSession.user_id == user_id, AuthSession.status == "active"))
    sessions = result.scalars().all()
    if not sessions:
        return

    now = utcnow()
    for auth_session in sessions:
        auth_session.status = "expired"
        auth_session.revoked_at = now
        db.add(auth_session)
    await db.commit()


async def list_user_sessions(db: AsyncSession, user_id: str) -> list[AuthSession]:
    result = await db.execute(
        select(AuthSession)
        .where(AuthSession.user_id == user_id)
        .order_by(AuthSession.last_seen_at.desc(), AuthSession.created_at.desc())
    )
    sessions = result.scalars().all()

    now = utcnow()
    changed = False
    for auth_session in sessions:
        if auth_session.status == "active" and auth_session.expires_at <= now:
            auth_session.status = "expired"
            auth_session.revoked_at = auth_session.revoked_at or now
            db.add(auth_session)
            changed = True

    if changed:
        await db.commit()

    return sessions
