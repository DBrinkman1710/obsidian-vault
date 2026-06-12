"""Phase 9C — public tracked-click endpoint for campaign buttons.

No auth: contacts click these links from their email client. Mounted in
main.py alongside the other public routers (prefix /api/v1).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.modules.contacts.models import contact_label_links
from app.modules.tracking.models import LabelClickToken

router = APIRouter(prefix="/track", tags=["tracking"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("/click/{token}")
async def track_click(token: uuid.UUID, db: DB):
    """Apply the mapped label to the contact, burn the token, redirect to confirm page."""
    row = await db.get(LabelClickToken, token)
    if not row or row.used_at is not None:
        return RedirectResponse("/track/confirm?expired=1", status_code=302)

    row.used_at = datetime.now(timezone.utc)
    await db.execute(
        pg_insert(contact_label_links)
        .values(contact_id=row.contact_id, label_id=row.label_id)
        .on_conflict_do_nothing()
    )
    await db.commit()
    return RedirectResponse("/track/confirm", status_code=302)
