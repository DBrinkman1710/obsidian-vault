# Yippie — Handoff Document
**Date:** 2026-06-03  
**Branch:** `claude/modular-account-management-design-XrQwj` (production/dev/commercial)  
**Sandbox branch:** `sandbox`  
**Repo:** github.com/DBrinkman1710/obsidian-vault

---

## What Yippie is

A multi-tenant SaaS customer service platform for SMB clients. One shared deployment at `app.getyippie.com` serves all clients, isolated by `tenant_id`. Diederik (superadmin) onboards clients via API — no new Railway environment needed per client.

**Stack:** FastAPI + SQLAlchemy 2 (async) + PostgreSQL 16 + Alembic | React 18 + Vite + nginx (served from same container) | Railway (hosting) | Cloudflare (DNS/proxy)

---

## Railway environments

| Environment | URL | Branch | Status (2026-06-03) | Purpose |
|---|---|---|---|---|
| production | app.getyippie.com | claude/modular-account-management-design-XrQwj | Deploying (multi-tenant commit) | Main client-facing app |
| Development | dev.getyippie.com | same | Deploying | Superadmin-only management |
| Commercial | getyippie.com (see note) | same | SUCCESS | Next.js marketing site |
| Sandbox | sandbox.getyippie.com | sandbox | FAILED (needs Railway setup) | Test before production |

**Commercial DNS note:** getyippie.com CNAME was recently changed in Cloudflare to the correct Railway target (`qikek5qn.up.railway.app`). But Railway routing is still returning 502 — the domain may need Cloudflare proxy temporarily turned OFF so Railway can verify the CNAME. See "Outstanding issues" below.

**Sandbox note:** The `sandbox` branch was created and pushed. A "Sandbox" Railway environment still needs to be created manually in the Railway dashboard (copy from production, connect to `sandbox` branch, add fresh Postgres, add `sandbox.getyippie.com` custom domain with DNS-only CNAME initially).

---

## Repo structure

```
obsidian-vault/                     ← git repo root
  yippie/                           ← Turborepo monorepo
    apps/app/                       ← THE main platform (THIS IS WHAT MATTERS)
      backend/                      ← FastAPI Python API
        app/
          auth/                     ← JWT auth, dependencies (require_admin, require_superadmin, require_module)
          core/                     ← models.py (User, Tenant, UserRole), schemas.py
          modules/                  ← contacts, tickets, billing, activity, inbox, chat, admin, departments
          config.py                 ← Settings (env vars), TenantConfig (from tenant.yaml, seed-time only)
          database.py               ← async SQLAlchemy session, set_tenant_context (RLS)
          main.py                   ← FastAPI app factory — all routers mounted, per-request module gating
        migrations/versions/        ← Alembic migrations
        seed.py                     ← Creates initial tenant + superadmin (run once after migrate)
        create_admin.py             ← Idempotent superadmin creation (run on every deploy via start cmd)
        promote_superadmin.py       ← One-time: upgrade existing admin → superadmin
      frontend/                     ← Vite/React app (served by nginx in same container)
        src/api/client.ts           ← API base URL = '/api/v1' (relative, goes through nginx)
        nginx.conf                  ← port 8080, /api → uvicorn:8000, /ws → uvicorn:8000, / → index.html
      config/tenant.yaml            ← SEED-TIME ONLY config (slug, name, modules, branding for initial tenant)
      Dockerfile.railway            ← Multi-stage: builds Vite frontend + runs backend + nginx
      railway.json                  ← start: alembic upgrade head && seed && uvicorn:8000 & nginx:8080
    apps/web/                       ← Next.js 14 marketing site (getyippie.com)
      railway.json                  ← Nixpacks, npm run build, node .next/standalone/server.js
```

---

## Architecture decisions made today

### Multi-tenant (MOST IMPORTANT)
One Railway deployment serves all clients. Key points:
- Every DB table has `tenant_id UUID NOT NULL` — all queries filter by it
- `set_tenant_context(db, user.tenant_id)` runs `SET LOCAL app.current_tenant_id` per-request (PostgreSQL RLS)
- **Module gating is per-request from DB:** `Tenant.enabled_modules` (ARRAY column) is read on each request, not from startup config. Different clients can have different modules.
- `GET /api/v1/tenant/config` is now dynamic — returns the logged-in user's tenant config from DB (was static before)
- `tenant.yaml` is now only used by `seed.py` to create the initial Yippie tenant on first deploy. Not used at runtime.

### Role hierarchy
```
superadmin  → Diederik only — all API access, admin panel
admin       → client company admins
agent       → support staff
viewer      → read-only
```
`require_admin` allows both admin and superadmin. `require_superadmin` is superadmin-only.

### Deployment: frontend + backend in one container
nginx (port 8080) serves Vite/React static files AND proxies `/api` and `/ws` to uvicorn (port 8000 internal). Railway routes all traffic to port 8080.

---

## Key API endpoints

### Authentication
- `POST /api/v1/auth/token` — login (email + password → JWT)
- `GET /api/v1/auth/me` — current user info

### Tenant config (per logged-in user, dynamic)
- `GET /api/v1/tenant/config` — returns tenant name, enabled modules, branding for current user's company

