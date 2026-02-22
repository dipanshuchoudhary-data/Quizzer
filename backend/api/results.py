import uuid
from fastapi import APIRouter, Depends, HTTPException
from backend.api.deps import require_staff
from backend.workers.export_task import export_results


router = APIRouter(prefix="/results", tags=["Results"])


@router.post("/{quiz_id}/export")
async def export_quiz_results(
    quiz_id: uuid.UUID,
    payload: dict,
    current_user = Depends(require_staff),
):

    format_type = payload.get("format")

    if format_type not in ["csv", "excel"]:
        raise HTTPException(
            status_code=400,
            detail="format must be 'csv' or 'excel'",
        )

    task = export_results.delay(str(quiz_id), format_type)

    return {
        "message": "Export started",
        "task_id": task.id,
    }
