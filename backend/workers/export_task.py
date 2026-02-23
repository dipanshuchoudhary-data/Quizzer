import asyncio
from backend.workers.celery_app import celery_app
from backend.core.database import SessionLocal
from backend.services.export_service import (
    fetch_results_for_quiz,
    generate_csv,
    generate_excel,
)


@celery_app.task(name="export_results")
def export_results(quiz_id: str, format_type: str):

    async def _run():

        async with SessionLocal() as db:

            data = await fetch_results_for_quiz(db, quiz_id)

            if not data:
                return None

            if format_type == "csv":
                return generate_csv(data)

            if format_type == "excel":
                return generate_excel(data)

            raise ValueError("Invalid export format")

    return asyncio.run(_run())
