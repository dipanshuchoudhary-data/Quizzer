import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user
from backend.core.database import get_db
from backend.models.ai_job import AIJob
from backend.models.quiz import Quiz
from backend.models.user import User


router = APIRouter(prefix="/ai/jobs", tags=["AI Jobs"])


def _serialize_job(job: AIJob) -> dict:
    return {
        "id": str(job.id),
        "quiz_id": str(job.quiz_id),
        "status": job.status,
        "metadata": job.meta or {},
        "created_at": job.created_at,
        "updated_at": job.updated_at,
    }


@router.get("/quiz/{quiz_id}/latest")
async def get_latest_ai_job_for_quiz(
    quiz_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = await db.get(Quiz, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    if quiz.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this quiz")

    result = await db.execute(
        select(AIJob)
        .where(AIJob.quiz_id == quiz_id, AIJob.job_type == "QUIZ_CREATION")
        .order_by(AIJob.created_at.desc())
    )
    job = result.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="AI job not found")
    return _serialize_job(job)


@router.get("/{job_id}")
async def get_ai_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(AIJob, Quiz)
        .join(Quiz, Quiz.id == AIJob.quiz_id)
        .where(AIJob.id == job_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="AI job not found")

    job, quiz = row
    if quiz.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this AI job")

    return _serialize_job(job)
