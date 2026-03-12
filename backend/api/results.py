import uuid
from pathlib import Path

from celery.result import AsyncResult
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import get_db
from backend.services.export_service import load_export_file
from backend.models.attempt import Attempt
from backend.models.result import Result
from backend.models.student_profile import StudentProfile
from backend.models.quiz import Quiz
from backend.api.deps import get_current_user, require_staff
from backend.models.user import User
from backend.workers.celery_app import celery_app
from backend.workers.export_task import export_results


router = APIRouter(prefix="/results", tags=["Results"])
export_router = APIRouter(prefix="/exports", tags=["Exports"])


@router.get("/{quiz_id}")
async def get_quiz_results(
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

    if not attempts:
        return []

    attempt_ids = [attempt.id for attempt in attempts]

    results_result = await db.execute(select(Result).where(Result.attempt_id.in_(attempt_ids)))
    result_map = {str(item.attempt_id): item for item in results_result.scalars().all()}

    profiles_result = await db.execute(select(StudentProfile).where(StudentProfile.attempt_id.in_(attempt_ids)))
    profile_map = {str(item.attempt_id): item for item in profiles_result.scalars().all()}

    payload = []
    for attempt in attempts:
        result = result_map.get(str(attempt.id))
        profile = profile_map.get(str(attempt.id))
        payload.append(
            {
                "id": str(result.id) if result else None,
                "student_name": profile.student_name if profile else None,
                "enrollment_number": profile.enrollment_number if profile else None,
                "institution_type": profile.institution_type if profile else None,
                "course": profile.course if profile else None,
                "section": profile.section if profile else None,
                "semester": profile.semester if profile else None,
                "batch": profile.batch if profile else None,
                "attempt_token": attempt.attempt_token,
                "final_score": int(result.final_score) if result else int(getattr(attempt, "final_score", 0) or 0),
                "violation_count": int(result.violation_count) if result else 0,
                "integrity_flag": bool(result.integrity_flag) if result else False,
                "status": result.status if result else getattr(attempt, "status", "IN_PROGRESS"),
                "submitted_at": attempt.submitted_at,
            }
        )

    return payload


@router.post("/{quiz_id}/export")
async def export_quiz_results(
    quiz_id: uuid.UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    quiz = await db.get(Quiz, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    if quiz.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to export this quiz")

    format_type = payload.get("format")

    if format_type not in ["csv", "excel"]:
        raise HTTPException(
            status_code=400,
            detail="format must be 'csv' or 'excel'",
        )

    task = export_results.delay(str(quiz_id), format_type, str(current_user.id))

    return {
        "message": "Export started",
        "task_id": task.id,
    }


@export_router.get("/status/{task_id}")
async def get_export_status(
    task_id: str,
    current_user: User = Depends(require_staff),
):
    task = AsyncResult(task_id, app=celery_app)
    state = task.state

    if state == "SUCCESS":
        payload = task.result
        if not payload:
            return {
                "status": "SUCCESS",
                "download_url": None,
                "file_id": None,
                "file_name": None,
            }
        if payload.get("owner_id") != str(current_user.id):
            raise HTTPException(status_code=403, detail="Not authorized to access this export")
        return {
            "status": "SUCCESS",
            "download_url": f"/exports/download/{payload['file_id']}",
            "file_id": payload["file_id"],
            "file_name": payload["file_name"],
        }

    if state == "FAILURE":
        return {
            "status": "FAILURE",
            "detail": str(task.result),
        }

    return {
        "status": state,
        "download_url": None,
        "file_id": None,
        "file_name": None,
    }


@export_router.get("/download/{file_id}")
async def download_export_file(
    file_id: str,
    current_user: User = Depends(require_staff),
):
    export_file = load_export_file(file_id)
    if not export_file:
        raise HTTPException(status_code=404, detail="Export file not found or expired")
    if export_file.owner_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to download this export")

    file_path = Path(export_file.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Export file not found or expired")

    def file_iterator():
        with file_path.open("rb") as file_handle:
            while chunk := file_handle.read(1024 * 64):
                yield chunk

    headers = {
        "Content-Disposition": f'attachment; filename="{export_file.file_name}"',
    }
    return StreamingResponse(
        file_iterator(),
        media_type=export_file.content_type,
        headers=headers,
    )
