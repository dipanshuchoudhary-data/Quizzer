# backend/core/config.py

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ----------------------
    # App
    # ----------------------
    APP_ENV: str = "local"
    APP_URL: str = "http://localhost:3000"
    FRONTEND_URL: str = "http://localhost:3000"
    CORS_ALLOW_ORIGINS: str = "http://localhost:3000"

    # ----------------------
    # Database
    # ----------------------
    POSTGRES_DSN: str
    REDIS_URL: str

    # ----------------------
    # JWT
    # ----------------------
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60

    # ----------------------
    # Email / SMS
    # ----------------------
    EMAIL_API_KEY: str | None = None
    EMAIL_FROM: str = "Quizzer <no-reply@quizzer.app>"
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_USE_TLS: bool = True
    SMS_API_KEY: str | None = None
    TWILIO_ACCOUNT_SID: str | None = None
    TWILIO_PHONE_NUMBER: str | None = None

    # ----------------------
    # Cookie security
    # ----------------------
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"  # lax | strict | none
    COOKIE_DOMAIN: str | None = None

    # ----------------------
    # LLM Config
    # ----------------------
    LLM_PROVIDER: str = "openrouter"
    LLM_MODEL: str
    LLM_API_KEY: str
    OPENROUTER_BASE_URL: str | None = None
    QUIZ_STREAM_TIMEOUT_SECONDS: int = 300

    # ----------------------
    # Storage 
    # ----------------------
    GCS_BUCKET_NAME: str | None = None
    GCP_PROJECT_ID: str | None = None


settings = Settings()
