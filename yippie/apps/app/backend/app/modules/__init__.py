from fastapi import APIRouter

from app.modules.contacts.router import router as contacts_router
from app.modules.tickets.router import router as tickets_router
from app.modules.billing.router import router as billing_router
from app.modules.activity.router import router as activity_router
from app.modules.inbox.router import router as inbox_router
from app.modules.chat.router import router as chat_router
from app.modules.calendar.router import router as calendar_router
from app.modules.pipeline.router import router as pipeline_router
from app.modules.booking.router import router as booking_router
from app.modules.departments.router import router as departments_router
from app.modules.marketing.router import router as marketing_router
from app.modules.shipments.router import router as shipments_router
from app.modules.sales.router import router as sales_router
from app.modules.saas.router import router as saas_router
from app.modules.ai.router import router as ai_router

MODULES: dict[str, APIRouter] = {
    "contacts": contacts_router,
    "tickets": tickets_router,
    "billing": billing_router,
    "activity": activity_router,
    "inbox": inbox_router,
    "chat": chat_router,
    "calendar": calendar_router,
    "pipeline": pipeline_router,
    "booking": booking_router,
    "departments": departments_router,
    "marketing": marketing_router,
    "tracking": shipments_router,
    "sales": sales_router,
    "saas": saas_router,
    "ai": ai_router,
}
