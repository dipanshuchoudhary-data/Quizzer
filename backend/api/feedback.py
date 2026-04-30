import logging

from fastapi import APIRouter, Depends, HTTPException, status

from backend.api.deps import get_optional_current_user
from backend.models.user import User
from backend.schemas.feedback import FeedbackCreateRequest
from backend.services.email_service import is_email_configured, send_feedback_email


router = APIRouter(prefix="/feedback", tags=["Feedback"])
logger = logging.getLogger(__name__)


def resolve_feedback_contact_email(*, contact_email: str | None, user_email: str | None) -> str | None:
    normalized_contact_email = (contact_email or "").strip().lower()
    if normalized_contact_email:
        return normalized_contact_email

    normalized_user_email = (user_email or "").strip().lower()
    if normalized_user_email:
        return normalized_user_email

    return None


@router.post("")
async def submit_feedback(
    payload: FeedbackCreateRequest,
    current_user: User | None = Depends(get_optional_current_user),
):
    resolved_contact_email = resolve_feedback_contact_email(
        contact_email=payload.contact_email,
        user_email=current_user.email if current_user else None,
    )
    if not resolved_contact_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide your email address before sending feedback.",
        )

    if not is_email_configured():
        logger.error(
            "feedback_email_service_not_configured user_id=%s user_email=%s message=%r",
            getattr(current_user, "id", None),
            getattr(current_user, "email", None),
            payload.message,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Feedback email provider is not configured yet. Please try again later.",
        )

    try:
        await send_feedback_email(
            feedback_message=payload.message,
            feedback_subject=payload.subject,
            contact_email=resolved_contact_email,
            user_id=str(current_user.id) if current_user else None,
            user_email=current_user.email if current_user else None,
            user_name=current_user.full_name if current_user else None,
        )
    except Exception as exc:
        logger.exception("feedback_submission_failed user_id=%s", getattr(current_user, "id", None))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to send feedback right now",
        ) from exc

    return {"message": "Feedback sent successfully"}
