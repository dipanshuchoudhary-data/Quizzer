import secrets

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.security import hash_password
from backend.models.user import User

DEFAULT_COUNTRY = "India"
DEFAULT_TIMEZONE = "Asia/Kolkata"


def validate_google_claims(claims: dict, *, expected_audience: str) -> dict:
    issuer = claims.get("iss")
    audience = claims.get("aud")
    email = claims.get("email")
    google_id = claims.get("sub")

    valid_issuers = {"accounts.google.com", "https://accounts.google.com"}
    if issuer not in valid_issuers:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token issuer")

    if isinstance(audience, list):
        audience_valid = expected_audience in audience
    else:
        audience_valid = audience == expected_audience
    if not audience_valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token audience")

    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google account email is required")
    if not claims.get("email_verified", False):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google account email is not verified")
    if not google_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google account identifier")

    return {
        "email": email.strip().lower(),
        "full_name": (claims.get("name") or "Professor").strip(),
        "avatar_url": claims.get("picture"),
        "google_id": google_id,
    }


async def get_or_create_google_user(
    db: AsyncSession,
    *,
    email: str,
    full_name: str,
    avatar_url: str | None,
    google_id: str,
 ) -> tuple[User, bool]:
    result = await db.execute(
        select(User).where(or_(User.google_id == google_id, User.email == email))
    )
    matches = result.scalars().all()

    google_user = next((user for user in matches if user.google_id == google_id), None)
    email_user = next((user for user in matches if user.email == email), None)

    if google_user and email_user and google_user.id != email_user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Google account is already linked to a different user",
        )

    user = google_user or email_user
    if user is None:
        user = User(
            full_name=full_name or "Professor",
            email=email,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            google_id=google_id,
            auth_provider="google",
            avatar_url=avatar_url,
            country=DEFAULT_COUNTRY,
            timezone=DEFAULT_TIMEZONE,
            is_active=True,
            is_verified=True,
            is_staff=False,
            role="",
        )
        db.add(user)
        await db.flush()
        return user, True

    if user.google_id and user.google_id != google_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email is already linked to a different Google account",
        )

    is_new_google_link = False
    if not user.google_id:
        user.google_id = google_id
        is_new_google_link = True
    if full_name:
        user.full_name = full_name
    if avatar_url:
        user.avatar_url = avatar_url
    user.country = user.country or DEFAULT_COUNTRY
    user.timezone = user.timezone or DEFAULT_TIMEZONE
    user.is_active = True
    user.is_verified = True
    db.add(user)
    await db.flush()
    return user, is_new_google_link
