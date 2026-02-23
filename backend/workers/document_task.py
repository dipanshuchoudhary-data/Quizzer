import asyncio
import sys
from backend.core.database import SessionLocal
from backend.workers.celery_app import celery_app
from backend.models.document import Document
from backend.services.document_service import extract_text_from_image
from backend.ai.agents.summarization_agent import summarize_document


# --------------------------------------------------
# Windows Async Fix (Required for psycopg + asyncio)
# --------------------------------------------------
if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(
        asyncio.WindowsSelectorEventLoopPolicy()
    )


# --------------------------------------------------
# Celery Task
# --------------------------------------------------

@celery_app.task(name="process_document")
def process_document(document_id: str):

    async def _run():

        async with SessionLocal() as db:

            # Fetch document
            doc = await db.get(Document, document_id)

            if not doc:
                return

            # Mark processing
            doc.extraction_status = "PROCESSING"
            await db.commit()

            try:
                # -----------------------------------
                # Extract text from file
                # -----------------------------------
                extracted_text = extract_text_from_image(
                    doc.storage_path,
                    doc.file_type,
                )

                if not extracted_text or len(extracted_text.strip()) == 0:
                    raise Exception("No text extracted")

                # -----------------------------------
                # Summarize using AI agent
                # -----------------------------------
                summary_data = await summarize_document(extracted_text)

                # -----------------------------------
                # Store structured metadata
                # -----------------------------------
                doc.extracted_metadata = {
                    "summary": summary_data.summary,
                    "key_topics": summary_data.key_topics,
                    "difficulty_level": summary_data.difficulty_level,
                    "text_length": len(extracted_text),
                }

                doc.extraction_status = "COMPLETED"
                await db.commit()

            except Exception as e:
                # Failure handling
                doc.extraction_status = "FAILED"
                doc.extracted_metadata = {
                    "error": str(e),
                }
                await db.commit()

    # Run async workflow inside Celery worker
    asyncio.run(_run())
