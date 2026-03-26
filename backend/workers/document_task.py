import asyncio
import logging
import sys
from backend.workers.task_db import get_task_sessionmaker
from backend.workers.celery_app import celery_app
from backend.models.document import Document
from backend.services.document_service import extract_text_from_file
from backend.ai.agents.summarization_agent import summarize_document


logger = logging.getLogger(__name__)

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
    logger.info(f"[START] Processing document {document_id}")

    async def _run():

        SessionLocal = get_task_sessionmaker()
        async with SessionLocal() as db:

            # Fetch document
            doc = await db.get(Document, document_id)

            if not doc:
                logger.error(f"Document {document_id} not found")
                return

            # Mark processing
            doc.extraction_status = "PROCESSING"
            await db.commit()
            logger.info(f"Document {document_id} marked as PROCESSING")

            try:
                # -----------------------------------
                # Extract text from file
                # -----------------------------------
                logger.info(f"Extracting text from {doc.storage_path}")
                extracted_text = extract_text_from_file(
                    doc.storage_path,
                    doc.file_type,
                )

                if not extracted_text or len(extracted_text.strip()) == 0:
                    raise Exception("No text extracted")

                logger.info(f"Extracted {len(extracted_text)} chars from document {document_id}")

                # -----------------------------------
                # Summarize using AI agent
                # -----------------------------------
                logger.info(f"Summarizing document {document_id}")
                summary_data = await summarize_document(extracted_text)

                # -----------------------------------
                # Store structured metadata
                # -----------------------------------
                doc.extracted_metadata = {
                    "extracted_text": extracted_text,
                    "summary": summary_data.summary,
                    "key_topics": summary_data.key_topics,
                    "difficulty_level": summary_data.difficulty_level,
                    "text_length": len(extracted_text),
                }

                doc.extraction_status = "COMPLETED"
                await db.commit()
                logger.info(f"[SUCCESS] Document {document_id} processing completed")

            except Exception as e:
                # Failure handling
                logger.error(f"[FAILED] Document {document_id} processing failed: {e}")
                doc.extraction_status = "FAILED"
                doc.extracted_metadata = {
                    "error": str(e),
                }
                await db.commit()

    # Run async workflow inside Celery worker
    try:
        asyncio.run(_run())
    except Exception as e:
        logger.error(f"[FAILED] Fatal error processing document {document_id}: {e}")
        # Try to mark as failed even on fatal error
        try:
            async def _mark_failed():
                SessionLocal = get_task_sessionmaker()
                async with SessionLocal() as db:
                    doc = await db.get(Document, document_id)
                    if doc:
                        doc.extraction_status = "FAILED"
                        doc.extracted_metadata = {"error": f"Fatal: {str(e)}"}
                        await db.commit()
            asyncio.run(_mark_failed())
        except Exception:
            logger.exception(f"Could not mark document {document_id} as failed")
        raise
