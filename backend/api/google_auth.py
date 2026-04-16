import secrets
from urllib.parse import urlencode
import logging

from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from starlette.responses import RedirectResponse

from backend.api.auth import create_user_access_token, normalize_user_role, set_auth_cookies
from backend.core.config import settings
from backend.core.database import get_db
from backend.services.auth_sessions import create_auth_session
from backend.services.google_auth import get_or_create_google_user, validate_google_claims

router = APIRouter(tags=["Google Auth"])
logger = logging.getLogger(__name__)
OAUTH_STATE_MAX_AGE_SECONDS = 600
oauth_state_serializer = URLSafeTimedSerializer(settings.JWT_SECRET_KEY, salt="google-oauth-state")


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


def _map_token_parse_error(error_text: str) -> str:
    text = (error_text or "").lower()
    if "nonce" in text:
        return "google_token_nonce_mismatch"
    if "expired" in text or "exp" in text:
        return "google_token_expired"
    if "signature" in text:
        return "google_token_signature_invalid"
    if "issuer" in text:
        return "google_token_issuer_invalid"
    if "aud" in text or "audience" in text:
        return "google_token_audience_invalid"
    return "google_token_invalid"


def _create_oauth_state(nonce: str) -> str:
    return oauth_state_serializer.dumps({"nonce": nonce})


def _load_oauth_state(state: str | None) -> dict:
    if not state:
        raise ValueError("missing state")
    try:
        data = oauth_state_serializer.loads(state, max_age=OAUTH_STATE_MAX_AGE_SECONDS)
    except SignatureExpired as exc:
        raise ValueError("expired state") from exc
    except BadSignature as exc:
        raise ValueError("invalid state") from exc

    if not isinstance(data, dict) or not data.get("nonce"):
        raise ValueError("invalid state data")
    return data

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
    authorization = await oauth.google.create_authorization_url(
        settings.GOOGLE_REDIRECT_URI,
        nonce=nonce,
        state=_create_oauth_state(nonce),
    )
    return RedirectResponse(authorization["url"], status_code=302)


@router.get("/auth/google/callback")
async def auth_callback(request: Request, db: AsyncSession = Depends(get_db)):
    provider_error = request.query_params.get("error")
    if provider_error:
        logger.warning("google_oauth_provider_error error=%s", provider_error)
        return _frontend_auth_error_redirect("google_oauth_failed")

    try:
        state_data = _load_oauth_state(request.query_params.get("state"))
    except ValueError as exc:
        logger.warning("google_oauth_state_invalid reason=%s", exc)
        return _frontend_auth_error_redirect("google_oauth_session_missing")

    code = request.query_params.get("code")
    if not code:
        logger.warning("google_oauth_missing_code")
        return _frontend_auth_error_redirect("google_oauth_failed")

    try:
        token = await oauth.google.fetch_access_token(
            redirect_uri=settings.GOOGLE_REDIRECT_URI,
            code=code,
        )
        claims = await oauth.google.parse_id_token(token, nonce=state_data["nonce"])
    except Exception as exc:
        error_code = _map_token_parse_error(str(exc))
        logger.exception("google_oauth_token_parse_failed code=%s", error_code)
        return _frontend_auth_error_redirect(error_code)

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
