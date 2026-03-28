import asyncio
import logging
import sys
import time

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.core.config import settings
from backend.core.security import ensure_password_backend_available
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
from backend.api.ai_quiz import router as ai_quiz_router

# psycopg async mode is incompatible with ProactorEventLoop on Windows.
# Set Selector policy before any event loop is created.
if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

logger = logging.getLogger(__name__)


def _resolve_cors_origins(raw_origins: str) -> list[str]:
    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    expanded = {origin.rstrip("/") for origin in origins}

    if settings.is_local:
        # In local development Next.js may shift ports (3001, 3002, ...).
        for port in range(3000, 3011):
            expanded.add(f"http://localhost:{port}")
            expanded.add(f"http://127.0.0.1:{port}")

    return sorted(expanded)


def _local_dev_origin_regex() -> str:
    return r"^https?://(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$"


def create_app() -> FastAPI:
    ensure_password_backend_available()

    app = FastAPI(
        title="Quizzer API",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # CORS
    app.add_middleware(
    CORSMiddleware,
    allow_origins=_resolve_cors_origins(settings.CORS_ALLOW_ORIGINS or ""),
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

    @app.middleware("http")
    async def log_slow_requests(request, call_next):
        started_at = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - started_at) * 1000
            logger.exception("request_failed method=%s path=%s duration_ms=%.1f", request.method, request.url.path, duration_ms)
            raise
        duration_ms = (time.perf_counter() - started_at) * 1000
        response.headers["X-Response-Time-MS"] = f"{duration_ms:.1f}"
        if duration_ms > 150:
            logger.warning("slow_request method=%s path=%s duration_ms=%.1f", request.method, request.url.path, duration_ms)
        return response

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception("unhandled_exception method=%s path=%s", request.method, request.url.path, exc_info=exc)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )

    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

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
    app.include_router(ai_quiz_router)

    @app.get("/health", tags=["Health"])
    async def health():
        return {"status": "ok", "app_env": settings.APP_ENV, "demo_mode": settings.DEMO_MODE}

    return app


app = create_app()
