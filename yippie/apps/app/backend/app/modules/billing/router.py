from __future__ import annotations

import re
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser
from app.database import get_db
from app.modules.billing import service
from app.modules.billing.schemas import (
    BulkDeleteRequest,
    InvoiceCreate,
    InvoiceImportResult,
    InvoiceOut,
    InvoiceTemplateCreate,
    InvoiceTemplateOut,
    InvoiceTemplatePreviewRequest,
    InvoiceTemplateUpdate,
    InvoiceUpdate,
    PaymentCreate,
    PaymentOut,
    SubscriptionCreate,
    SubscriptionOut,
)

router = APIRouter(prefix="/billing", tags=["billing"])
DB = Annotated[AsyncSession, Depends(get_db)]


@router.post("/subscriptions", response_model=SubscriptionOut, status_code=status.HTTP_201_CREATED)
async def create_subscription(body: SubscriptionCreate, current_user: CurrentUser, db: DB):
    return await service.create_subscription(db, current_user.tenant_id, body)


@router.get("/subscriptions", response_model=list[SubscriptionOut])
async def list_subscriptions(current_user: CurrentUser, db: DB):
    return await service.list_subscriptions(db, current_user.tenant_id)


# ── Invoice templates ([TMPL1]) ───────────────────────────────────────────────
# Static template paths declared before "/templates/{template_id}" so FastAPI
# does not read "fields" / "preview" as UUIDs.


@router.get("/templates", response_model=list[InvoiceTemplateOut])
async def list_invoice_templates(current_user: CurrentUser, db: DB):
    return await service.list_invoice_templates(db, current_user.tenant_id)


@router.get("/templates/fields")
async def list_invoice_merge_fields():
    """Merge fields the template builder can insert."""
    from app.core.doc_blocks import INVOICE_MERGE_FIELDS

    return {"fields": list(INVOICE_MERGE_FIELDS)}


@router.post("/templates/preview")
async def preview_invoice_template(
    body: InvoiceTemplatePreviewRequest, current_user: CurrentUser, db: DB
):
    """Render unsaved blocks as a sample invoice PDF — the builder's preview."""
    from app.core.doc_blocks import (
        SAMPLE_LINE_ITEMS,
        resolve_merge_fields_in_blocks,
        sample_invoice_values,
        validate_blocks,
    )
    from app.core.doc_blocks_pdf import RenderContext, render_blocks_pdf
    from app.core.models import Tenant
    from datetime import date, timedelta

    try:
        doc = validate_blocks(body.blocks, "invoice")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    tenant = await db.get(Tenant, current_user.tenant_id)
    resolved = resolve_merge_fields_in_blocks(doc, sample_invoice_values(tenant))
    today = date.today()
    data = render_blocks_pdf(
        resolved,
        RenderContext(
            doc_type="invoice",
            tenant=tenant,
            tenant_name=(tenant.name if tenant else "") or "",
            primary_color=getattr(tenant, "primary_color", None),
            line_items=SAMPLE_LINE_ITEMS,
            meta_lines=[
                ("Factuurnummer", "INV-0042"),
                ("Factuurdatum", today.strftime("%d-%m-%Y")),
                ("Vervaldatum", (today + timedelta(days=14)).strftime("%d-%m-%Y")),
            ],
            notes=body.default_notes or "Gelieve het bedrag over te maken onder vermelding van het factuurnummer.",
        ),
    )
    return StreamingResponse(
        iter([data]),
        media_type="application/pdf",
        headers={"Content-Disposition": 'inline; filename="template_preview.pdf"'},
    )


