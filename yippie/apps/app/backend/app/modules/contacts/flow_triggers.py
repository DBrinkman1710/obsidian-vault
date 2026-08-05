"""[FLOW7] Contacts module trigger declarations for the flow registry.

Also home to `contact_fields` — the shared fresh-state loader ([FLOW4]) that most
triggers reuse: given an event carrying a contact_id it returns that contact's
CURRENT email/full_name/tags, plus its pipeline stage when the module is on. It's
imported by other modules' loaders (e.g. ticket_fields merges it in) so contact
conditions stay evaluable on any trigger that names a contact.

Model imports are deferred inside the loader — the registry imports this module
at process start and must stay light (no SQLAlchemy model graph at import time).
"""
from __future__ import annotations

import uuid


async def contact_fields(db, tenant, event) -> dict:
    """Current contact state for an event's contact_id (email/full_name/tags, and
    pipeline stage_id/stage_name when the pipeline module is enabled). Returns {}
    when the event has no contact_id or the contact is gone. Deferred model
    imports keep the registry import cheap."""
    if not event.get("contact_id"):
        return {}
    from sqlalchemy import select

    from app.modules.contacts.models import Contact

    fields: dict = {}
    contact_id = uuid.UUID(str(event["contact_id"]))
    contact = await db.get(Contact, contact_id)
    if contact is not None and contact.tenant_id == tenant.id and contact.deleted_at is None:
        fields.update({
            "email": contact.email,
            "full_name": contact.full_name,
            "tags": contact.tags or [],
        })
    if "pipeline" in (tenant.enabled_modules or []):
        from app.modules.pipeline.models import ContactPipelineEntry, PipelineStage

        row = (await db.execute(
            select(PipelineStage.id, PipelineStage.name)
            .join(ContactPipelineEntry, ContactPipelineEntry.stage_id == PipelineStage.id)
            .where(
                ContactPipelineEntry.contact_id == contact_id,
                ContactPipelineEntry.tenant_id == tenant.id,
            )
        )).first()
        if row is not None:
            fields.update({"stage_id": str(row.id), "stage_name": row.name})
    return fields


TRIGGERS: dict[str, dict] = {
    "contact_created": {
        "label": "Contact created",
        "module": "contacts",
        "fields": [
            {"key": "email", "label": "Email", "type": "text"},
            {"key": "full_name", "label": "Name", "type": "text"},
            {"key": "tags", "label": "Tags", "type": "text"},
        ],
        "fetch_fields": contact_fields,
        "example_payload": {"full_name": "", "email": "", "company_id": None, "tags": []},
    },
    "call_logged": {
        "label": "Call logged",
        "module": "contacts",
        "fields": [
            {"key": "outcome", "label": "Outcome", "type": "select",
             "options": ["interested", "not_interested", "callback", "voicemail", "no_answer"]},
            {"key": "duration_minutes", "label": "Duration (minutes)", "type": "number"},
        ],
        "fetch_fields": contact_fields,
        "example_payload": {"outcome": "", "duration_minutes": None, "contact_id": ""},
    },
}
