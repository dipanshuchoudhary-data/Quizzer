import asyncio
import logging
import sys

from backend.workers.celery_app import celery_app
from backend.workers.task_db import get_task_sessionmaker
from backend.services.export_service import (
    create_export_file,
    fetch_results_for_quiz,
)

logger = logging.getLogger(__name__)

if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


@celery_app.task(name="export_results")
def export_results(quiz_id: str, format_type: str, owner_id: str | None = None):
    logger.info(f"[START] Exporting results: quiz_id={quiz_id}, format={format_type}")

    async def _run():

        SessionLocal = get_task_sessionmaker()
        async with SessionLocal() as db:

            data = await fetch_results_for_quiz(db, quiz_id)

            if not data:
                logger.warning(f"[FAILED] No data found for quiz {quiz_id}")
                return None

            export_file = create_export_file(
                data,
                quiz_id=quiz_id,
                owner_id=str(owner_id or ""),
                format_type=format_type,
            )
            logger.info(f"[SUCCESS] Export completed: quiz_id={quiz_id}, file={export_file.file_path if export_file else 'None'}")
            return export_file.__dict__

    try:
        return asyncio.run(_run())
    except Exception as e:
        logger.error(f"[FAILED] Export failed: quiz_id={quiz_id}, error={e}")
        raise
