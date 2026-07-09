"""Phase 9C — public tracked-click endpoint for campaign buttons.

No auth: contacts click these links from their email client. Mounted in
main.py alongside the other public routers (prefix /api/v1).

Supported action types:
- 'label': apply label_id to the contact
- 'pipeline_stage': move contact to stage_id in the pipeline
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, set_tenant_context
from app.modules.contacts.models import contact_label_links
from app.modules.tracking.models import LabelClickToken

router = APIRouter(prefix="/track", tags=["tracking"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("/click/{token}")
async def track_click(token: uuid.UUID, db: DB):
    """Apply the configured action to the contact, burn the token, redirect to confirm page."""
    row = await db.get(LabelClickToken, token)
    if not row or row.used_at is not None:
        return RedirectResponse("/track/confirm?expired=1", status_code=302)

    row.used_at = datetime.now(timezone.utc)

    await set_tenant_context(db, str(row.tenant_id))

    if row.action_type == "pipeline_stage" and row.stage_id is not None:
        from app.modules.pipeline.service import _assign_stage
        try:
            await _assign_stage(db, row.tenant_id, row.contact_id, row.stage_id)
        except Exception:
            pass
    elif row.label_id is not None:
        await db.execute(
            pg_insert(contact_label_links)
            .values(contact_id=row.contact_id, label_id=row.label_id)
            .on_conflict_do_nothing()
        )

    # [FLOW7] campaign button click — tenant context already set above.
    from app.core.flow_events import emit_flow_event

    await emit_flow_event(
        db, row.tenant_id, "campaign_button_clicked",
        entity_type="campaign_button", entity_id=row.token,
        contact_id=row.contact_id,
        payload={
            "action_type": row.action_type,
            "button_id": row.button_id,
            "stage_id": row.stage_id,
            "label_id": row.label_id,
            "contact_id": row.contact_id,
        },
    )

    await db.commit()
    dest = row.redirect_url or "/track/confirm"
    # Reject redirects to external domains — only allow relative paths or same origin.
    if dest.startswith("http"):
        from app.config import get_settings as _get_settings
        base = _get_settings().app_base_url.rstrip("/")
        if not dest.startswith(base):
            dest = "/track/confirm"
    return RedirectResponse(dest, status_code=302)
