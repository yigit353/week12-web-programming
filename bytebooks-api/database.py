"""
database.py - Database Connection and Session Management
=========================================================

This module handles all database-related configuration:
- Creating the SQLite database engine
- Providing session objects for dependency injection

SQLModel uses SQLAlchemy under the hood, so the engine and session
concepts come directly from SQLAlchemy. The engine manages the
connection pool, while sessions represent individual database
conversations (transactions).
"""

import os

from sqlmodel import SQLModel, Session, create_engine

# ---------------------------------------------------------------------------
# Database Engine Configuration
# ---------------------------------------------------------------------------
# In production (Railway) we read DATABASE_URL from the environment, which
# Railway injects automatically when a Postgres plugin is attached. For
# local development we fall back to a SQLite file so students can run the
# API without installing Postgres.
#
# Railway historically exposes Postgres URLs as `postgres://...`, but
# SQLAlchemy 1.4+ requires the explicit `postgresql://` scheme. We rewrite
# the prefix here so the same code works in both environments.
# ---------------------------------------------------------------------------
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///bytebooks.db")

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite needs check_same_thread=False because FastAPI handles requests on
# multiple threads; Postgres does not need it.
_is_sqlite = DATABASE_URL.startswith("sqlite")
_connect_args = {"check_same_thread": False} if _is_sqlite else {}

# echo=True is great for learning locally but spams production logs. Disable
# it whenever we're talking to a non-SQLite (i.e. real) database.
engine = create_engine(DATABASE_URL, echo=_is_sqlite, connect_args=_connect_args)


def create_db_and_tables() -> None:
    """Create all database tables defined by SQLModel models.

    SQLModel.metadata.create_all() inspects every class that inherits from
    SQLModel (with table=True) and issues CREATE TABLE IF NOT EXISTS
    statements so the schema is always up to date.
    """
    SQLModel.metadata.create_all(engine)


def get_session():
    """Yield a database session for FastAPI dependency injection.

    Dependency injection is a design pattern where FastAPI automatically
    calls this function and passes the resulting Session object into any
    endpoint that declares `session: Session = Depends(get_session)`.

    Using a generator (yield) ensures the session is properly closed
    after the request is finished, even if an error occurs.
    """
    with Session(engine) as session:
        yield session
