from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator


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
    APP_URL: str | None = None
    FRONTEND_URL: str | None = None
    CORS_ALLOW_ORIGINS: str | None = None
    DEMO_MODE: bool = False

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
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ----------------------
    # Email / SMS
    # ----------------------
    EMAIL_API_KEY: str | None = None
    EMAIL_FROM: str = "Quizzer <no-reply@quizzer.app>"
    FEEDBACK_EMAIL_TO: str = "dipanshuchoudhary109@gmail.com"
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
    # Google OAuth
    # ----------------------
    GOOGLE_CLIENT_ID: str | None = None
    GOOGLE_CLIENT_SECRET: str | None = None
    GOOGLE_REDIRECT_URI: str | None = None

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
    CLOUDINARY_CLOUD_NAME: str | None = None
    CLOUDINARY_API_KEY: str | None = None
    CLOUDINARY_API_SECRET: str | None = None
    CLOUDINARY_AVATAR_FOLDER: str = "quizzer/avatars"

    # ----------------------
    # Background Tasks
    # ----------------------
    USE_CELERY: bool = False  # Set to True when using Celery worker (GCP/Paid tier)

    @property
    def is_local(self) -> bool:
        return self.APP_ENV.lower() in {"local", "dev", "development"}

    @property
    def cors_origins(self) -> list[str]:
        raw = self.CORS_ALLOW_ORIGINS or ""
        return [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]

    @model_validator(mode="after")
    def validate_runtime_settings(self):
        if self.is_local:
            self.APP_URL = (self.APP_URL or "http://localhost:8000").rstrip("/")
            self.FRONTEND_URL = (self.FRONTEND_URL or "http://localhost:3000").rstrip("/")
            self.CORS_ALLOW_ORIGINS = self.CORS_ALLOW_ORIGINS or self.FRONTEND_URL
            return self

        required_values = {
            "APP_URL": self.APP_URL,
            "FRONTEND_URL": self.FRONTEND_URL,
            "CORS_ALLOW_ORIGINS": self.CORS_ALLOW_ORIGINS,
        }
        missing = [name for name, value in required_values.items() if not value]
        if missing:
            raise ValueError(f"Missing required production settings: {', '.join(missing)}")

        self.APP_URL = self.APP_URL.rstrip("/")
        self.FRONTEND_URL = self.FRONTEND_URL.rstrip("/")
        self.CORS_ALLOW_ORIGINS = ",".join(self.cors_origins)
        return self


settings = Settings()
