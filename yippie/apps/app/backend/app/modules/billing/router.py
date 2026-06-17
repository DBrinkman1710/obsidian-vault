from __future__ import annotations

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


# NOTE: these static-path routes are declared before "/invoices/{invoice_id}"
# so FastAPI does not try to parse "export" / "bulk" as an invoice UUID.
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
    """Return a CSV template for bulk invoice import."""
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
    allowed = {
        "text/csv", "application/csv", "text/plain",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/octet-stream",
    }
    fname = (file.filename or "").lower()
    if not (fname.endswith(".csv") or fname.endswith(".xlsx")):
        raise HTTPException(status_code=400, detail="Only .csv and .xlsx files are supported")
    content = await file.read()
    return await service.import_invoices(db, current_user.tenant_id, content, file.filename or "upload.csv")


@router.delete("/invoices/bulk")
async def bulk_delete_invoices(body: BulkDeleteRequest, current_user: CurrentUser, db: DB):
    deleted = await service.bulk_delete_invoices(db, current_user.tenant_id, body.ids)
    return {"deleted": deleted}


@router.get("/invoices/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(invoice_id: uuid.UUID, current_user: CurrentUser, db: DB):
    invoice = await service.get_invoice(db, current_user.tenant_id, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.post("/invoices/{invoice_id}/payments", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
async def record_payment(invoice_id: uuid.UUID, body: PaymentCreate, current_user: CurrentUser, db: DB):
    invoice = await service.get_invoice(db, current_user.tenant_id, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    try:
        return await service.record_payment(db, current_user.tenant_id, invoice, body)
    except service.PaymentError as e:
        raise HTTPException(status_code=400, detail=str(e))
