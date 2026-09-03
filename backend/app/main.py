import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.initial_data import init_db
from app.api.v1.auth import router as auth_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.directory import router as directory_router
from app.api.v1.offboarding import router as offboarding_router
from app.api.v1.applications import router as applications_router
from app.api.v1.audit_logs import router as audit_logs_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("ciam.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Central IAM Engine...")
    try:
        init_db()
        logger.info("Central IAM database initialized and ready.")
    except Exception as e:
        logger.error("Error during startup database initialization: %s", e)
    yield
    logger.info("Shutting down Central IAM Engine...")

app = FastAPI(
    title="Central IAM API",
    description="Centralized Identity & Access Management Governance Engine for Window Asia PCL",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API v1 Routers
app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
app.include_router(dashboard_router, prefix=settings.API_V1_PREFIX)
app.include_router(directory_router, prefix=settings.API_V1_PREFIX)
app.include_router(offboarding_router, prefix=settings.API_V1_PREFIX)
app.include_router(applications_router, prefix=settings.API_V1_PREFIX)
app.include_router(audit_logs_router, prefix=settings.API_V1_PREFIX)

@app.get("/")
def root():
    return {
        "service": "Central IAM Engine",
        "organization": "Window Asia Public Company Limited",
        "status": "OPERATIONAL",
        "version": "1.0.0",
        "docs_url": "/docs"
    }

@app.get("/health")
def health_check():
    return {"status": "HEALTHY"}
