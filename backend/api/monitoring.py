import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user
from backend.core.database import get_db
from backend.models.attempt import Attempt
from backend.models.quiz import Quiz
from backend.models.user import User
from backend.models.violation import Violation


router = APIRouter(prefix="/monitoring", tags=["Monitoring"])


@router.get("/{quiz_id}/attempts")
async def list_quiz_attempts(
    quiz_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = await db.get(Quiz, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if quiz.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this quiz")

    attempts_result = await db.execute(
        select(Attempt).where(Attempt.quiz_id == quiz_id).order_by(Attempt.created_at.desc())
    )
    attempts = attempts_result.scalars().all()

    violation_result = await db.execute(
        select(Violation.attempt_id, func.count(Violation.id)).group_by(Violation.attempt_id)
    )
    violation_map = {str(attempt_id): count for attempt_id, count in violation_result.all()}

    data = []
    for attempt in attempts:
        violation_count = int(violation_map.get(str(attempt.id), 0))
        data.append(
            {
                "id": str(attempt.id),
                "quiz_id": str(attempt.quiz_id),
                "attempt_token": attempt.attempt_token,
                "submitted_at": attempt.submitted_at,
                "violation_count": violation_count,
                "integrity_flag": violation_count > 0,
                "status": "SUBMITTED" if attempt.submitted_at else "PENDING",
            }
        )

    return data
