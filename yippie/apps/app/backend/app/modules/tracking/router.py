"""Phase 9C — public tracked-click endpoint for campaign buttons.

No auth: contacts click these links from their email client. Mounted in
main.py alongside the other public routers (prefix /api/v1).

Supported action types:
- 'label': apply label_id to the contact
- 'pipeline_stage': move contact to stage_id in the pipeline

Scanner guard: corporate mail security gateways (SafeLinks, Mimecast,
Proofpoint, …) pre-fetch every URL in an email to scan it. A plain GET that
mutates would let those bots burn tokens, inflate click counts and — worst of
all — auto-move contacts through the pipeline. So GET is non-mutating: it only
renders a confirmation page. The action is applied on POST, which a human
triggers by clicking the button on that page and a link scanner does not.
"""
from __future__ import annotations

import html as _html
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, set_tenant_context
from app.modules.contacts.models import contact_label_links
from app.modules.tracking.models import LabelClickToken

router = APIRouter(prefix="/track", tags=["tracking"])

DB = Annotated[AsyncSession, Depends(get_db)]

_BRAND = "#5BB8E8"


def _page(title: str, body_html: str) -> str:
    return (
        "<!DOCTYPE html><html lang='nl'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width, initial-scale=1'>"
        f"<title>{_html.escape(title)}</title></head>"
        "<body style=\"margin:0;font-family:-apple-system,BlinkMacSystemFont,"
        "'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f3f4f6;\">"
        "<div style='max-width:480px;margin:80px auto;background:#fff;border-radius:12px;"
        "border:1px solid #e5e7eb;padding:40px 32px;text-align:center;'>"
        f"<div style='height:4px;background:{_BRAND};border-radius:2px;margin:-40px -32px 28px;'></div>"
        f"{body_html}"
        "</div></body></html>"
    )


def _confirm_page(confirm_url: str) -> str:
    # The action only happens when this form is POSTed — a human pressing the
    # button. Link scanners issue a GET and stop here, so they never trigger it.
    body = (
        "<h2 style='color:#1f2937;margin:0 0 10px;font-size:20px;'>Bevestig je keuze</h2>"
        "<p style='color:#6b7280;font-size:15px;line-height:1.5;margin:0 0 24px;'>"
        "Klik op de knop hieronder om je keuze te bevestigen.</p>"
        f"<form method='post' action='{_html.escape(confirm_url)}'>"
        "<button type='submit' style=\"display:inline-block;border:0;cursor:pointer;"
        f"background:{_BRAND};color:#fff;font-size:15px;font-weight:600;"
        "padding:12px 28px;border-radius:8px;\">Bevestigen</button>"
        "</form>"
    )
    return _page("Bevestig je keuze", body)


def _done_page(message: str) -> str:
    body = (
        "<h2 style='color:#1f2937;margin:0 0 10px;font-size:20px;'>Bedankt</h2>"
        f"<p style='color:#6b7280;font-size:15px;line-height:1.5;margin:0;'>{_html.escape(message)}</p>"
    )
    return _page("Bedankt", body)


def _safe_dest(row: LabelClickToken) -> str:
    """Relative path or same-origin URL only — never an attacker-controlled host."""
    dest = row.redirect_url or "/track/confirm"
    if dest.startswith("http"):
        from app.config import get_settings as _get_settings
        base = _get_settings().app_base_url.rstrip("/")
        if not dest.startswith(base):
            dest = "/track/confirm"
    return dest


@router.get("/click/{token}", response_class=HTMLResponse, include_in_schema=False)
async def track_click_landing(token: uuid.UUID, db: DB):
    """Non-mutating: render the confirmation page. No action is applied here so
    that automated link scanners (which only GET) can't trigger the action."""
    row = await db.get(LabelClickToken, token)
    if row is None:
        return HTMLResponse(_done_page("Deze link is ongeldig of verlopen."), status_code=200)
    if row.used_at is not None:
        return HTMLResponse(_done_page("Je keuze is al bevestigd."), status_code=200)
    return HTMLResponse(_confirm_page(f"/api/v1/track/click/{row.token}"), status_code=200)


@router.post("/click/{token}", include_in_schema=False)
async def track_click_confirm(token: uuid.UUID, db: DB, request: Request):
    """Apply the configured action to the contact, burn the token, redirect to
    the confirm page. Only reached when a human submits the confirmation form."""
    row = await db.get(LabelClickToken, token)
    if row is None:
        return RedirectResponse("/track/confirm?expired=1", status_code=302)
    if row.used_at is not None:
        # Idempotent — already confirmed. Send them on to the destination.
        return RedirectResponse(_safe_dest(row), status_code=302)

    row.used_at = datetime.now(timezone.utc)

    from app.core.client_meta import get_client_ip, is_bot_user_agent
    _ua = request.headers.get("user-agent")
    row.click_ip = get_client_ip(request)
    row.click_user_agent = (_ua or "")[:512] or None
    row.click_is_bot = is_bot_user_agent(_ua)

    await set_tenant_context(db, str(row.tenant_id))

    if row.action_type == "pipeline_stage":
        # Resolve the target stage at click time. The token bakes in the stage
        # mapped when the campaign was sent; if that was empty (stages mapped
        # later, or the button was re-id'd), fall back to the campaign's current
        # button_stage_config so a real click still moves the contact.
        stage_id = row.stage_id
        if stage_id is None and row.campaign_id is not None:
            from app.modules.marketing.models import Campaign
            campaign = await db.get(Campaign, row.campaign_id)
            cfg = (campaign.button_stage_config or {}) if campaign else {}
            raw_stage = cfg.get(row.button_id)
            if raw_stage:
                stage_id = uuid.UUID(str(raw_stage))
        if stage_id is not None:
            from app.modules.pipeline.service import _assign_stage
            try:
                # The recipient clicked their own button (and confirmed, past the
                # scanner guard) — treat it as their explicit choice so it moves
                # them even if they were hand-placed in another stage.
                await _assign_stage(
                    db, row.tenant_id, row.contact_id, stage_id, recipient_action=True
                )
            except Exception:
                pass
    elif row.label_id is not None:
        await db.execute(
            pg_insert(contact_label_links)
            .values(contact_id=row.contact_id, label_id=row.label_id)
            .on_conflict_do_nothing()
        )

    # Bridge the button click into the campaign recipient KPI — the Clicked
    # stat reads CampaignAnalytics.status, which the button-token path would
    # otherwise never advance (see mark_campaign_button_clicked).
    from app.modules.marketing import service as marketing_service
    try:
        await marketing_service.mark_campaign_button_clicked(
            db, row.tenant_id, row.campaign_id, row.contact_id
        )
    except Exception:
        pass

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
    return RedirectResponse(_safe_dest(row), status_code=302)
