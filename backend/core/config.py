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
    # LLM Config
    # ----------------------
    LLM_PROVIDER: str = "openrouter"
    LLM_MODEL: str
    LLM_API_KEY: str
    OPENROUTER_BASE_URL: str | None = None

    # ----------------------
    # Storage 
    # ----------------------
    GCS_BUCKET_NAME: str | None = None
    GCP_PROJECT_ID: str | None = None


settings = Settings()
