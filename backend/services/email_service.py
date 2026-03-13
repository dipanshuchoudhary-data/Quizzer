import asyncio
import logging
import smtplib
from email.message import EmailMessage

from backend.core.config import settings


logger = logging.getLogger(__name__)


async def send_verification_email(email: str, verification_url: str) -> None:
    subject = "Verify your Quizzer account"
    body = (
        "Click the link below to verify your account.\n"
        "This link expires in 10 minutes.\n\n"
        f"{verification_url}\n"
    )

    if not settings.SMTP_HOST or not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        logger.warning("SMTP not configured; verification link for %s: %s", email, verification_url)
        return

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.EMAIL_FROM
    message["To"] = email
    message.set_content(body)

    def _send() -> None:
        if settings.SMTP_USE_TLS:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
                server.starttls()
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(message)
            return

        with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(message)

    try:
        await asyncio.to_thread(_send)
    except Exception:
        logger.exception("Failed to send verification email to %s", email)
