from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.auth import router as auth_router
from backend.api.quizzes import router as quiz_router
from backend.api.attemps import router as attempt_router
from backend.api.answers import router as answer_router
from backend.api.violations import router as violation_router
from backend.api.review import router as review_router
from backend.api.results import router as result_router
from backend.api.document import router as document_router



def create_app() -> FastAPI:
    app = FastAPI(
        title="Quizzer API",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # CORS (adjust in production)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    app.include_router(auth_router)
    app.include_router(quiz_router)
    app.include_router(attempt_router)
    app.include_router(answer_router)
    app.include_router(violation_router)
    app.include_router(review_router)
    app.include_router(result_router)
    app.include_router(document_router)

    @app.get("/health", tags=["Health"])
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
