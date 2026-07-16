from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import undefer

from app.core.doc_blocks import (
    CONTRACT_MERGE_FIELDS,
    body_text_to_blocks,
    flatten_blocks_to_text,
    render_text_merge_fields,
    resolve_merge_fields_in_blocks,
    validate_blocks,
)
from app.modules.contacts.models import Company, Contact
from app.modules.contracts.models import Contract, ContractTemplate
from app.modules.contracts.schemas import (
    ContractCreate,
    ContractUpdate,
    RenewalsSummary,
    TemplateCreate,
    TemplateUpdate,
)

MAX_FILE_BYTES = 15 * 1024 * 1024  # 15 MB — a signed PDF is comfortably under this
EXPIRING_SOON_DAYS = 60  # Renewals view window: deadline within this many days


async def _attach_names(db: AsyncSession, tenant_id: uuid.UUID, contracts: list[Contract]) -> None:
    """Resolve company_id / contact_id to display names in one query each."""
    company_ids = {c.company_id for c in contracts if c.company_id}
    contact_ids = {c.contact_id for c in contracts if c.contact_id}

    companies: dict[uuid.UUID, str] = {}
    if company_ids:
        rows = await db.execute(
            select(Company.id, Company.name).where(
                Company.tenant_id == tenant_id, Company.id.in_(company_ids)
            )
        )
        companies = {cid: name for cid, name in rows.all()}

    contacts: dict[uuid.UUID, str] = {}
    if contact_ids:
        rows = await db.execute(
            select(Contact.id, Contact.full_name).where(
                Contact.tenant_id == tenant_id, Contact.id.in_(contact_ids)
            )
        )
        contacts = {cid: name for cid, name in rows.all()}

    for c in contracts:
        c.company_name = companies.get(c.company_id) if c.company_id else None
        c.contact_name = contacts.get(c.contact_id) if c.contact_id else None


async def list_contracts(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    company_id: Optional[uuid.UUID] = None,
    contact_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    direction: Optional[str] = None,
) -> list[Contract]:
    stmt = select(Contract).where(Contract.tenant_id == tenant_id)
    if company_id:
        stmt = stmt.where(Contract.company_id == company_id)
    if contact_id:
        stmt = stmt.where(Contract.contact_id == contact_id)
    if status:
        stmt = stmt.where(Contract.status == status)
    if direction:
        stmt = stmt.where(Contract.direction == direction)
    stmt = stmt.order_by(Contract.created_at.desc())

    result = await db.execute(stmt)
    contracts = list(result.scalars().all())
    await _attach_names(db, tenant_id, contracts)
    return contracts


async def get_contract(
    db: AsyncSession, tenant_id: uuid.UUID, contract_id: uuid.UUID
) -> Optional[Contract]:
    result = await db.execute(
        select(Contract).where(Contract.id == contract_id, Contract.tenant_id == tenant_id)
    )
    contract = result.scalar_one_or_none()
    if contract:
        await _attach_names(db, tenant_id, [contract])
    return contract


async def create_contract(
    db: AsyncSession, tenant_id: uuid.UUID, created_by: uuid.UUID, body: ContractCreate
) -> Contract:
    contract = Contract(
        tenant_id=tenant_id,
        created_by=created_by,
        owner_user_id=body.owner_user_id or created_by,
        title=body.title,
        contract_type=body.contract_type,
        status=body.status,
        direction=body.direction,
        company_id=body.company_id,
        contact_id=body.contact_id,
        counterparty_name=body.counterparty_name,
        tags=body.tags,
        notes=body.notes,
        start_date=body.start_date,
        end_date=body.end_date,
        notice_period_days=body.notice_period_days,
        auto_renew=body.auto_renew,
        renewal_term=body.renewal_term,
        value_amount=body.value_amount,
        value_interval=body.value_interval,
        currency=body.currency,
    )
    db.add(contract)
    await db.commit()
    await db.refresh(contract)
    await _attach_names(db, tenant_id, [contract])
    return contract


