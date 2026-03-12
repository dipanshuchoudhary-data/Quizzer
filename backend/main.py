import asyncio
import logging
import sys
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.core.config import settings
from backend.api.auth import router as auth_router
from backend.api.quizzes import router as quiz_router
from backend.api.attemps import router as attempt_router
from backend.api.answers import router as answer_router
from backend.api.violations import router as violation_router
from backend.api.review import router as review_router
from backend.api.results import router as result_router, export_router
from backend.api.document import router as document_router
from backend.api.questions import router as question_router
from backend.api.sections import router as section_router
from backend.api.monitoring import router as monitoring_router
from backend.api.users import router as user_router
from backend.api.ai_jobs import router as ai_jobs_router
from backend.api.dashboard import router as dashboard_router

# psycopg async mode is incompatible with ProactorEventLoop on Windows.
# Set Selector policy before any event loop is created.
if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(
        title="Quizzer API",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in settings.CORS_ALLOW_ORIGINS.split(",") if origin.strip()],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def log_slow_requests(request, call_next):
        started_at = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - started_at) * 1000
        response.headers["X-Response-Time-MS"] = f"{duration_ms:.1f}"
        if duration_ms > 150:
            logger.warning("slow_request method=%s path=%s duration_ms=%.1f", request.method, request.url.path, duration_ms)
        return response

    # Routers
    app.include_router(auth_router)
    app.include_router(quiz_router)
    app.include_router(attempt_router)
    app.include_router(answer_router)
    app.include_router(violation_router)
    app.include_router(review_router)
    app.include_router(question_router)
    app.include_router(result_router)
    app.include_router(export_router)
    app.include_router(document_router)
    app.include_router(section_router)
    app.include_router(monitoring_router)
    app.include_router(user_router)
    app.include_router(ai_jobs_router)
    app.include_router(dashboard_router)

    @app.get("/health", tags=["Health"])
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
