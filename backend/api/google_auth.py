import secrets

from authlib.integrations.base_client.errors import OAuthError
from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import RedirectResponse

from backend.api.auth import set_auth_cookies
from backend.core.config import settings
from backend.core.database import get_db
from backend.core.security import create_access_token
from backend.services.auth_sessions import create_auth_session
from backend.services.google_auth import get_or_create_google_user, validate_google_claims

router = APIRouter(tags=["Google Auth"])
NONCE_SESSION_KEY = "google_oauth_nonce"

oauth = OAuth()

oauth.register(
    name="google",
    client_id=settings.GOOGLE_CLIENT_ID,
    client_secret=settings.GOOGLE_CLIENT_SECRET,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


@router.get("/login/google")
async def login_google(request: Request):
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET or not settings.GOOGLE_REDIRECT_URI:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Google OAuth is not configured")

    nonce = secrets.token_urlsafe(32)
    request.session[NONCE_SESSION_KEY] = nonce
    return await oauth.google.authorize_redirect(request, settings.GOOGLE_REDIRECT_URI, nonce=nonce)


@router.get("/auth/google/callback")
async def auth_callback(request: Request, db: AsyncSession = Depends(get_db)):
    provider_error = request.query_params.get("error")
    if provider_error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Google OAuth failed: {provider_error}",
        )

    nonce = request.session.pop(NONCE_SESSION_KEY, None)
    if not nonce:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing OAuth session state")

    try:
        token = await oauth.google.authorize_access_token(request)
        claims = await oauth.google.parse_id_token(request, token, nonce=nonce)
    except OAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Google OAuth failed: {exc.error}") from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token") from exc

    if not claims:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token")

    validated_claims = validate_google_claims(dict(claims), expected_audience=settings.GOOGLE_CLIENT_ID)
    user = await get_or_create_google_user(db, **validated_claims)

    auth_session = await create_auth_session(db, user, request)
    await db.commit()
    await db.refresh(user)
    await db.refresh(auth_session)

    access_token = create_access_token({"sub": str(user.id), "sid": str(auth_session.id), "typ": "access"})
    redirect_url = f"{settings.FRONTEND_URL}/auth/success?token={access_token}"
    response = RedirectResponse(url=redirect_url)
    set_auth_cookies(response, user_id=str(user.id), session_id=str(auth_session.id))
    return response
