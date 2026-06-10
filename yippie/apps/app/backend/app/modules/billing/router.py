from __future__ import annotations

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser
from app.database import get_db
from app.modules.billing import service
from app.modules.billing.schemas import (
    InvoiceCreate,
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