### Superadmin — client management
- `GET /api/v1/admin/tenants` — list all client companies
- `POST /api/v1/admin/tenants` — create new client (body: name, slug, admin_email, admin_password, enabled_modules)
- `PATCH /api/v1/admin/tenants/{id}` — update client settings (modules, branding)
- `GET /api/v1/admin/tenants/{id}/users` — list users for a client

### Modules (all require auth + module enabled for tenant)
- `/api/v1/contacts`, `/api/v1/tickets`, `/api/v1/inbox`, `/api/v1/activity`, `/api/v1/billing`, `/api/v1/chat`

Full API docs at: `https://app.getyippie.com/api/docs`

---

## Superadmin credentials

Set via Railway environment variables in each environment:
- `ADMIN_EMAIL` — your login email (default: `diederik1710@gmail.com`)
- `ADMIN_PASSWORD` — your login password (default: `password` — **change this**)

**Existing deployments (production + dev):** Your account was seeded as `admin` role. After the multi-tenant migration deploys, run `promote_superadmin.py` once to upgrade it:
```bash
railway run python promote_superadmin.py
```
(Must be linked to the right environment first via `railway link`)

**New deployments (sandbox):** `seed.py` creates the user as `superadmin` automatically using `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars.

---

## Migrations in order

```
bfadac4990f3  initial schema
ca081fe1f74d  add matched_contact_id + context fields
ca4c445f94a2  add departments table
f43013171b86  add context fields to draft_tickets
a1b2c3d4e5f6  add department_id to tickets
b2c3d4e5f6a7  add detected_language to draft_tickets
40bd1ebcda20  add follow_up_at to draft_tickets
e1f2a3b4c5d6  add superadmin role to userrole enum   ← NEW
f2e3d4c5b6a7  add enabled_modules, primary_color, logo_url to tenants  ← NEW
```

---

## Outstanding issues

### 1. getyippie.com (Commercial) — 502 routing
**Status:** Next.js app is running fine on Railway. DNS CNAME updated to correct target (`qikek5qn.up.railway.app`). But Railway's edge returns 502/fallback — it can't verify the new CNAME because Cloudflare proxy hides it.

**Fix:** In Cloudflare, temporarily toggle `getyippie.com` CNAME from Proxied → DNS only (grey cloud). Wait ~3 minutes. Toggle back to Proxied. Railway will verify and activate routing.

Also check Railway dashboard → Commercial → obsidian-vault → Custom Domains → getyippie.com — if it shows a NEW `_railway-verify` token, update the TXT record in Cloudflare too before toggling proxy.

### 2. Sandbox Railway environment — not set up
**Status:** `sandbox` git branch exists and is pushed. Railway environment "Sandbox" does NOT exist yet.

**Fix:** Railway dashboard → Yippie project → New Environment → "Sandbox" → copy from production → connect to `sandbox` branch → add Postgres → add `sandbox.getyippie.com` custom domain → set `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars.

### 3. Frontend not yet rebuilt for multi-tenant
The Vite/React frontend currently shows a static layout. It needs a UI for:
- Superadmin dashboard (list clients, create client, edit modules)
- The module sidebar already calls `/api/v1/tenant/config` to determine which nav items to show — this now works dynamically per tenant ✓
- But there's no admin panel UI yet

### 4. Password change on production
Default `ADMIN_PASSWORD` env var should be changed from `password` to something secure. Set in Railway dashboard → production → obsidian-vault → Variables.

### 5. promote_superadmin.py needs to be run
Production and dev databases have your account as `admin` role. After the new deploy lands, run:
```bash
railway run python promote_superadmin.py
```
per environment (link to each env first).

---

## How to continue tomorrow

### Verify multi-tenant deploy
```bash
railway status                    # check all environments green
curl https://app.getyippie.com/api/v1/tenant/config -H "Authorization: Bearer <token>"
# should return your tenant's config from DB (not static yaml)
```

### Onboard first test client
```bash
curl -X POST https://app.getyippie.com/api/v1/admin/tenants \
  -H "Authorization: Bearer <superadmin-token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Client","slug":"testclient","admin_email":"client@test.com","admin_password":"pass123","enabled_modules":["contacts","tickets"]}'
```
Then log in as `client@test.com` and verify data isolation.

### Next features to build
1. **Superadmin UI** — admin panel in the React frontend to manage clients visually
2. **getyippie.com fix** — turn off Cloudflare proxy temporarily to activate Railway routing
3. **Sandbox environment** — create in Railway dashboard
4. **Email notification on client creation** — send welcome email via Mailgun/Resend when `POST /api/v1/admin/tenants` is called
5. **Per-tenant custom domain** — optional: give big clients their own URL (e.g., `acme.getyippie.com`) pointing to the same Railway service

---

## Local dev

```bash
cd yippie/apps/app
cp .env.example .env          # fill in DATABASE_URL, SECRET_KEY, ANTHROPIC_API_KEY
docker compose up --build
docker compose exec backend alembic upgrade head
docker compose exec -e ADMIN_EMAIL=you@email.com -e ADMIN_PASSWORD=pass backend python seed.py
# Frontend: http://localhost:5173  API: http://localhost:8000/api/docs
```
