# Project Inception Conversation — SMB Customer Service Platform

**Date:** 2026-06-01
**Session:** Initial design and scaffold

---

## What the user wants to build

A modular account management / customer service web application for small and medium-sized businesses. The owner uses it themselves to manage their own clients, and also sells/deploys it to other SMB clients with different module configurations.

**Core problem to solve:** Reduce time spent on customer service so companies need fewer people on support teams. This is the primary value proposition — not just record-keeping, but automation that replaces manual work.

---

## Key decisions made in this conversation

### Technology choices

| Decision | Choice | Reason given |
|---|---|---|
| Backend | FastAPI + Python | Already Python in repo; dependency injection maps to module toggling |
| Frontend | React + TypeScript + Vite | Lazy loading maps to module system; disabled modules load zero JS |
| Database | PostgreSQL 16 | RLS for tenant isolation; JSONB for flexible payloads |
| ORM | SQLAlchemy 2 async + Alembic | Async-native, matches FastAPI |
| Auth | JWT (custom, swappable to Supabase/Keycloak) | Fast start, same interface for both |
| Deploy | Docker Compose per client | Simple isolation, easy hand-off |
| AI | Claude Haiku | Inbox scanning: classify priority, generate draft ticket from raw email/WhatsApp |

### Module system design

All modules are always compiled in. Per-client config (tenant.yaml) controls which are active. The app factory registers routers only for enabled modules — disabled routes return 404 automatically. The frontend calls /api/v1/tenant/config on load and only registers routes for enabled modules.

### Omnichannel inbox design (most important decision)

**User requirement:** Customers should be able to email or WhatsApp the company, and those messages should appear in the platform.

**Key design choice: draft-before-ticket flow.** Inbound messages do NOT auto-create tickets. Instead:
1. Message arrives via webhook (Mailgun for email, Twilio for WhatsApp)
2. Claude Haiku scans it → suggests priority, category, subject, description
3. Stored as a draft_ticket
4. Agent reviews in Inbox UI — edits if needed — clicks Approve → becomes a real ticket

**Rationale:** Keeps agent in control (no spam creating noise), while eliminating the manual work of writing up tickets from raw emails.

### The platform is also the email client

Agents read and reply to customer emails entirely within the platform. No switching to Gmail/Outlook. Replies go back via the original channel (Mailgun email or Twilio WhatsApp).

### Live chat widget

Self-contained embeddable JS (`widget.js`). Clients paste one `<script>` tag on their website. WebSocket connection to backend. No external dependencies.

### Multi-tenancy approach

Shared PostgreSQL database with `tenant_id UUID NOT NULL` on every table. Each client deployment gets its own Docker Compose stack (own Postgres volume) for infrastructure-level isolation. PostgreSQL RLS policies planned but not yet implemented — currently enforced in application code only.

---

## What was built (scaffold)

### Backend files created

```
backend/app/main.py                          App factory, conditional module registration, lifespan
backend/app/config.py                        TenantConfig loader (tenant.yaml + env vars)
backend/app/database.py                      Async SQLAlchemy engine + set_tenant_context()
backend/app/core/models.py                   Tenant, User, UserRole
backend/app/core/schemas.py                  UserOut, TenantConfigOut
backend/app/core/tenant.py                   resolve_tenant_uuid(db) — slug → UUID, cached
backend/app/auth/dependencies.py             get_current_user, require_admin, CurrentUser type
backend/app/auth/router.py                   POST /auth/login, GET /auth/me
backend/app/modules/__init__.py              Module registry: name → router
backend/app/modules/contacts/               Full CRUD (models, schemas, service, router)
backend/app/modules/tickets/                Tickets + comments + canned templates + status endpoint
backend/app/modules/tickets/automation/     APScheduler: SLA escalation + auto-close stale tickets
backend/app/modules/billing/                Subscriptions, invoices (INV-0001...), payments
backend/app/modules/activity/               Event log, written to by all modules
backend/app/modules/inbox/                  Email/WhatsApp webhooks → AI scan → draft → review
backend/app/modules/chat/                   WebSocket live chat + connection manager
backend/migrations/env.py                   Alembic async setup, imports all models
backend/alembic.ini                         Alembic config
backend/seed.py                             Creates tenant + first admin user
backend/requirements.txt                    All Python dependencies
backend/Dockerfile
```

