import backend.models
import os
import sys
from celery import Celery
from backend.core.config import settings


def _get_redis_url_with_ssl(url: str) -> str:
    """Add SSL parameters for rediss:// URLs if not already present."""
    if url.startswith("rediss://") and "ssl_cert_reqs" not in url:
        separator = "&" if "?" in url else "?"
        return f"{url}{separator}ssl_cert_reqs=CERT_NONE"
    return url


redis_url = _get_redis_url_with_ssl(settings.REDIS_URL)

celery_app = Celery(
    "quiz_platform",
    broker=redis_url,
    backend=redis_url,
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
