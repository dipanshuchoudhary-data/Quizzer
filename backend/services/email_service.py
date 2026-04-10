import asyncio
import logging
import smtplib
from email.message import EmailMessage

from backend.core.config import settings


logger = logging.getLogger(__name__)


def is_smtp_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_USERNAME and settings.SMTP_PASSWORD)


async def _send_email(message: EmailMessage) -> None:
    if not is_smtp_configured():
        raise RuntimeError("SMTP is not configured")

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

    await asyncio.to_thread(_send)


async def send_verification_email(email: str, verification_url: str) -> None:
    subject = "Verify your Quizzer account"
    body = (
        "Click the link below to verify your account.\n"
        "This link expires in 10 minutes.\n\n"
        f"{verification_url}\n"
    )

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.EMAIL_FROM
    message["To"] = email
    message.set_content(body)

    try:
        await _send_email(message)
    except Exception:
        logger.exception("Failed to send verification email to %s", email)


async def send_feedback_email(
    *,
    feedback_message: str,
    user_id: str | None = None,
    user_email: str | None = None,
    user_name: str | None = None,
) -> None:
    message = EmailMessage()
    message["Subject"] = "Quizzer feedback submission"
    message["From"] = settings.EMAIL_FROM
    message["To"] = settings.FEEDBACK_EMAIL_TO

    body_lines = [
        "A new feedback submission was received from Quizzer.",
        "",
        f"User ID: {user_id or 'Anonymous'}",
        f"User Name: {user_name or 'Not available'}",
        f"User Email: {user_email or 'Not available'}",
        "",
        "Feedback:",
        feedback_message,
    ]
    message.set_content("\n".join(body_lines))

    await _send_email(message)