### Frontend files created

```
frontend/src/main.tsx                        React entry point
frontend/src/App.tsx                         Dynamic routes from tenant config, ModuleGate wrapper
frontend/src/api/client.ts                   Axios client with JWT injection + 401 redirect
frontend/src/api/tenant.ts                   fetchTenantConfig()
frontend/src/auth/useAuth.ts                 Zustand auth store (login, logout, token)
frontend/src/auth/LoginPage.tsx              Login form
frontend/src/shell/Sidebar.tsx               Renders only enabled module nav items
frontend/src/shell/ModuleGate.tsx            Redirects to / if module disabled
frontend/src/modules/contacts/pages/         ContactList.tsx, ContactDetail.tsx
frontend/src/modules/tickets/pages/          TicketList.tsx, TicketDetail.tsx
frontend/src/modules/inbox/pages/            InboxQueue.tsx (draft list), DraftReview.tsx
frontend/src/modules/billing/pages/          InvoiceList.tsx
frontend/src/modules/activity/pages/         ActivityFeed.tsx
frontend/public/widget.js                    Embeddable live chat widget (self-contained JS)
frontend/package.json, tsconfig.json, vite.config.ts, index.html, Dockerfile
```

### Config / deploy files

```
config/tenant.example.yaml                   Per-client config template
docker-compose.yml                           Dev: hot reload on both frontend and backend
smb-platform/CLAUDE.md                       Claude Code project context file
```

---

## What is NOT built yet (explicitly noted as next steps)

1. **New contact form** — `/contacts/new` route is linked in ContactList but the page doesn't exist
2. **New ticket form** — `/tickets/new` route is linked in TicketList but the page doesn't exist
3. **Canned response picker in UI** — the API exists (GET/POST `/tickets/templates`), the dropdown in TicketDetail is missing
4. **Customer self-service portal** — public `/portal/{tenant_slug}` where customers submit tickets and check status without logging in
5. **Outbound channel replies** — when agent responds to an email-sourced ticket, reply should go back via Mailgun; WhatsApp-sourced → Twilio reply
6. **Auto-routing rules** — assign tickets to agents based on keyword/tag rules; `routing_rules` table doesn't exist yet
7. **Analytics dashboard** — `GET /api/v1/analytics/summary` endpoint and frontend page not built
8. **PostgreSQL RLS policies** — tenant filtering is in application code only; DB-level RLS policies not added to migrations yet

---

## Bugs found and fixed during session

1. `chat/router.py` referenced `ChatSession.session_id_str` — column doesn't exist; fixed to query by `visitor_id`
2. `inbox/router.py` tried `uuid.UUID(tenant_cfg.tenant_id)` — fails because tenant_id in config is a slug string ("my-business"), not a UUID. Fixed by adding `core/tenant.py` with `resolve_tenant_uuid(db)` that looks up the UUID from the DB using the slug.
3. Chat router had hardcoded `uuid.uuid4()` for tenant_id instead of resolving the actual tenant — fixed with same `resolve_tenant_uuid()` helper.

---

## How to simulate the inbox without Mailgun/Twilio

```bash
curl -X POST http://localhost:8000/api/v1/inbox/webhooks/email \
  -F "sender=klant@example.nl" \
  -F "subject=Factuur klopt niet" \
  -F "body-plain=Goedemiddag, ik heb factuur INV-0001 ontvangen maar het bedrag klopt niet."
```

Open Inbox in the UI → draft appears with AI-suggested priority and description.

---

## Git

- Repo: `DBrinkman1710/obsidian-vault`
- Branch: `claude/modular-account-management-design-XrQwj`
- All code is in `smb-platform/` subdirectory
- Three commits: initial scaffold → bug fixes → CLAUDE.md
