from fastapi import APIRouter

from app.modules.contacts.router import router as contacts_router
from app.modules.tickets.router import router as tickets_router
from app.modules.billing.router import router as billing_router
from app.modules.activity.router import router as activity_router
from app.modules.inbox.router import router as inbox_router
from app.modules.chat.router import router as chat_router
from app.modules.emailtracking.router import router as emailtracking_router
from app.modules.calendar.router import router as calendar_router
from app.modules.pipeline.router import router as pipeline_router
from app.modules.booking.router import router as booking_router
from app.modules.departments.router import router as departments_router

MODULES: dict[str, APIRouter] = {
    "contacts": contacts_router,
    "tickets": tickets_router,
    "billing": billing_router,
    "activity": activity_router,
    "inbox": inbox_router,
    "chat": chat_router,
    "emailtracking": emailtracking_router,
    "calendar": calendar_router,
    "pipeline": pipeline_router,
    "booking": booking_router,
    "departments": departments_router,
}
