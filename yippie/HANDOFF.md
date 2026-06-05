# Yippie — Handoff Document
**Date:** 2026-06-05
**Branch:** `claude/modular-account-management-design-XrQwj` (production/dev/commercial)
**Sandbox branch:** `sandbox`
**Repo:** github.com/DBrinkman1710/obsidian-vault

---

## What Yippie is

A multi-tenant SaaS customer service platform for SMB clients. One shared deployment at `app.getyippie.com` serves all clients, isolated by `tenant_id`. Diederik (superadmin) onboards clients via API — no new Railway environment needed per client.

**Stack:** FastAPI + SQLAlchemy 2 (async) + PostgreSQL 16 + Alembic | React 18 + Vite + nginx (served from same container) | Railway (hosting) | Cloudflare (DNS/proxy)

---

## Railway environments

| Environment | URL | Branch | Status (2026-06-05) | Purpose |
|---|---|---|---|---|
| production | app.getyippie.com | claude/modular-account-management-design-XrQwj | Live | Main client-facing app |
| Development | dev.getyippie.com | same | Live | Superadmin-only management |
| Commercial | getyippie.com + obsidian-vault-commercial.up.railway.app | same | Deployed — DNS pending | Next.js marketing site |
| Sandbox | sandbox.getyippie.com | sandbox | FAILED (needs Railway setup) | Test before production |

**Commercial DNS note:** getyippie.com CNAME points to the correct Railway target. Railway routing returns 502 because Cloudflare proxy hides the CNAME. Fix: in Cloudflare, temporarily toggle getyippie.com CNAME from Proxied → DNS only (grey cloud), wait 3 min, toggle back. Railway will verify and activate routing.

**Sandbox note:** `sandbox` git branch exists and is pushed. A "Sandbox" Railway environment still needs to be created manually in the Railway dashboard (copy from production, connect to `sandbox` branch, add fresh Postgres, add `sandbox.getyippie.com` custom domain).

---

## Commercial site (getyippie.com) — what was built this session

Full redesign of `apps/web` (Next.js 14 marketing site):

### Tech
- Tailwind CSS v3 (replaced CSS Modules) — `tailwind.config.ts` with `yippie: '#5BA4F5'`
- Inter font via `next/font/google`
- `lucide-react` for icons (no emoji anywhere)
- `tailwindcss`, `postcss`, `autoprefixer` in `dependencies` (not devDependencies) so Railway's `npm i` installs them

### Sections
Nav → Hero (browser mockup) → Logo bar → Stats → Features → How it works → Product Moment (dark inbox mockup) → Pricing (monthly/annual toggle) → CTA (solid bg-yippie) → Footer

### Sign-up flow
- "Sign up" button in nav opens a modal (Name, Email, Company, Phone)
- POST `/api/signup` → GitHub API → appends row to `yippie/client-pipeline.md` in this repo
- **Requires `GITHUB_TOKEN` env var in Railway Commercial** (GitHub PAT with `repo` scope)

### Files changed
```
apps/web/src/app/page.tsx          ← full redesign + SignUpModal component
apps/web/src/app/layout.tsx        ← Inter font
apps/web/src/app/globals.css       ← Tailwind directives
apps/web/tailwind.config.ts        ← new
apps/web/postcss.config.mjs        ← updated for Tailwind v3
apps/web/package.json              ← Tailwind/PostCSS moved to dependencies
apps/web/src/app/api/signup/route.ts ← new API route
apps/web/src/app/page.module.css   ← deleted
```

---

## Repo structure

