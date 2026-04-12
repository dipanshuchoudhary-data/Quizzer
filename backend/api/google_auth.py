import secrets
from urllib.parse import urlencode
import logging

from authlib.integrations.base_client.errors import OAuthError
from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import RedirectResponse

from backend.api.auth import create_user_access_token, normalize_user_role, set_auth_cookies
from backend.core.config import settings
from backend.core.database import get_db
from backend.services.auth_sessions import create_auth_session
from backend.services.google_auth import get_or_create_google_user, validate_google_claims

router = APIRouter(tags=["Google Auth"])
NONCE_SESSION_KEY = "google_oauth_nonce"
logger = logging.getLogger(__name__)


def _frontend_auth_error_redirect(error_code: str) -> RedirectResponse:
    query = urlencode({"error": error_code})
    return RedirectResponse(url=f"{settings.FRONTEND_URL}/login?{query}")


def _map_claim_validation_error(detail: str) -> str:
    mapping = {
        "Invalid Google token issuer": "google_token_issuer_invalid",
        "Invalid Google token audience": "google_token_audience_invalid",
        "Google account email is required": "google_email_missing",
        "Google account email is not verified": "google_email_unverified",
        "Invalid Google account identifier": "google_account_invalid",
    }
    return mapping.get(detail, "google_token_invalid")

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
        logger.warning("google_oauth_provider_error error=%s", provider_error)
        return _frontend_auth_error_redirect("google_oauth_failed")

    nonce = request.session.pop(NONCE_SESSION_KEY, None)
    if not nonce:
        logger.warning("google_oauth_missing_session_state")
        return _frontend_auth_error_redirect("google_oauth_session_missing")

    try:
        token = await oauth.google.authorize_access_token(request)
        claims = await oauth.google.parse_id_token(request, token, nonce=nonce)
    except OAuthError as exc:
        logger.warning("google_oauth_exchange_failed error=%s", getattr(exc, "error", "unknown"))
        return _frontend_auth_error_redirect("google_oauth_failed")
    except Exception:
        logger.exception("google_oauth_token_parse_failed")
        return _frontend_auth_error_redirect("google_token_invalid")

    if not claims:
        logger.warning("google_oauth_empty_claims")
        return _frontend_auth_error_redirect("google_token_invalid")

    try:
        validated_claims = validate_google_claims(dict(claims), expected_audience=settings.GOOGLE_CLIENT_ID)
        user, is_new_google_user = await get_or_create_google_user(db, **validated_claims)
    except HTTPException as exc:
        detail = str(exc.detail)
        error_code = _map_claim_validation_error(detail)
        logger.warning("google_oauth_claim_validation_failed reason=%s", detail)
        return _frontend_auth_error_redirect(error_code)
    except Exception:
        logger.exception("google_oauth_user_link_failed")
        return _frontend_auth_error_redirect("google_oauth_failed")

    auth_session = await create_auth_session(db, user, request)
    await db.commit()
    await db.refresh(user)
    await db.refresh(auth_session)

    access_token = create_user_access_token(user, session_id=str(auth_session.id))
    needs_onboarding = is_new_google_user or not normalize_user_role(user.role) or not user.onboarding_completed
    redirect_path = "/onboarding" if needs_onboarding else "/auth/success"
    redirect_url = f"{settings.FRONTEND_URL}{redirect_path}?token={access_token}"
    response = RedirectResponse(url=redirect_url)
    set_auth_cookies(response, user=user, session_id=str(auth_session.id))
    return response
