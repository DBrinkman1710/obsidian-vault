"""Shared fixtures for the smoke test suites.

Two layers:
  * Suite A (test_smoke.py) — DB-free. Builds the app and hits it over an in-process
    ASGI transport; the one DB-backed route it touches (/health) uses a get_db override.
  * Suite B (test_smoke_db.py) — needs a live Postgres. Every test there is marked
    ``dbtest`` and is auto-skipped unless TEST_DATABASE_URL is set (see
    pytest_collection_modifyitems below).

Env is pinned *before* app import so get_settings()'s non-dev SECRET_KEY guard never
trips and, when a test DB is provided, the engine points at it.
"""
from __future__ import annotations

import os
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio

# --- Environment must be set before app.config is imported anywhere ---
# Default to development so get_settings() accepts the default SECRET_KEY.
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("SECRET_KEY", "smoke-test-secret-key-not-the-default")

# When a test database is provided, route the app engine at it so Suite B connects
# there rather than the docker-compose default (db:5432, unreachable outside compose).
_TEST_DB_URL = os.environ.get("TEST_DATABASE_URL")
if _TEST_DB_URL:
    os.environ["DATABASE_URL"] = _TEST_DB_URL


def _reset_settings() -> None:
    """Drop the cached Settings singleton so env changes above take effect.

    Mirrors the reset helper in test_email_accounts.py.
    """
    import app.config as config_module

    config_module._settings = None


@pytest.fixture()
def app():
    """A freshly built app instance (no lifespan, so the APScheduler jobs never start)."""
    _reset_settings()
    from app.main import create_app

    return create_app()


@pytest_asyncio.fixture()
async def client(app):
    """In-process ASGI client — no network, no running server, no lifespan."""
    from httpx import ASGITransport, AsyncClient

    # raise_app_exceptions=False makes the transport behave like a real server:
    # an unhandled endpoint exception becomes a 500 response instead of bubbling
    # into the test (see /public/sentry-test).
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture()
def override_db(app):
    """Override get_db with a fake async session (execute() -> AsyncMock).

    Lets DB-backed routes like /health run without a real Postgres connection.
    Returns the fake session so a test can assert on / configure it.
    """
    from app.database import get_db

    fake_session = AsyncMock()

    async def _fake_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = _fake_get_db
    try:
        yield fake_session
    finally:
        app.dependency_overrides.pop(get_db, None)


def pytest_collection_modifyitems(config, items):
    """Auto-skip dbtest-marked tests unless a test database is configured."""
    if os.environ.get("TEST_DATABASE_URL"):
        return
    skip_db = pytest.mark.skip(reason="needs a live Postgres (set TEST_DATABASE_URL)")
    for item in items:
        if "dbtest" in item.keywords:
            item.add_marker(skip_db)
