import csv
import json
import tempfile
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from openpyxl import Workbook
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.attempt import Attempt
from backend.models.result import Result
from backend.models.student_profile import StudentProfile


EXPORT_TTL = timedelta(hours=1)
EXPORT_DIR = Path(tempfile.gettempdir()) / "exports"


@dataclass
class ExportFile:
    file_id: str
    file_name: str
    file_path: str
    content_type: str
    quiz_id: str
    owner_id: str
    format_type: str
    created_at: str


def _serialize_value(value):
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _safe_stem(value: str) -> str:
    return "".join(char if char.isalnum() or char in {"-", "_"} else "_" for char in value) or "quiz"


def _timestamp_slug() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")


def ensure_export_dir() -> Path:
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    return EXPORT_DIR


def cleanup_old_exports() -> None:
    export_dir = ensure_export_dir()
    cutoff = datetime.now(timezone.utc) - EXPORT_TTL
    for path in export_dir.iterdir():
        if not path.is_file():
            continue
        try:
            modified = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
            if modified < cutoff:
                path.unlink(missing_ok=True)
        except FileNotFoundError:
            continue


def _metadata_path(file_id: str) -> Path:
    return ensure_export_dir() / f"{file_id}.json"


def _write_csv(file_path: Path, data: list[dict]) -> None:
    with file_path.open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=list(data[0].keys()))
        writer.writeheader()
        writer.writerows(data)


def _write_excel(file_path: Path, data: list[dict]) -> None:
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = "Results"

    headers = list(data[0].keys())
    worksheet.append(headers)

    for row in data:
        worksheet.append([row[key] for key in headers])

    workbook.save(file_path)


def create_export_file(data: list[dict], quiz_id: str, owner_id: str, format_type: str) -> ExportFile:
    cleanup_old_exports()
    export_dir = ensure_export_dir()
    file_id = str(uuid4())
    timestamp = _timestamp_slug()
    safe_quiz_id = _safe_stem(quiz_id)

    if format_type == "csv":
        extension = "csv"
        content_type = "text/csv"
        writer = _write_csv
    elif format_type == "excel":
        extension = "xlsx"
        content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        writer = _write_excel
    else:
        raise ValueError("Invalid export format")

    file_name = f"results_{safe_quiz_id}_{timestamp}.{extension}"
    file_path = export_dir / file_name
    normalized_rows = [{key: _serialize_value(value) for key, value in row.items()} for row in data]
    writer(file_path, normalized_rows)

    export_file = ExportFile(
        file_id=file_id,
        file_name=file_name,
        file_path=str(file_path),
        content_type=content_type,
        quiz_id=quiz_id,
        owner_id=owner_id,
        format_type=format_type,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    _metadata_path(file_id).write_text(json.dumps(export_file.__dict__), encoding="utf-8")
    return export_file


def load_export_file(file_id: str) -> ExportFile | None:
    cleanup_old_exports()
    metadata_path = _metadata_path(file_id)
    if not metadata_path.exists():
        return None

    try:
        payload = json.loads(metadata_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        metadata_path.unlink(missing_ok=True)
        return None

    file_path = Path(payload["file_path"])
    if not file_path.exists():
        metadata_path.unlink(missing_ok=True)
        return None

    return ExportFile(**payload)


async def fetch_results_for_quiz(db: AsyncSession, quiz_id: str):
    query = (
        select(Result, Attempt, StudentProfile)
        .join(Attempt, Result.attempt_id == Attempt.id)
        .join(StudentProfile, StudentProfile.attempt_id == Attempt.id)
        .where(Attempt.quiz_id == quiz_id)
    )

    result = await db.execute(query)
    rows = result.all()
    structured = []

    for result_obj, attempt, profile in rows:
        structured.append(
            {
                "student_name": profile.student_name,
                "enrollment_number": profile.enrollment_number,
                "final_score": result_obj.final_score,
                "violation_count": result_obj.violation_count,
                "integrity_flag": result_obj.integrity_flag,
                "status": result_obj.status,
                "submitted_at": attempt.submitted_at,
            }
        )
    return structured
