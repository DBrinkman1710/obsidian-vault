"""Regression tests for the 2026-07-12 security + code audit fixes (batch 1).

All DB-free: DB-backed service functions are exercised against a fake async
session that captures the SQL statements they emit, which are then compiled
under the Postgres dialect and asserted on. This verifies the query *logic*
(the actual thing the bugs were about) without needing a live Postgres.
"""
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.dialects import postgresql


def _sql(stmt) -> str:
    """Compile a Core/ORM statement to a Postgres SQL string (lower-cased)."""
    return str(stmt.compile(dialect=postgresql.dialect())).lower()


# ------------------------------------------------------------------ M4: logo_url

def test_logo_url_accepts_http_and_data_image():
    from app.modules.admin.schemas import TenantCreate, TenantUpdate

    for good in ["https://x.com/a.png", "http://x.com/a.png", "data:image/png;base64,AAAA"]:
        assert TenantUpdate(logo_url=good).logo_url == good
    # None / empty are allowed (empty normalises to None)
    assert TenantUpdate(logo_url=None).logo_url is None
    assert TenantUpdate(logo_url="   ").logo_url is None
    # Same validator on the create path
    tc = TenantCreate(name="n", slug="s", admin_email="a@b.com", logo_url="https://x.com/a.png")
    assert tc.logo_url == "https://x.com/a.png"


def test_logo_url_rejects_script_bearing_uris():
    import pydantic
    from app.modules.admin.schemas import TenantUpdate

    for bad in ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:x"]:
        with pytest.raises(pydantic.ValidationError):
            TenantUpdate(logo_url=bad)


# --------------------------------------------------------- M1: whatsapp token leak

def test_tenant_out_hides_bearer_and_exposes_boolean():
    from app.modules.admin.schemas import TenantOut

    fields = set(TenantOut.model_fields)
    assert "whatsapp_access_token" not in fields, "Meta bearer token still exposed in TenantOut"
    assert "whatsapp_configured" in fields


def test_tenant_to_dict_reports_configured_without_leaking_token():
    from app.core.models import Tenant
    from app.modules.admin.service import _tenant_to_dict

    with_token = _tenant_to_dict(Tenant(whatsapp_access_token="EAAsecret"), user_count=1)
    without = _tenant_to_dict(Tenant(whatsapp_access_token=None), user_count=1)
    assert with_token["whatsapp_configured"] is True
    assert without["whatsapp_configured"] is False


# ------------------------------------------------------------ C1: dead code gone

def test_count_deadline_badges_removed():
    from app.modules.tickets import service

    assert not hasattr(service, "count_deadline_badges"), "dead function should be deleted"
    # The live replacement is still present and importable.
    assert hasattr(service, "deadline_severity")


# --------------------------------------------- C3: include_deleted filter logic

def _fake_session_capturing_execute():
    """Async session mock: scalar() -> 0, execute() records the statement and
    returns an empty scalars() result. Returns (session, captured_list)."""
    captured: list = []
    session = AsyncMock()
    session.scalar = AsyncMock(return_value=0)

    async def _execute(stmt, *a, **k):
        captured.append(stmt)
        result = MagicMock()
        result.scalars.return_value.all.return_value = []
        return result

    session.execute = AsyncMock(side_effect=_execute)
    return session, captured


async def test_list_contacts_excludes_deleted_by_default():
    from app.modules.contacts import service

    db, captured = _fake_session_capturing_execute()
    await service.list_contacts(db, uuid.uuid4(), include_deleted=False)
    # The row-fetch statement is the last one captured.
    assert "deleted_at is null" in _sql(captured[-1])


async def test_list_contacts_includes_deleted_without_search():
    from app.modules.contacts import service

    db, captured = _fake_session_capturing_execute()
    await service.list_contacts(db, uuid.uuid4(), include_deleted=True)
    sql = _sql(captured[-1])
    assert "deleted_at is null" not in sql, "include_deleted=True must not filter out deleted rows"
    # And it must not fire a second, separate query (old redundant branch removed).
    assert db.execute.await_count == 1


# ----------------------------------------- C5: bulk delete is one scoped UPDATE

async def test_bulk_soft_delete_is_single_tenant_scoped_update():
    from app.modules.tickets import service

    captured: list = []
    db = AsyncMock()

    async def _execute(stmt, *a, **k):
        captured.append(stmt)
        res = MagicMock()
        res.rowcount = 2
        return res

    db.execute = AsyncMock(side_effect=_execute)
    db.commit = AsyncMock()

    tenant_id = uuid.uuid4()
    n = await service.bulk_soft_delete_tickets(db, tenant_id, [uuid.uuid4(), uuid.uuid4()])

    assert n == 2
    # One UPDATE, one commit — not one per id.
    assert db.execute.await_count == 1
    assert db.commit.await_count == 1
    sql = _sql(captured[0])
    assert sql.startswith("update tickets")
    assert "tenant_id" in sql and "deleted_at" in sql


async def test_bulk_soft_delete_noop_on_empty():
    from app.modules.tickets import service

    db = AsyncMock()
    db.execute = AsyncMock()
    db.commit = AsyncMock()
    assert await service.bulk_soft_delete_tickets(db, uuid.uuid4(), []) == 0
    db.execute.assert_not_awaited()
    db.commit.assert_not_awaited()


# ------------------------------------------ C7: check_email_available one query

async def test_check_email_available_uses_single_query():
    from app.modules.admin import service

    db = AsyncMock()
    db.scalar = AsyncMock(return_value=None)  # no existing user
    available, reason = await service.check_email_available(db, "new@person.com")
    assert available is True and reason is None
    assert db.scalar.await_count == 1, "should hit the DB exactly once, not twice"


async def test_check_email_available_flags_active_user():
    from app.modules.admin import service

    active_user = MagicMock(is_active=True)
    db = AsyncMock()
    db.scalar = AsyncMock(return_value=active_user)
    available, reason = await service.check_email_available(db, "taken@person.com")
    assert available is False
    assert "already active" in reason
    assert db.scalar.await_count == 1


async def test_check_email_available_rejects_bad_address():
    from app.modules.admin import service

    db = AsyncMock()
    db.scalar = AsyncMock()
    available, reason = await service.check_email_available(db, "not-an-email")
    assert available is False and "valid" in reason.lower()
    db.scalar.assert_not_awaited()  # short-circuits before any query
