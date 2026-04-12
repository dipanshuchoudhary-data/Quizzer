import base64
import logging
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import secrets

import httpx

from backend.core.config import settings


logger = logging.getLogger(__name__)


def generate_verification_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(value: str) -> str:
    return sha256(value.encode("utf-8")).hexdigest()


def verification_token_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=24)


def generate_otp_code() -> str:
    return str(secrets.randbelow(1_000_000)).zfill(6)


def otp_expiry(minutes: int = 5) -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=minutes)


async def send_verification_email(to_email: str, full_name: str, token: str) -> None:
    base_url = str(getattr(settings, "FRONTEND_URL", None) or settings.APP_URL).rstrip("/")
    verify_url = f"{base_url}/verify-email?token={token}"
    subject = "Verify your Quizzer account"
    html = (
        f"<p>Hello {full_name},</p>"
        f"<p>Verify your email to activate your account.</p>"
        f"<p><a href='{verify_url}'>Verify email</a></p>"
        "<p>This link expires in 24 hours.</p>"
    )

    if not settings.EMAIL_API_KEY:
        logger.warning("EMAIL_API_KEY not configured; verification link: %s", verify_url)
        return

    payload = {
        "from": settings.EMAIL_FROM,
        "to": [to_email],
        "subject": subject,
        "html": html,
    }

    headers = {"Authorization": f"Bearer {settings.EMAIL_API_KEY}"}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post("https://api.resend.com/emails", json=payload, headers=headers)
        if response.status_code >= 400:
            logger.error("Failed to send verification email: %s", response.text)


async def send_otp_sms(phone_number: str, otp: str) -> None:
    message = f"Your Quizzer OTP is {otp}. It expires in 5 minutes."

    if not settings.SMS_API_KEY or not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_PHONE_NUMBER:
        logger.warning("SMS provider not configured; OTP for %s is %s", phone_number, otp)
        return

    credentials = f"{settings.TWILIO_ACCOUNT_SID}:{settings.SMS_API_KEY}"
    basic_auth = base64.b64encode(credentials.encode("utf-8")).decode("utf-8")

    data = {
        "To": phone_number,
        "From": settings.TWILIO_PHONE_NUMBER,
        "Body": message,
    }

    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
    headers = {"Authorization": f"Basic {basic_auth}"}

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(url, data=data, headers=headers)
        if response.status_code >= 400:
            logger.error("Failed to send OTP SMS: %s", response.text)
