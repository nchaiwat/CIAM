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
    AD_GATEWAY_URL: str = "http://172.18.0.1:3100"
    AD_ORIGIN_IP: str = "157.173.219.153"
    AD_SYNC_ENABLED: bool = False
    AD_APP_ID: str = "CIAM"
    AD_SECRET_KEY: str = "aa0a27f191208cbe6543c88636d18ff40b9bea422dfc51d426bf920ca54c1823"
    AD_MANAGEMENT_KEY: str = "aa0a27f191208cbe6543c88636d18ff40b9bea422dfc51d426bf920ca54c1823"

    # Telegram Alert
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""
    TELEGRAM_ALERTS_ENABLED: bool = False

    # Development Simulation Mode for Spoke Apps
    SIMULATE_SPOKE_RESPONSES: bool = True

    # Microsoft 365 (Microsoft Graph API)
    M365_TENANT_ID: str = "3bf476e6-c0a4-4e60-9692-f9a20c16c12b"
    M365_CLIENT_ID: str = "1d78dd68-7e09-4daa-8eac-de6331716980"
    M365_CLIENT_SECRET: str = ""

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
