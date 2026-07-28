"""Regression test for the 2026-07-28 production incident: email ingestion
crashed with sqlalchemy.exc.MultipleResultsFound when a tenant had more than
one contact (or department) sharing the same email address — there is no
uniqueness constraint on either column, so this happens in practice (manual
entry, imports). _match_contact and the department auto-route lookup in
_create_draft must tolerate duplicates instead of crashing the poller.
"""
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock

from sqlalchemy.dialects import postgresql


def _sql(stmt) -> str:
    return str(stmt.compile(dialect=postgresql.dialect())).lower()


def _fake_session_capturing_execute(scalar_result=None):
    captured: list = []
    session = AsyncMock()

    async def _execute(stmt, *a, **k):
        captured.append(stmt)
        result = MagicMock()
        result.scalar_one_or_none.return_value = scalar_result
        return result

    session.execute = AsyncMock(side_effect=_execute)
    return session, captured


async def test_match_contact_query_is_limited_to_one_row():
    from app.modules.inbox.service import _match_contact

    db, captured = _fake_session_capturing_execute(scalar_result=None)
    await _match_contact(db, uuid.uuid4(), "duplicate@example.nl")

    sql = _sql(captured[-1])
    assert "limit" in sql, (
        "Contact.email has no DB uniqueness constraint — without LIMIT 1 this "
        "query raises MultipleResultsFound when a tenant has duplicate-email "
        "contacts (production incident 2026-07-28)."
    )


async def test_create_draft_department_lookup_is_limited_to_one_row():
    from app.modules.inbox import service
    from app.modules.inbox.models import InboundMessage, MessageSource

    db, captured = _fake_session_capturing_execute(scalar_result=None)
    msg = InboundMessage(
        id=uuid.uuid4(),
        tenant_id=uuid.uuid4(),
        source=MessageSource.email,
        sender="klant@example.nl",
        inbound_to="support@example.nl",
        raw_body="hallo",
    )
    await service._create_draft(db, msg.tenant_id, msg, ai_scan=False)

    dept_stmts = [s for s in captured if "departments" in _sql(s)]
    assert dept_stmts, "expected a department auto-route lookup"
    assert "limit" in _sql(dept_stmts[0]), (
        "Department.email has no DB uniqueness constraint either — same crash "
        "class as the contact lookup."
    )