```
obsidian-vault/                     ← git repo root
  yippie/                           ← Turborepo monorepo
    client-pipeline.md              ← auto-created on first signup (via /api/signup)
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

## Architecture decisions

### Multi-tenant (MOST IMPORTANT)
One Railway deployment serves all clients. Key points:
- Every DB table has `tenant_id UUID NOT NULL` — all queries filter by it
- `set_tenant_context(db, user.tenant_id)` runs `SET LOCAL app.current_tenant_id` per-request (PostgreSQL RLS)
- **Module gating is per-request from DB:** `Tenant.enabled_modules` (ARRAY column) is read on each request
- `GET /api/v1/tenant/config` is dynamic — returns the logged-in user's tenant config from DB

### Role hierarchy
```
superadmin  → Diederik only — all API access, admin panel
admin       → client company admins
agent       → support staff
viewer      → read-only
```

### Deployment: frontend + backend in one container
nginx (port 8080) serves Vite/React static files AND proxies `/api` and `/ws` to uvicorn (port 8000 internal).

---

## Key API endpoints

### Authentication
- `POST /api/v1/auth/token` — login (email + password → JWT)
- `GET /api/v1/auth/me` — current user info

### Tenant config
- `GET /api/v1/tenant/config` — returns tenant name, enabled modules, branding for current user's company

### Superadmin — client management
- `GET /api/v1/admin/tenants` — list all client companies
- `POST /api/v1/admin/tenants` — create new client
- `PATCH /api/v1/admin/tenants/{id}` — update client settings
- `GET /api/v1/admin/tenants/{id}/users` — list users for a client

Full API docs: `https://app.getyippie.com/api/docs`

---

## Superadmin credentials

Set via Railway environment variables:
- `ADMIN_EMAIL` — your login email (default: `diederik1710@gmail.com`)
- `ADMIN_PASSWORD` — your login password (**change this**)

---

## Outstanding issues

### 1. getyippie.com — 502 routing (DNS only)
The Next.js app builds and runs fine on Railway (`obsidian-vault-commercial.up.railway.app` works). The custom domain `getyippie.com` returns 502 because Cloudflare proxy prevents Railway from verifying the CNAME.

**Fix:** Cloudflare → DNS → getyippie.com CNAME → toggle orange cloud → grey → wait 3 min → toggle back. Also check Railway dashboard for a new `_railway-verify` TXT record and update it in Cloudflare if needed.

### 2. GITHUB_TOKEN missing in Railway Commercial
Sign-up form submissions will return a 500 error until this is set.

**Fix:** Go to [github.com/settings/tokens](https://github.com/settings/tokens) → generate classic token with `repo` scope → Railway → Yippie → Commercial → Variables → `GITHUB_TOKEN` = your token → redeploy.

### 3. Sandbox Railway environment — not set up
`sandbox` git branch exists. Railway environment "Sandbox" does NOT exist yet.

**Fix:** Railway dashboard → Yippie project → New Environment → "Sandbox" → copy from production → connect to `sandbox` branch → add Postgres → add `sandbox.getyippie.com` custom domain → set env vars.

### 4. Superadmin promotion on production
Production and dev databases have your account as `admin` role. Run once per environment:
```bash
railway run python promote_superadmin.py
```

### 5. Superadmin UI (future)
No admin panel UI yet for managing clients visually. Currently done via API.

---

## How to continue

### Verify commercial site
```
https://obsidian-vault-commercial.up.railway.app   ← should show new design now
https://getyippie.com                               ← needs Cloudflare DNS fix above
```

### Onboard first test client
```bash
curl -X POST https://app.getyippie.com/api/v1/admin/tenants \
  -H "Authorization: Bearer <superadmin-token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Client","slug":"testclient","admin_email":"client@test.com","admin_password":"pass123","enabled_modules":["contacts","tickets"]}'
```

### Next features to build
1. **Cloudflare DNS fix** — toggle proxy off/on to activate getyippie.com routing
2. **GITHUB_TOKEN in Railway** — so sign-ups write to client-pipeline.md
3. **Superadmin UI** — admin panel in the React frontend to manage clients visually
4. **Email notification on signup** — send welcome email when someone fills the sign-up form
5. **Sandbox environment** — create in Railway dashboard

---

## Local dev

```bash
cd yippie/apps/app
cp .env.example .env          # fill in DATABASE_URL, SECRET_KEY, ANTHROPIC_API_KEY
docker compose up --build
docker compose exec backend alembic upgrade head
docker compose exec -e ADMIN_EMAIL=you@email.com -e ADMIN_PASSWORD=pass backend python seed.py
# Frontend: http://localhost:5173  API: http://localhost:8000/api/docs

# Marketing site:
cd yippie/apps/web
pnpm dev   # http://localhost:3000
```
