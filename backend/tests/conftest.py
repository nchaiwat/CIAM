import pytest
from app.initial_data import init_db

@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Ensure database schema and initial seed data are populated before tests run."""
    init_db()
