import uuid
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.database import get_db
from backend.models.attempt import Attempt
from backend.models.violation import Violation
from backend.core.redis import increment_violation


router = APIRouter(prefix="/violations", tags=["Violations"])


def _validate_attempt_token(attempt: Attempt, provided_token: str | None) -> None:
    if not provided_token or provided_token != attempt.attempt_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid attempt token",
        )


# --------------------------------------------------
# Report Violation (Student Runtime)
# --------------------------------------------------

@router.post("/{attempt_id}")
async def report_violation(
    attempt_id: uuid.UUID,
    payload: dict,
    x_attempt_token: str | None = Header(default=None, alias="X-Attempt-Token"),
    db: AsyncSession = Depends(get_db),
):

    violation_type = payload.get("violation_type")

    if not violation_type:
        raise HTTPException(
            status_code=400,
            detail="violation_type required",
        )

    result = await db.execute(
        select(Attempt).where(Attempt.id == attempt_id)
    )

    attempt = result.scalar_one_or_none()

    if not attempt:
        raise HTTPException(
            status_code=404,
            detail="Attempt not found",
        )
    _validate_attempt_token(attempt, x_attempt_token)

    if attempt.submitted_at:
        raise HTTPException(status_code=409, detail="Attempt already submitted")

    # Persist violation
    violation = Violation(
        attempt_id=attempt_id,
        violation_type=violation_type,
    )

    db.add(violation)
    await db.commit()

    # Increment Redis counter
    await increment_violation(str(attempt_id), violation_type)

    return {"message": "Violation recorded"}
