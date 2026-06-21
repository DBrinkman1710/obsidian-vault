from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.contacts.models import Company, Contact, ContactLabel
from app.modules.contacts.schemas import (
    CompanyCreate,
    CompanyUpdate,
    ContactCreate,
    ContactLabelCreate,
    ContactLabelUpdate,
    ContactUpdate,
    ImportResult,
)


def _normalize_phone(raw: str | None) -> str | None:
    """Normalize a phone number to E.164 format (digits only, no leading +).

    Rules:
    - null/empty → returned as-is (no change)
    - Strip all non-digit characters (the leading '+' is only used for detection)
    - Dutch local format: starts with '0' and exactly 10 digits (e.g. 0612345678)
      → drop leading '0', prepend '31' → 31612345678
    - Already has country code (starts with '+' before stripping, or ≥ 11 digits
      without a leading '0') → just return the stripped digits
    - Reject (return raw unchanged) if fewer than 8 or more than 15 digits after stripping
    """
    if not raw:
        return raw
    s = raw.strip()
    if not s:
        return raw

    has_plus = s.startswith('+')

    # Strip everything except digits
    digits = ''.join(c for c in s if c.isdigit())

    if len(digits) < 8 or len(digits) > 15:
        # Out of valid range — return raw unchanged to avoid silent data loss
        return raw

    # Dutch local format: starts with '0', exactly 10 digits (e.g. 0612345678)
    if digits.startswith('0') and len(digits) == 10:
        return '31' + digits[1:]

    # Has explicit '+' or already long enough to carry a country code
    if has_plus or len(digits) >= 11:
        return digits

    # Short number without leading zero and no explicit country code — keep digits as-is
    return digits


async def list_contacts(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    label_id: Optional[uuid.UUID] = None,
    company_id: Optional[uuid.UUID] = None,
    include_deleted: bool = False,
) -> tuple[list[Contact], int]:
    q = select(Contact).where(Contact.tenant_id == tenant_id, Contact.deleted_at.is_(None))
    if search:
        term = f"%{search}%"
        q = q.where(
            Contact.full_name.ilike(term)
            | Contact.email.ilike(term)
            | Contact.company.ilike(term)
            | Contact.company_rel.has(Company.name.ilike(term))
        )
    if label_id:
        q = q.where(Contact.labels.any(ContactLabel.id == label_id))
    if company_id:
        q = q.where(Contact.company_id == company_id)
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(q.order_by(Contact.created_at.desc()).offset(skip).limit(limit))
    items = list(result.scalars().all())

    if include_deleted and search:
        term = f"%{search}%"
        dq = (
            select(Contact)
            .where(
                Contact.tenant_id == tenant_id,
                Contact.deleted_at.is_not(None),
                Contact.full_name.ilike(term)
                | Contact.email.ilike(term)
                | Contact.company.ilike(term)
                | Contact.company_rel.has(Company.name.ilike(term)),
            )
            .order_by(Contact.deleted_at.desc())
        )
        dresult = await db.execute(dq)
        items.extend(dresult.scalars().all())

    return items, total or 0


