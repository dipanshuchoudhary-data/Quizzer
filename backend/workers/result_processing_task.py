import asyncio
from backend.workers.celery_app import celery_app
from backend.core.database import SessionLocal
from backend.ai.graphs.result_processing_graph import build_result_processing_graph


@celery_app.task(name="process_result")
def process_result(attempt_id: str):

    async def _run():
        graph = build_result_processing_graph()

        async with SessionLocal() as db:

            await graph.ainvoke(
                {
                    "db": db,
                    "attempt_id": attempt_id,
                    "objective_score": 0,
                    "short_answer_payload": [],
                    "short_answer_scores": [],
                    "violation_count": 0,
                    "final_score": 0,
                    "review_required": False,
                }
            )

    asyncio.run(_run())
