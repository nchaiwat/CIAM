import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

logger = logging.getLogger("ciam.database")

# Try connecting to PostgreSQL; fallback gracefully to SQLite if needed
try:
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20
    )
    # Test connection
    with engine.connect() as conn:
        logger.info("Successfully connected to PostgreSQL database at port %s", settings.POSTGRES_PORT)
except Exception as e:
    logger.warning("Could not connect to PostgreSQL (%s). Falling back to SQLite.", e)
    engine = create_engine(
        settings.SQLITE_DB_URL,
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """Dependency that yields a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
