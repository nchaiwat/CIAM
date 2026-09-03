import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base directory of the repository
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "Central IAM"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # Database
    POSTGRES_USER: str = "ciam_admin"
    POSTGRES_PASSWORD: str = "ciam_secure_pass_2026"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5433
    POSTGRES_DB: str = "central_iam"
    DATABASE_URL: str = "postgresql+psycopg://ciam_admin:ciam_secure_pass_2026@localhost:5433/central_iam"
    SQLITE_DB_URL: str = "sqlite:///./central_iam.db"

    # Security
    SECRET_KEY: str = "central_iam_super_secret_jwt_key_2026_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Active Directory Gateway
    AD_GATEWAY_URL: str = "http://192.168.12.11:3100"
    AD_SYNC_ENABLED: bool = False

    # Telegram Alert
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""
    TELEGRAM_ALERTS_ENABLED: bool = False

    # Development Simulation Mode for Spoke Apps
    SIMULATE_SPOKE_RESPONSES: bool = True

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
