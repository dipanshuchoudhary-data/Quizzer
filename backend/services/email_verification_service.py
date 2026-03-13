import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.email_verification_token import EmailVerificationToken


VERIFICATION_TOKEN_MINUTES = 10


async def generate_email_verification_token(user_id: UUID, db: AsyncSession) -> str:
    await db.execute(
        delete(EmailVerificationToken).where(EmailVerificationToken.user_id == user_id)
    )

    token_value = secrets.token_urlsafe(32)
    token = EmailVerificationToken(
        user_id=user_id,
        token=token_value,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=VERIFICATION_TOKEN_MINUTES),
        created_at=datetime.now(timezone.utc),
    )
    db.add(token)
    await db.flush()
    return token_value


async def get_email_verification_token(token: str, db: AsyncSession) -> EmailVerificationToken | None:
    result = await db.execute(
        select(EmailVerificationToken).where(EmailVerificationToken.token == token)
    )
    return result.scalar_one_or_none()