async def get_contact(db: AsyncSession, tenant_id: uuid.UUID, contact_id: uuid.UUID) -> Optional[Contact]:
    result = await db.execute(
        select(Contact).where(Contact.tenant_id == tenant_id, Contact.id == contact_id, Contact.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def _resolve_labels(
    db: AsyncSession, tenant_id: uuid.UUID, label_ids: list[uuid.UUID]
) -> list[ContactLabel]:
    # Tenant filter drops cross-tenant/unknown ids silently.
    if not label_ids:
        return []
    result = await db.execute(
        select(ContactLabel).where(
            ContactLabel.tenant_id == tenant_id, ContactLabel.id.in_(label_ids)
        )
    )
    return result.scalars().all()


async def _resolve_company_id(
    db: AsyncSession, tenant_id: uuid.UUID, company_id: Optional[uuid.UUID]
) -> Optional[uuid.UUID]:
    # Tenant filter drops cross-tenant/unknown ids silently (same as labels).
    if company_id is None:
        return None
    result = await db.execute(
        select(Company.id).where(Company.tenant_id == tenant_id, Company.id == company_id)
    )
    return result.scalar_one_or_none()


async def create_contact(
    db: AsyncSession, tenant_id: uuid.UUID, created_by: uuid.UUID, data: ContactCreate
) -> Contact:
    fields = data.model_dump(exclude={"label_ids", "company_id"})
    if "phone" in fields:
        fields["phone"] = _normalize_phone(fields["phone"])
    contact = Contact(
        tenant_id=tenant_id,
        created_by=created_by,
        **fields,
    )
    contact.company_id = await _resolve_company_id(db, tenant_id, data.company_id)
    if data.label_ids is not None:
        contact.labels = await _resolve_labels(db, tenant_id, data.label_ids)
    db.add(contact)
    # Flush first (INSERT sent to DB, transaction still open) so the re-fetch
    # runs within the same transaction where SET LOCAL tenant context is still
    # active.  Committing before re-fetching would revert SET LOCAL, making
    # the SELECT invisible to RLS.
    await db.flush()
    fetched = await get_contact(db, tenant_id, contact.id)
    await db.commit()
    return fetched


async def update_contact(
    db: AsyncSession, contact: Contact, data: ContactUpdate
) -> Contact:
    provided = data.model_dump(exclude_unset=True)
    fields = data.model_dump(exclude_unset=True, exclude={"label_ids", "company_id"})
    if "phone" in fields:
        fields["phone"] = _normalize_phone(fields["phone"])
    for field, value in fields.items():
        setattr(contact, field, value)
    if "company_id" in provided:
        contact.company_id = await _resolve_company_id(db, contact.tenant_id, data.company_id)
    if "label_ids" in provided:
        contact.labels = await _resolve_labels(db, contact.tenant_id, data.label_ids or [])
    await db.flush()
    fetched = await get_contact(db, contact.tenant_id, contact.id)
    await db.commit()
    return fetched


async def delete_contact(db: AsyncSession, contact: Contact) -> None:
    contact.deleted_at = datetime.now(timezone.utc)
    await db.commit()


async def restore_contact(db: AsyncSession, contact: Contact) -> None:
    contact.deleted_at = None
    await db.commit()


async def list_deleted_contacts(db: AsyncSession, tenant_id: uuid.UUID) -> list[Contact]:
    result = await db.execute(
        select(Contact)
        .where(Contact.tenant_id == tenant_id, Contact.deleted_at.is_not(None))
        .order_by(Contact.deleted_at.desc())
    )
    return result.scalars().all()


async def purge_old_deleted_contacts(db: AsyncSession) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    result = await db.execute(
        delete(Contact).where(Contact.deleted_at < cutoff)
    )
    await db.commit()
    return result.rowcount


# --- Contact labels (item 38) ---


async def list_labels(db: AsyncSession, tenant_id: uuid.UUID) -> list[ContactLabel]:
    result = await db.execute(
        select(ContactLabel)
        .where(ContactLabel.tenant_id == tenant_id)
        .order_by(ContactLabel.name)
    )
    return result.scalars().all()


async def get_label(db: AsyncSession, tenant_id: uuid.UUID, label_id: uuid.UUID) -> Optional[ContactLabel]:
    result = await db.execute(
        select(ContactLabel).where(
            ContactLabel.tenant_id == tenant_id, ContactLabel.id == label_id
        )
    )
    return result.scalar_one_or_none()


async def _label_name_taken(
    db: AsyncSession, tenant_id: uuid.UUID, name: str, exclude_id: Optional[uuid.UUID] = None
) -> bool:
    q = select(ContactLabel.id).where(
        ContactLabel.tenant_id == tenant_id,
        func.lower(ContactLabel.name) == name.lower(),
    )
    if exclude_id:
        q = q.where(ContactLabel.id != exclude_id)
    return (await db.execute(q.limit(1))).scalar_one_or_none() is not None


async def create_label(db: AsyncSession, tenant_id: uuid.UUID, body: ContactLabelCreate) -> ContactLabel:
    if await _label_name_taken(db, tenant_id, body.name):
        raise ValueError("A label with this name already exists")
    label = ContactLabel(tenant_id=tenant_id, name=body.name, color=body.color)
    db.add(label)
    await db.commit()
    await db.refresh(label)
    return label


async def update_label(db: AsyncSession, label: ContactLabel, body: ContactLabelUpdate) -> ContactLabel:
    fields = body.model_dump(exclude_unset=True)
    if "name" in fields and await _label_name_taken(db, label.tenant_id, fields["name"], exclude_id=label.id):
        raise ValueError("A label with this name already exists")
    for field, value in fields.items():
        setattr(label, field, value)
    await db.commit()
    await db.refresh(label)
    return label


async def delete_label(db: AsyncSession, label: ContactLabel) -> None:
    # contact_label_links rows are removed by ON DELETE CASCADE.
    await db.delete(label)
    await db.commit()


# --- Companies (item 36) ---


async def list_companies(db: AsyncSession, tenant_id: uuid.UUID) -> list[Company]:
    result = await db.execute(
        select(Company, func.count(Contact.id))
        .outerjoin(Contact, Contact.company_id == Company.id)
        .where(Company.tenant_id == tenant_id)
        .group_by(Company.id)
        .order_by(func.lower(Company.name))
    )
    companies: list[Company] = []
    for company, contact_count in result.all():
        company.contact_count = contact_count  # picked up by CompanyOut
        companies.append(company)
    return companies


async def get_company(db: AsyncSession, tenant_id: uuid.UUID, company_id: uuid.UUID) -> Optional[Company]:
    result = await db.execute(
        select(Company).where(Company.tenant_id == tenant_id, Company.id == company_id)
    )
    return result.scalar_one_or_none()


async def _company_contact_count(db: AsyncSession, company_id: uuid.UUID) -> int:
    return await db.scalar(
        select(func.count()).select_from(Contact).where(Contact.company_id == company_id)
    ) or 0


async def _company_name_taken(
    db: AsyncSession, tenant_id: uuid.UUID, name: str, exclude_id: Optional[uuid.UUID] = None
) -> bool:
    q = select(Company.id).where(
        Company.tenant_id == tenant_id,
        func.lower(Company.name) == name.lower(),
    )
    if exclude_id:
        q = q.where(Company.id != exclude_id)
    return (await db.execute(q.limit(1))).scalar_one_or_none() is not None


async def create_company(db: AsyncSession, tenant_id: uuid.UUID, body: CompanyCreate) -> Company:
    if await _company_name_taken(db, tenant_id, body.name):
        raise ValueError("A company with this name already exists")
    company = Company(tenant_id=tenant_id, name=body.name, domain=body.domain, notes=body.notes)
    db.add(company)
    await db.commit()
    await db.refresh(company)
    company.contact_count = 0
    return company


async def update_company(db: AsyncSession, company: Company, body: CompanyUpdate) -> Company:
    fields = body.model_dump(exclude_unset=True)
    if "name" in fields and await _company_name_taken(db, company.tenant_id, fields["name"], exclude_id=company.id):
        raise ValueError("A company with this name already exists")
    for field, value in fields.items():
        setattr(company, field, value)
    await db.commit()
    await db.refresh(company)
    company.contact_count = await _company_contact_count(db, company.id)
    return company


async def delete_company(db: AsyncSession, company: Company) -> None:
    # contacts.company_id is set to NULL by ON DELETE SET NULL.
    await db.delete(company)
    await db.commit()


async def list_company_contacts(
    db: AsyncSession, tenant_id: uuid.UUID, company_id: uuid.UUID
) -> list[Contact]:
    result = await db.execute(
        select(Contact)
        .where(Contact.tenant_id == tenant_id, Contact.company_id == company_id, Contact.deleted_at.is_(None))
        .order_by(Contact.full_name)
    )
    return result.scalars().all()


# --- Import / Export (items 29, 40, 20) ---

IMPORT_COLUMNS = ("full_name", "email", "phone", "company", "notes")


async def _company_id_by_name(
    db: AsyncSession, tenant_id: uuid.UUID, name: str, cache: dict[str, uuid.UUID]
) -> uuid.UUID:
    """Find-or-create a Company by (case-insensitive) name within the tenant.

    Uses an in-batch cache to avoid duplicate inserts for the same name.
    """
    key = name.lower()
    if key in cache:
        return cache[key]
    existing = await db.execute(
        select(Company.id).where(
            Company.tenant_id == tenant_id, func.lower(Company.name) == key
        )
    )
    cid = existing.scalar_one_or_none()
    if cid is None:
        company = Company(tenant_id=tenant_id, name=name)
        db.add(company)
        await db.flush()
        cid = company.id
    cache[key] = cid
    return cid


async def import_contacts(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    created_by: uuid.UUID,
    rows: list[dict],
) -> ImportResult:
    """Bulk-insert contacts from parsed rows.

    Validates each row (full_name required), dedupes by email against existing
    tenant contacts and within the batch itself (skip), and bulk-inserts the rest.
    """
    result = ImportResult()

    # Existing emails for this tenant (lowercased) so we can dedupe.
    existing = await db.execute(
        select(func.lower(Contact.email)).where(
            Contact.tenant_id == tenant_id, Contact.email.is_not(None)
        )
    )
    seen_emails: set[str] = {e for (e,) in existing.all() if e}
    company_cache: dict[str, uuid.UUID] = {}

    def _clean(val) -> Optional[str]:
        s = (str(val) if val is not None else "").strip()
        return s or None

    to_add: list[Contact] = []
    for i, row in enumerate(rows):
        line = i + 2  # account for header row in user-facing messages
        full_name = (str(row.get("full_name") or "")).strip()
        if not full_name:
            result.errors += 1
            if len(result.error_details) < 20:
                result.error_details.append(f"Row {line}: missing full_name")
            continue

        email = (str(row.get("email") or "")).strip() or None
        if email:
            key = email.lower()
            if key in seen_emails:
                result.skipped += 1
                continue
            seen_emails.add(key)

        company_name = _clean(row.get("company"))
        company_id = (
            await _company_id_by_name(db, tenant_id, company_name, company_cache)
            if company_name
            else None
        )

        to_add.append(
            Contact(
                tenant_id=tenant_id,
                created_by=created_by,
                full_name=full_name,
                email=email,
                phone=_normalize_phone(_clean(row.get("phone"))),
                company_id=company_id,
                notes=_clean(row.get("notes")),
            )
        )

    if to_add:
        db.add_all(to_add)
        await db.commit()
        result.imported = len(to_add)

    return result


async def export_contacts_csv(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    search: Optional[str] = None,
    contact_ids: Optional[list[uuid.UUID]] = None,
) -> str:
    """Return all matching contacts serialized as a CSV string."""
    q = select(Contact).where(Contact.tenant_id == tenant_id, Contact.deleted_at.is_(None))
    if contact_ids:
        q = q.where(Contact.id.in_(contact_ids))
    elif search:
        term = f"%{search}%"
        q = q.where(
            Contact.full_name.ilike(term)
            | Contact.email.ilike(term)
            | Contact.company.ilike(term)
            | Contact.company_rel.has(Company.name.ilike(term))
        )
    result = await db.execute(q.order_by(Contact.created_at.desc()))
    contacts = result.scalars().all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(IMPORT_COLUMNS)
    for c in contacts:
        writer.writerow(
            [c.full_name, c.email or "", c.phone or "", c.company_name or "", c.notes or ""]
        )
    return buf.getvalue()
