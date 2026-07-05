"""Suite B — Postgres-backed smoke tests.

Only the checks a real DB connection unlocks. Every test is marked ``dbtest`` and is
auto-skipped unless TEST_DATABASE_URL is set (see conftest.pytest_collection_modifyitems).
Kept minimal: anything needing set_tenant_context / RLS roles / seeded tenants is
integration territory, out of scope for a smoke layer.
"""
from __future__ import annotations

import pytest
from sqlalchemy import text

pytestmark = pytest.mark.dbtest


async def test_engine_connectivity():
    """DATABASE_URL + the asyncpg driver actually connect and round-trip a query."""
    from app.database import get_engine

    async with get_engine().connect() as conn:
        result = await conn.execute(text("SELECT 1"))
        assert result.scalar() == 1


async def test_health_ok_against_real_db(client):
    """/health runs its real SELECT 1 against the test database (no get_db override)."""
    resp = await client.get("/api/v1/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
