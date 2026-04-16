import asyncio
from types import SimpleNamespace

from authlib.integrations.base_client.errors import OAuthError
from starlette.requests import Request

from backend.api import google_auth


class FakeDb:
    async def commit(self):
        return None

    async def refresh(self, _value):
        return None


def make_request(query_string: bytes = b"code=ok&state=state"):
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/auth/google/callback",
            "query_string": query_string,
            "headers": [(b"user-agent", b"pytest")],
            "client": ("127.0.0.1", 5000),
            "session": {},
        }
    )


def run(coro):
    return asyncio.run(coro)


def test_google_callback_uses_authlib_userinfo(monkeypatch):
    claims = {
        "iss": "https://accounts.google.com",
        "aud": google_auth.settings.GOOGLE_CLIENT_ID,
        "email": "Teacher@Example.com",
        "email_verified": True,
        "sub": "google-user-1",
        "name": "Teacher Example",
    }
    user = SimpleNamespace(
        id="user-1",
        email="teacher@example.com",
        role="teacher",
        full_name="Teacher Example",
        onboarding_completed=True,
    )
    auth_session = SimpleNamespace(id="session-1")

    async def authorize_access_token(_request):
        return {"userinfo": claims}

    async def parse_id_token(*_args, **_kwargs):
        raise AssertionError("authorize_access_token already parses and nonce-validates the ID token")

    async def get_or_create_google_user(_db, **_claims):
        assert _claims["email"] == "teacher@example.com"
        return user, False

    async def create_auth_session(_db, _user, _request):
        return auth_session

    monkeypatch.setattr(google_auth.oauth.google, "authorize_access_token", authorize_access_token)
    monkeypatch.setattr(google_auth.oauth.google, "parse_id_token", parse_id_token)
    monkeypatch.setattr(google_auth, "get_or_create_google_user", get_or_create_google_user)
    monkeypatch.setattr(google_auth, "create_auth_session", create_auth_session)

    response = run(google_auth.auth_callback(make_request(), FakeDb()))

    assert response.status_code == 307
    assert response.headers["location"].startswith(f"{google_auth.settings.FRONTEND_URL}/auth/success?token=")
    assert "access_token=" in response.headers.get("set-cookie", "")


def test_google_callback_maps_missing_state_to_session_error(monkeypatch):
    async def authorize_access_token(_request):
        raise OAuthError(error="mismatching_state")

    monkeypatch.setattr(google_auth.oauth.google, "authorize_access_token", authorize_access_token)

    response = run(google_auth.auth_callback(make_request(), FakeDb()))

    assert response.status_code == 307
    assert response.headers["location"] == f"{google_auth.settings.FRONTEND_URL}/login?error=google_oauth_session_missing"
