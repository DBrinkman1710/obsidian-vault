# SMB Customer Service Platform

Modular, automation-first customer service tool for small/medium businesses. Goal: reduce support headcount by automating ticket creation, routing, and follow-up.

## Running locally

```bash
docker compose up --build          # start everything (first run: ~5 min)
docker compose exec backend alembic upgrade head   # run once after fresh start
docker compose exec -e ADMIN_EMAIL=you@example.com -e ADMIN_PASSWORD=pass backend python seed.py
```

- Frontend: http://localhost:5173
- API docs: http://localhost:8000/api/docs
- Stop: `docker compose down` (keeps data) or `docker compose down -v` (wipes DB)

## Stack

- **Backend**: FastAPI + SQLAlchemy 2 (async) + PostgreSQL 16 + Alembic
- **Frontend**: React 18 + TypeScript + Vite + React Query + Zustand
- **AI**: Claude Haiku via Anthropic SDK (inbox scanning)
- **Deploy**: Docker Compose per client

## Architecture — the key ideas

### Module system
All modules (see `ALL_MODULES` in `backend/app/config.py` / the `MODULES` registry) are always compiled in. Which ones are active is stored **per tenant** in the `Tenant.enabled_modules` DB column. The app factory in `backend/app/main.py` mounts every module router and gates each per-request with `require_module(name)` (403 when the tenant doesn't have it). The frontend calls `GET /api/v1/tenant/config` on load — which reads the live `Tenant` row — and only registers routes for that tenant's enabled modules, so disabled ones never load any JS. A new tenant's initial module set is seeded once by `backend/seed.py` (from `ENABLED_MODULES` env, defaulting to all modules).

### Tenant isolation
Every DB table has `tenant_id UUID NOT NULL`. Every query filters by it. The `get_current_user` dependency in `backend/app/auth/dependencies.py` resolves the user from the JWT and calls `set_tenant_context(db, user.tenant_id)` which runs `SET LOCAL app.current_tenant_id = :id` — enabling PostgreSQL RLS policies.

### Inbox flow (the headcount-reduction core)
Email (Mailgun webhook) or WhatsApp (Twilio webhook) → stored as `inbound_message` → Claude Haiku scans it and suggests subject/priority/description → stored as `draft_ticket` → agent reviews in the Inbox UI → approves or edits → becomes a real ticket. Agents never manually write up tickets from raw emails.

## Key files

| File | Purpose |
|---|---|
| `backend/app/main.py` | App factory — module routing decisions live here |
| `backend/app/config.py` | `Settings` (infra: DB/Resend/Evolution/env) + `ALL_MODULES` (canonical module list). Per-tenant config lives on the `Tenant` DB model, not here. |
| `backend/app/modules/__init__.py` | Module registry: name → FastAPI router |
| `backend/app/database.py` | Async SQLAlchemy session + `set_tenant_context()` |
| `backend/app/core/tenant.py` | `resolve_tenant_uuid(db)` — maps config slug to DB UUID, cached |
| `backend/app/modules/tickets/automation/sla_escalation.py` | APScheduler: escalates overdue tickets every 5 min, auto-closes stale ones hourly |
| `backend/app/modules/inbox/ai_scanner.py` | Claude Haiku call — takes raw message body, returns structured draft fields |
| `backend/app/modules/inbox/service.py` | Ingestion pipeline: inbound → scan → draft |
| `backend/app/modules/chat/manager.py` | WebSocket connection manager (tenant → session → set of sockets) |
| `backend/seed.py` | Creates tenant + first admin user. Run once after migrations. |
| `frontend/src/App.tsx` | Dynamic route registration from tenant config API |
| `frontend/src/shell/ModuleGate.tsx` | Redirects to / if module is disabled for this tenant |
| `frontend/public/widget.js` | Self-contained embeddable live chat widget (one `<script>` tag) |

## Module structure (backend)

Each module follows the same pattern:
```
modules/{name}/
  models.py    — SQLAlchemy ORM models (all have tenant_id)
  schemas.py   — Pydantic request/response models
  service.py   — DB operations (no HTTP concerns)
  router.py    — FastAPI endpoints (calls service, handles 404s)
```

## Environment variables

```bash
# smb-platform/.env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/smb_platform
SECRET_KEY=change-me-in-production
ANTHROPIC_API_KEY=sk-ant-...      # required for inbox AI scanning
ENVIRONMENT=development
```

## Common tasks

**Add a new contact via API:**
```bash
curl -X POST http://localhost:8000/api/v1/contacts \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"full_name": "Jan de Vries", "email": "jan@example.nl", "company": "Acme BV"}'
```

**Simulate an inbound email (no Mailgun needed):**
```bash
curl -X POST http://localhost:8000/api/v1/inbox/webhooks/email \
  -F "sender=klant@example.nl" \
  -F "subject=Factuur klopt niet" \
  -F "body-plain=Goedemiddag, ik heb factuur INV-0001 ontvangen maar het bedrag klopt niet."
```
Then open Inbox in the UI to review the AI-generated draft.

**Disable a module for this tenant (e.g. billing):**
Remove `billing` from the tenant's `enabled_modules` array (superadmin edit modal, or directly on the `Tenant` row). No restart needed — gating is per-request.
`GET /api/v1/billing/invoices` now returns 403. Billing nav item disappears from sidebar.

**Generate a new Alembic migration after changing a model:**
```bash
docker compose exec backend alembic revision --autogenerate -m "describe the change"
docker compose exec backend alembic upgrade head
```

**Run backend tests:**
```bash
docker compose exec backend pytest
```

## What's not built yet (next steps)

- Auto-routing rules (assign tickets based on keywords/contact tags)
- Canned response picker in the TicketDetail UI (templates API exists, UI dropdown missing)
- Customer self-service portal (`/portal/{tenant_slug}` — public ticket submission)
- Outbound email/WhatsApp replies when agent responds to inbox-sourced tickets
- Analytics dashboard (`GET /api/v1/analytics/summary`)
- PostgreSQL RLS policies (migrations scaffolded, policies not yet added)

## Per-client deployment checklist

1. Create `.env` with real `SECRET_KEY` and `ANTHROPIC_API_KEY`, plus the bootstrap vars used by `seed.py`: `TENANT_ID`, `TENANT_NAME`, optionally `ENABLED_MODULES` (comma-separated; defaults to all), `BRANDING_PRIMARY_COLOR`, `BRANDING_LOGO_URL`
2. `docker compose -f docker-compose.yml up -d`
3. `docker compose exec backend alembic upgrade head`
4. `docker compose exec -e ADMIN_EMAIL=... -e ADMIN_PASSWORD=... backend python seed.py`
5. Hand client the URL and credentials — branding/modules are then editable in-app and stored on the `Tenant` row
