"""
Task Execution Abstraction Layer

This module provides a unified interface for dispatching tasks that can run either
synchronously (inline) or asynchronously (via Celery), based on configuration.

Supports:
- Render Free Tier: USE_CELERY=false (inline execution, no worker required)
- GCP/Production: USE_CELERY=true (Celery worker execution)

Switching modes requires ONLY config change - no code changes needed.
"""

import asyncio
import logging
import uuid
from backend.core.config import settings
from backend.workers.document_task import process_document as celery_process_document
from backend.workers.quiz_creation_task import create_quiz_ai as celery_create_quiz_ai
from backend.workers.export_task import export_results as celery_export_results

logger = logging.getLogger(__name__)


class SimpleTask:
    """Simple task object for inline execution to mimic Celery task.id."""

    def __init__(self):
        self.id = str(uuid.uuid4())


async def dispatch_document_task(document_id: str) -> None:
    """
    Dispatch document processing task.

    Routes to either Celery queue or inline execution based on USE_CELERY config.

    NOTE: This function is async. Call with: await dispatch_document_task(...)

    Args:
        document_id: UUID of the document to process
    """
    if settings.USE_CELERY:
        logger.info(f"[Celery] Dispatching document task: {document_id}")
        celery_process_document.delay(document_id)
    else:
        logger.info(f"[Inline] Executing document task: {document_id}")
        # Run synchronously in thread pool - blocks until complete
        await asyncio.to_thread(celery_process_document, document_id)


async def dispatch_quiz_task(
    job_id: str,
    quiz_id: str,
    extracted_text: str,
    blueprint: dict,
    professor_note: str | None,
) -> None:
    """
    Dispatch quiz generation task (LONG-RUNNING - non-blocking).

    Routes to either Celery queue or background thread based on USE_CELERY config.

    IMPORTANT: This does NOT wait for task completion. Task runs in background.
    Frontend polls job status to track progress.

    Args:
        job_id: UUID of the AI job
        quiz_id: UUID of the quiz
        extracted_text: Extracted text from sources
        blueprint: Quiz generation blueprint
        professor_note: Additional notes from professor
    """
    if settings.USE_CELERY:
        logger.info(f"[Celery] Dispatching quiz task: job_id={job_id}, quiz_id={quiz_id}")
        celery_create_quiz_ai.delay(
            job_id,
            quiz_id,
            extracted_text,
            blueprint,
            professor_note,
        )
    else:
        logger.info(f"[Background] Queuing quiz task: job_id={job_id}, quiz_id={quiz_id}")
        # Run in background thread - API returns immediately, task runs in parallel
        asyncio.create_task(
            _run_quiz_task_background(
                job_id,
                quiz_id,
                extracted_text,
                blueprint,
                professor_note,
            )
        )


async def dispatch_export_task(
    quiz_id: str,
    format_type: str,
    owner_id: str | None = None,
) -> SimpleTask:
    """
    Dispatch export results task.

    Routes to either Celery queue or inline execution based on USE_CELERY config.

    NOTE: This function is async. Call with: await dispatch_export_task(...)

    Args:
        quiz_id: UUID of the quiz
        format_type: Export format ('csv' or 'excel')
        owner_id: Optional user ID for owner filtering

    Returns:
        Task object with id attribute (Celery task or SimpleTask)
    """
    simple_task = SimpleTask()

    if settings.USE_CELERY:
        logger.info(f"[Celery] Dispatching export task: quiz_id={quiz_id}, format={format_type}")
        return celery_export_results.delay(quiz_id, format_type, owner_id)
    else:
        logger.info(f"[Inline] Executing export task: quiz_id={quiz_id}, format={format_type}")
        # Run synchronously in thread pool - blocks until complete
        await asyncio.to_thread(
            celery_export_results,
            quiz_id,
            format_type,
            owner_id,
        )
        return simple_task


# ============================================================================
# Background Task Runners (for inline execution without blocking API)
# ============================================================================


async def _run_quiz_task_background(
    job_id: str,
    quiz_id: str,
    extracted_text: str,
    blueprint: dict,
    professor_note: str | None,
) -> None:
    """Run quiz generation task in background (non-blocking)."""
    try:
        logger.info(f"[START] Background quiz generation: job_id={job_id}, quiz_id={quiz_id}")
        await asyncio.to_thread(
            celery_create_quiz_ai,
            job_id,
            quiz_id,
            extracted_text,
            blueprint,
            professor_note,
        )
        logger.info(f"[SUCCESS] Quiz generation completed: job_id={job_id}")
    except Exception as e:
        logger.error(f"[FAILED] Quiz generation failed: job_id={job_id}, error={e}")