@router.post("/templates", response_model=InvoiceTemplateOut, status_code=status.HTTP_201_CREATED)
async def create_invoice_template(body: InvoiceTemplateCreate, current_user: CurrentUser, db: DB):
    try:
        return await service.create_invoice_template(db, current_user.tenant_id, current_user.id, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/templates/{template_id}", response_model=InvoiceTemplateOut)
async def get_invoice_template(template_id: uuid.UUID, current_user: CurrentUser, db: DB):
    template = await service.get_invoice_template(db, current_user.tenant_id, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.patch("/templates/{template_id}", response_model=InvoiceTemplateOut)
async def update_invoice_template(
    template_id: uuid.UUID, body: InvoiceTemplateUpdate, current_user: CurrentUser, db: DB
):
    try:
        template = await service.update_invoice_template(db, current_user.tenant_id, template_id, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.delete("/templates/{template_id}")
async def delete_invoice_template(template_id: uuid.UUID, current_user: CurrentUser, db: DB):
    ok = await service.delete_invoice_template(db, current_user.tenant_id, template_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"deleted": True}


@router.post("/templates/{template_id}/default", response_model=InvoiceTemplateOut)
async def set_default_invoice_template(template_id: uuid.UUID, current_user: CurrentUser, db: DB):
    template = await service.set_default_invoice_template(db, current_user.tenant_id, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.get("/invoices", response_model=list[InvoiceOut])
async def list_invoices(
    current_user: CurrentUser,
    db: DB,
    contact_id: Optional[uuid.UUID] = Query(None),
):
    return await service.list_invoices(db, current_user.tenant_id, contact_id)


@router.post("/invoices", response_model=InvoiceOut, status_code=status.HTTP_201_CREATED)
async def create_invoice(body: InvoiceCreate, current_user: CurrentUser, db: DB):
    return await service.create_invoice(db, current_user.tenant_id, body)


# NOTE: static-path routes declared before "/invoices/{invoice_id}" so FastAPI
# does not interpret "export" / "bulk" / "import" as a UUID.

@router.get("/invoices/export")
async def export_invoices(
    current_user: CurrentUser,
    db: DB,
    ids: Optional[str] = Query(None, description="Comma-separated invoice IDs; empty = all"),
    format: str = Query("csv", pattern="^(csv|xlsx)$"),
):
    invoice_ids: Optional[list[uuid.UUID]] = None
    if ids:
        try:
            invoice_ids = [uuid.UUID(x) for x in ids.split(",") if x.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid invoice id in 'ids'")
    content, media_type, filename = await service.export_invoices(
        db, current_user.tenant_id, invoice_ids, format
    )
    return StreamingResponse(
        iter([content]),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/invoices/import-template")
async def invoice_import_template(current_user: CurrentUser):
    import csv as _csv
    import io as _io
    buf = _io.StringIO()
    writer = _csv.writer(buf)
    writer.writerow(service.IMPORT_TEMPLATE_HEADER)
    writer.writerow(service.IMPORT_TEMPLATE_EXAMPLE)
    return StreamingResponse(
        iter([buf.getvalue().encode("utf-8-sig")]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="invoice_import_template.csv"'},
    )


@router.post("/invoices/import", response_model=InvoiceImportResult)
async def import_invoices(
    current_user: CurrentUser,
    db: DB,
    file: UploadFile = File(...),
):
    fname = (file.filename or "").lower()
    if not (fname.endswith(".csv") or fname.endswith(".xlsx")):
        raise HTTPException(status_code=400, detail="Only .csv and .xlsx files are supported")
    content = await file.read()
    return await service.import_invoices(db, current_user.tenant_id, content, file.filename or "upload.csv")


@router.delete("/invoices/bulk")
async def bulk_delete_invoices(body: BulkDeleteRequest, current_user: CurrentUser, db: DB):
    try:
        deleted = await service.bulk_delete_invoices(db, current_user.tenant_id, body.ids)
    except service.InvoiceLockedError as e:
        # 409: the request is well formed, the invoices' legal state forbids it.
        raise HTTPException(status_code=409, detail=str(e))
    return {"deleted": deleted}


@router.get("/invoices/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(invoice_id: uuid.UUID, current_user: CurrentUser, db: DB):
    invoice = await service.get_invoice(db, current_user.tenant_id, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.patch("/invoices/{invoice_id}", response_model=InvoiceOut)
async def update_invoice(invoice_id: uuid.UUID, body: InvoiceUpdate, current_user: CurrentUser, db: DB):
    try:
        invoice = await service.update_invoice(db, current_user.tenant_id, invoice_id, body)
    except service.InvoiceLockedError as e:
        raise HTTPException(status_code=409, detail=str(e))
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.post("/invoices/{invoice_id}/issue", response_model=InvoiceOut)
async def issue_invoice(invoice_id: uuid.UUID, current_user: CurrentUser, db: DB):
    """Finalise a draft without emailing it — for invoices handed over on paper
    or sent through another channel. Claims the number and locks the document."""
    try:
        return await service.issue_invoice(db, current_user.tenant_id, invoice_id)
    except service.InvoiceComplianceError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except service.InvoiceSendError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/invoices/{invoice_id}/credit", response_model=InvoiceOut, status_code=status.HTTP_201_CREATED)
async def credit_invoice(invoice_id: uuid.UUID, current_user: CurrentUser, db: DB):
    """Reverse an issued invoice with a credit note — the lawful correction path
    now that issued invoices can no longer be edited or deleted."""
    try:
        return await service.create_credit_note(db, current_user.tenant_id, invoice_id)
    except service.InvoiceComplianceError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except service.InvoiceSendError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/invoices/{invoice_id}/pdf")
async def download_invoice_pdf(invoice_id: uuid.UUID, current_user: CurrentUser, db: DB):
    invoice = await service.get_invoice(db, current_user.tenant_id, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    try:
        pdf_bytes = await service.generate_pdf_bytes(db, current_user.tenant_id, invoice)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}")
    safe_num = re.sub(r'[^\w\-.]', '_', invoice.invoice_number)[:50]
    filename = f"factuur-{safe_num}.pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/invoices/{invoice_id}/send")
async def send_invoice(invoice_id: uuid.UUID, current_user: CurrentUser, db: DB):
    try:
        email = await service.send_invoice(db, current_user.tenant_id, invoice_id)
    except service.InvoiceComplianceError as e:
        # 422: nothing was sent — the invoice is missing legally required fields.
        raise HTTPException(status_code=422, detail=str(e))
    except service.InvoiceSendError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"sent": True, "email": email}


@router.post("/invoices/{invoice_id}/remind")
async def send_payment_reminder(invoice_id: uuid.UUID, current_user: CurrentUser, db: DB):
    try:
        email = await service.send_payment_reminder(db, current_user.tenant_id, invoice_id)
    except service.InvoiceSendError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"sent": True, "email": email}


@router.post("/invoices/{invoice_id}/payments", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
async def record_payment(invoice_id: uuid.UUID, body: PaymentCreate, current_user: CurrentUser, db: DB):
    invoice = await service.get_invoice(db, current_user.tenant_id, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    try:
        return await service.record_payment(db, current_user.tenant_id, invoice, body)
    except service.PaymentError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/invoices/{invoice_id}/payments", response_model=list[PaymentOut])
async def list_payments(invoice_id: uuid.UUID, current_user: CurrentUser, db: DB):
    invoice = await service.get_invoice(db, current_user.tenant_id, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return await service.list_payments(db, current_user.tenant_id, invoice_id)
