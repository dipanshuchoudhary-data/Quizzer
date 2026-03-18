import backend.models 
import os
import sys
from celery import Celery
from backend.core.config import settings


celery_app = Celery(
    "quiz_platform",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    worker_concurrency=max(2, os.cpu_count() or 2),
    worker_prefetch_multiplier=1,
    broker_pool_limit=20,
    result_expires=3600,
    task_acks_late=True,
)

# Windows: billiard prefork pools can crash with WinError 5/6. Use solo worker pool.
if sys.platform.startswith("win"):
    celery_app.conf.update(
        worker_pool="solo",
        worker_concurrency=1,
    )

# 🔥 IMPORTANT: Explicitly include worker modules
celery_app.autodiscover_tasks([
    "backend.workers.document_task",
    "backend.workers.quiz_creation_task",
    "backend.workers.result_processing_task",
    "backend.workers.export_task",
])
