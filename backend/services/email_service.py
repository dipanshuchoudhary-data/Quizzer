import asyncio
import logging
import smtplib
from email.message import EmailMessage

import httpx

from backend.core.config import settings


logger = logging.getLogger(__name__)


def is_smtp_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_USERNAME and settings.SMTP_PASSWORD)


def is_email_configured() -> bool:
    return bool(settings.EMAIL_API_KEY or is_smtp_configured())


async def _send_email(message: EmailMessage) -> None:
    if settings.EMAIL_API_KEY:
        payload = {
            "from": message.get("From"),
            "to": [message.get("To")],
            "subject": message.get("Subject"),
            "text": message.get_content(),
            "reply_to": message.get("Reply-To"),
        }
        headers = {"Authorization": f"Bearer {settings.EMAIL_API_KEY}"}
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post("https://api.resend.com/emails", json=payload, headers=headers)
            if response.status_code >= 400:
                raise RuntimeError(f"Resend email send failed: {response.status_code} {response.text}")
        return

    if not is_smtp_configured():
        raise RuntimeError("Email provider is not configured")

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
    feedback_subject: str | None = None,
    contact_email: str | None = None,
    user_id: str | None = None,
    user_email: str | None = None,
    user_name: str | None = None,
) -> None:
    message = EmailMessage()
    message["Subject"] = "Quizzer support request" if feedback_subject else "Quizzer feedback submission"
    message["From"] = settings.EMAIL_FROM
    message["To"] = settings.FEEDBACK_EMAIL_TO
    reply_to = contact_email or user_email
    if reply_to:
        message["Reply-To"] = reply_to

    body_lines = [
        "A new support/feedback submission was received from Quizzer.",
        "",
        f"Subject: {feedback_subject or 'General feedback'}",
        f"Contact Email: {contact_email or user_email or 'Not available'}",
        f"User ID: {user_id or 'Anonymous'}",
        f"User Name: {user_name or 'Not available'}",
        f"User Email: {user_email or 'Not available'}",
        "",
        "Feedback:",
        feedback_message,
    ]
    message.set_content("\n".join(body_lines))

    await _send_email(message)