async def update_contract(
    db: AsyncSession, tenant_id: uuid.UUID, contract_id: uuid.UUID, body: ContractUpdate
) -> Optional[Contract]:
    contract = await get_contract(db, tenant_id, contract_id)
    if not contract:
        return None
    changes = body.model_dump(exclude_unset=True)
    # A new end_date starts a new cycle — re-arm the scheduler's one-shot nudges.
    if "end_date" in changes and changes["end_date"] != contract.end_date:
        contract.notice_reminder_sent_at = None
        contract.expiry_reminder_sent_at = None
    # A signed contract's text is frozen — it's what the counterparty signed.
    if contract.signed_at:
        changes.pop("body", None)
    for field, value in changes.items():
        setattr(contract, field, value)
    await db.commit()
    await db.refresh(contract)
    await _attach_names(db, tenant_id, [contract])
    return contract


async def delete_contract(db: AsyncSession, tenant_id: uuid.UUID, contract_id: uuid.UUID) -> bool:
    contract = await db.execute(
        select(Contract.id).where(Contract.id == contract_id, Contract.tenant_id == tenant_id)
    )
    if contract.scalar_one_or_none() is None:
        return False
    await db.execute(delete(Contract).where(Contract.id == contract_id, Contract.tenant_id == tenant_id))
    await db.commit()
    return True


async def bulk_delete(db: AsyncSession, tenant_id: uuid.UUID, ids: list[uuid.UUID]) -> int:
    if not ids:
        return 0
    result = await db.execute(
        delete(Contract).where(Contract.tenant_id == tenant_id, Contract.id.in_(ids))
    )
    await db.commit()
    return result.rowcount or 0


async def set_file(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    contract_id: uuid.UUID,
    *,
    data: bytes,
    file_name: str,
    file_type: str,
) -> Optional[Contract]:
    contract = await get_contract(db, tenant_id, contract_id)
    if not contract:
        return None
    contract.file_data = data
    contract.file_name = file_name
    contract.file_type = file_type
    contract.file_size = len(data)
    await db.commit()
    await db.refresh(contract)
    await _attach_names(db, tenant_id, [contract])
    return contract


async def clear_file(
    db: AsyncSession, tenant_id: uuid.UUID, contract_id: uuid.UUID
) -> Optional[Contract]:
    contract = await get_contract(db, tenant_id, contract_id)
    if not contract:
        return None
    contract.file_data = None
    contract.file_name = None
    contract.file_type = None
    contract.file_size = None
    await db.commit()
    await db.refresh(contract)
    await _attach_names(db, tenant_id, [contract])
    return contract


async def renewals_summary(db: AsyncSession, tenant_id: uuid.UUID) -> RenewalsSummary:
    """Rollup of active contract value + renewal counts.

    MRR sums active contracts at their monthly rate (yearly ÷ 12); ARR = MRR × 12.
    One-off values are reported separately — they are not recurring revenue.
    Mirrors the phase 3 Stripe shape: amount + interval + currency per contract.
    """
    result = await db.execute(select(Contract).where(Contract.tenant_id == tenant_id))
    contracts = list(result.scalars().all())
    today = date.today()
    soon = today + timedelta(days=EXPIRING_SOON_DAYS)

    mrr = 0.0
    one_off_total = 0.0
    active_count = expiring_soon_count = auto_renewing_count = expired_count = 0

    for c in contracts:
        if c.status == "expired":
            expired_count += 1
            continue
        if c.status != "active":
            continue
        active_count += 1
        if c.auto_renew:
            auto_renewing_count += 1
        deadline = c.notice_deadline or c.end_date
        if deadline and today <= deadline <= soon:
            expiring_soon_count += 1
        if c.value_amount is not None:
            amount = float(c.value_amount)
            if c.value_interval == "monthly":
                mrr += amount
            elif c.value_interval == "yearly":
                mrr += amount / 12
            elif c.value_interval == "one_off":
                one_off_total += amount

    return RenewalsSummary(
        mrr=round(mrr, 2),
        arr=round(mrr * 12, 2),
        one_off_total=round(one_off_total, 2),
        currency="EUR",
        active_count=active_count,
        expiring_soon_count=expiring_soon_count,
        auto_renewing_count=auto_renewing_count,
        expired_count=expired_count,
    )


