import asyncio
import sys

from backend.workers.celery_app import celery_app
from backend.core.database import SessionLocal
from backend.services.export_service import (
    create_export_file,
    fetch_results_for_quiz,
)

if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


@celery_app.task(name="export_results")
def export_results(quiz_id: str, format_type: str, owner_id: str | None = None):

    async def _run():

        async with SessionLocal() as db:

            data = await fetch_results_for_quiz(db, quiz_id)

            if not data:
                return None

            export_file = create_export_file(
                data,
                quiz_id=quiz_id,
                owner_id=str(owner_id or ""),
                format_type=format_type,
            )
            return export_file.__dict__

    return asyncio.run(_run())
