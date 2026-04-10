import logging

from fastapi import APIRouter, Depends, HTTPException, status

from backend.api.deps import get_optional_current_user
from backend.models.user import User
from backend.schemas.feedback import FeedbackCreateRequest
from backend.services.email_service import is_smtp_configured, send_feedback_email


router = APIRouter(prefix="/feedback", tags=["Feedback"])
logger = logging.getLogger(__name__)


@router.post("")
async def submit_feedback(
    payload: FeedbackCreateRequest,
    current_user: User | None = Depends(get_optional_current_user),
):
    if not is_smtp_configured():
        logger.warning(
            "feedback_submission_logged_without_email user_id=%s user_email=%s message=%r",
            getattr(current_user, "id", None),
            getattr(current_user, "email", None),
            payload.message,
        )
        return {"message": "Feedback received successfully"}

    try:
        await send_feedback_email(
            feedback_message=payload.message,
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
