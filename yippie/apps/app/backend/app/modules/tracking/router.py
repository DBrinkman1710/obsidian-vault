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
from urllib.parse import urlparse

from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, set_tenant_context
from app.modules.contacts.models import contact_label_links
from app.modules.tracking.models import LabelClickToken

CONFIRM_PATH = "/track/confirm"


def safe_redirect_target(dest: str | None, base: str) -> str:
    """Return *dest* only when it is relative or same origin as *base*.

    redirect_url is tenant-controlled and this endpoint is unauthenticated, so an
    attacker-supplied absolute URL must never pass through. Two traps this guards:

    - A prefix comparison is not enough. "https://app.getyippie.com.evil.com"
      starts with "https://app.getyippie.com", so startswith() lets it through.
      Scheme and host are compared as a pair instead.
    - An empty base must fail closed. startswith("") is always True, so a missing
      APP_BASE_URL would otherwise allow every destination. Note effective_base_url
      also returns "" for an unrecognised ENVIRONMENT, so this is reachable.

    An open redirect here is not only a phishing primitive: it gets getyippie.com
    flagged by spam filters and Safe Browsing, which damages email deliverability.
    """
    if not dest:
        return CONFIRM_PATH
    dest = dest.strip()
    if not dest:
        return CONFIRM_PATH

    parsed = urlparse(dest)
    if not parsed.scheme and not parsed.netloc:
        # Relative. Reject "//host" and "/\\host", which browsers may read as
        # protocol-relative, and anything not anchored at root.
        if not dest.startswith("/") or dest[1:2] in ("/", "\\"):
            return CONFIRM_PATH
        return dest

    if not base:
        return CONFIRM_PATH
    base_parsed = urlparse(base)
    if not base_parsed.scheme or not base_parsed.netloc:
        return CONFIRM_PATH
    if (parsed.scheme, parsed.netloc) != (base_parsed.scheme, base_parsed.netloc):
        return CONFIRM_PATH
    return dest


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
    from app.config import get_settings as _get_settings

    dest = safe_redirect_target(row.redirect_url, _get_settings().effective_base_url)
    return RedirectResponse(dest, status_code=302)