async def get_file(
    db: AsyncSession, tenant_id: uuid.UUID, contract_id: uuid.UUID
) -> Optional[Contract]:
    """Fetch a contract with its file bytes undeferred, for download."""
    result = await db.execute(
        select(Contract)
        .options(undefer(Contract.file_data))
        .where(Contract.id == contract_id, Contract.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


# ── Templates + e-signing ([CONTRACT3] / [TMPL1]) ────────────────────────────

# Merge fields resolvable at generation time. Unknown fields render as "…" so a
# typo is visible in the preview instead of leaking the raw placeholder.
# The registry lives in app/core/doc_blocks.py since [TMPL1]; re-exported here
# so /contracts/templates/fields and existing imports keep working.
MERGE_FIELDS = CONTRACT_MERGE_FIELDS


def _ensure_blocks(template: ContractTemplate) -> ContractTemplate:
    """Runtime guard for templates that predate [TMPL1]: wrap a plain text
    body into the single text block shape so the builder can open it."""
    if not (template.blocks or {}).get("blocks") and template.body:
        template.blocks = body_text_to_blocks(template.body)
    return template


async def list_templates(db: AsyncSession, tenant_id: uuid.UUID) -> list[ContractTemplate]:
    result = await db.execute(
        select(ContractTemplate)
        .where(ContractTemplate.tenant_id == tenant_id)
        .order_by(ContractTemplate.created_at.desc())
    )
    return [_ensure_blocks(t) for t in result.scalars().all()]


async def get_template(
    db: AsyncSession, tenant_id: uuid.UUID, template_id: uuid.UUID
) -> Optional[ContractTemplate]:
    result = await db.execute(
        select(ContractTemplate).where(
            ContractTemplate.id == template_id, ContractTemplate.tenant_id == tenant_id
        )
    )
    template = result.scalar_one_or_none()
    return _ensure_blocks(template) if template else None


async def create_template(
    db: AsyncSession, tenant_id: uuid.UUID, created_by: uuid.UUID, body: TemplateCreate
) -> ContractTemplate:
    template = ContractTemplate(tenant_id=tenant_id, created_by=created_by, name=body.name, body=body.body)
    if body.blocks is not None:
        doc = validate_blocks(body.blocks, "contract")  # raises ValueError
        template.blocks = doc.model_dump()
        template.body = flatten_blocks_to_text(doc)
    elif body.body:
        template.blocks = body_text_to_blocks(body.body)
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


async def update_template(
    db: AsyncSession, tenant_id: uuid.UUID, template_id: uuid.UUID, body: TemplateUpdate
) -> Optional[ContractTemplate]:
    result = await db.execute(
        select(ContractTemplate).where(
            ContractTemplate.id == template_id, ContractTemplate.tenant_id == tenant_id
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        return None
    changes = body.model_dump(exclude_unset=True)
    blocks = changes.pop("blocks", None)
    if blocks is not None:
        doc = validate_blocks(blocks, "contract")  # raises ValueError
        template.blocks = doc.model_dump()
        # body follows the blocks — the builder is the single editing surface.
        changes["body"] = flatten_blocks_to_text(doc)
    elif "body" in changes:
        template.blocks = body_text_to_blocks(changes["body"] or "")
    for field, value in changes.items():
        setattr(template, field, value)
    await db.commit()
    await db.refresh(template)
    return template


async def delete_template(db: AsyncSession, tenant_id: uuid.UUID, template_id: uuid.UUID) -> bool:
    result = await db.execute(
        delete(ContractTemplate).where(
            ContractTemplate.id == template_id, ContractTemplate.tenant_id == tenant_id
        )
    )
    await db.commit()
    return bool(result.rowcount)


def _fmt_merge_date(d: date | None) -> str:
    return d.strftime("%d-%m-%Y") if d else "…"


def contract_merge_values(contract: Contract, tenant_name: str) -> dict[str, str]:
    """Merge field values for a contract. Names come pre-attached."""
    if contract.value_amount is not None:
        suffix = {"monthly": " per month", "yearly": " per year"}.get(contract.value_interval or "", "")
        value = f"{contract.currency} {float(contract.value_amount):,.2f}{suffix}"
    else:
        value = "…"
    return {
        "contract.title": contract.title,
        "contract.type": contract.contract_type or "…",
        "contract.start_date": _fmt_merge_date(contract.start_date),
        "contract.end_date": _fmt_merge_date(contract.end_date),
        "contract.notice_period_days": str(contract.notice_period_days) if contract.notice_period_days is not None else "…",
        "contract.value": value,
        "company.name": getattr(contract, "company_name", None) or contract.counterparty_name or "…",
        "contact.name": getattr(contract, "contact_name", None) or contract.counterparty_name or "…",
        "contact.email": getattr(contract, "contact_email", None) or "…",
        "tenant.name": tenant_name,
        "date.today": _fmt_merge_date(date.today()),
    }


def render_merge_fields(template_body: str, contract: Contract, tenant_name: str) -> str:
    """Replace {{merge.fields}} with contract data. Names come pre-attached."""
    return render_text_merge_fields(template_body, contract_merge_values(contract, tenant_name))


async def generate_body(
    db: AsyncSession, tenant_id: uuid.UUID, contract_id: uuid.UUID, template_id: uuid.UUID, tenant_name: str
) -> Optional[Contract]:
    """Render a template into the contract's frozen body + frozen blocks.

    Both the flattened text (body — sign page, legacy PDF) and the merge
    resolved block layout (rendered_blocks — block PDF renderer) are frozen
    here; later template edits never change a generated contract.
    """
    contract = await get_contract(db, tenant_id, contract_id)
    if not contract:
        return None
    template = await get_template(db, tenant_id, template_id)
    if not template:
        return None
    # Contact email for {{contact.email}} — attach alongside the names.
    contract.contact_email = None
    if contract.contact_id:
        row = await db.execute(
            select(Contact.email).where(Contact.id == contract.contact_id, Contact.tenant_id == tenant_id)
        )
        contract.contact_email = row.scalar_one_or_none()
    values = contract_merge_values(contract, tenant_name)
    doc = validate_blocks(template.blocks, "contract")
    resolved = resolve_merge_fields_in_blocks(doc, values)
    contract.rendered_blocks = resolved.model_dump()
    contract.body = flatten_blocks_to_text(resolved)
    contract.template_id = template.id
    await db.commit()
    await db.refresh(contract)
    await _attach_names(db, tenant_id, [contract])
    return contract


async def create_sign_link(
    db: AsyncSession, tenant_id: uuid.UUID, contract_id: uuid.UUID, expires_days: int
) -> Optional[Contract]:
    contract = await get_contract(db, tenant_id, contract_id)
    if not contract or not contract.body or contract.signed_at:
        return None
    contract.sign_token = uuid.uuid4()
    contract.sign_token_expires_at = datetime.now(timezone.utc) + timedelta(days=expires_days)
    if contract.status == "draft":
        contract.status = "sent"
    await db.commit()
    await db.refresh(contract)
    await _attach_names(db, tenant_id, [contract])
    return contract


async def get_for_pdf(
    db: AsyncSession, tenant_id: uuid.UUID, contract_id: uuid.UUID
) -> Optional[Contract]:
    """Fetch with the deferred signature image loaded, for PDF rendering."""
    result = await db.execute(
        select(Contract)
        .options(undefer(Contract.signature_image))
        .where(Contract.id == contract_id, Contract.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def get_by_sign_token(db: AsyncSession, token: uuid.UUID) -> Optional[Contract]:
    """Public lookup — runs before tenant context, mirroring booking tokens."""
    await db.execute(text("SET LOCAL row_security = off"))
    result = await db.execute(select(Contract).where(Contract.sign_token == token))
    contract = result.scalar_one_or_none()
    if not contract:
        return None
    expires = contract.sign_token_expires_at
    if expires and expires < datetime.now(timezone.utc):
        return None
    return contract


async def apply_signature(
    db: AsyncSession, contract: Contract, *, signer_name: str, signer_ip: str, signature_image: str | None
) -> Contract:
    contract.signed_at = datetime.now(timezone.utc)
    contract.signer_name = signer_name
    contract.signer_ip = signer_ip
    contract.signature_image = signature_image
    contract.status = "active"
    contract.sign_token = None  # single use
    contract.sign_token_expires_at = None
    # No refresh: it would SELECT under RLS with no tenant context (public path)
    # and find nothing; expire_on_commit=False keeps the instance state valid.
    await db.commit()
    return contract
