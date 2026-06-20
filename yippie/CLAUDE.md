# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **apps/app**: The full Yippie customer service platform — FastAPI (Python) backend + React/Vite frontend
- **apps/web**: Next.js 14 marketing site (`getyippie.com`) — completely separate, not part of the platform pair architecture
- **Package manager**: pnpm 9.15.4 — always use `pnpm`, never `npm` inside this repo
- **Email provider**: Resend (not Mailgun) for all outbound email

## Environment architecture — IMPORTANT

Two fully isolated data planes. **Sandbox DB ≠ Production DB. Never cross them.**

The four platform URLs still exist, but **as of 2026-06-15 the Railway layout changed**: the old separate "Dev Sandbox" Railway environment was deleted and staging was consolidated into a **single `Sandbox` Railway environment** (so the two staging services can talk over `.railway.internal` private networking and avoid cross-environment egress charges). The conceptual model is unchanged — same two URLs, same shared Sandbox DB; only the env/service/branch layout moved.

```
Staging  → ONE Railway env "Sandbox"          Production pair (live):
  devsandbox.getyippie.com ──┐ (service:        dev.getyippie.com ──┐
                              │  Dev Sandbox)                         │
                              ├─ Sandbox DB                           ├─ Production DB
  sandbox.getyippie.com ──────┘ (service:        app.getyippie.com ──┘
                                 Sandbox)
```

| URL | Railway env / service | Who uses it |
|---|---|---|
| dev.getyippie.com | Production / `Dev Sandbox` | Diederik (superadmin) — sees all client tenants, manages them, runs his own Yippie instance |
| app.getyippie.com | Production / `Sandbox` | Client companies — each sees only their own isolated tenant |
| devsandbox.getyippie.com | **Sandbox** / `Dev Sandbox` | Diederik (superadmin, staging) — same as dev but for testing |
| sandbox.getyippie.com | **Sandbox** / `Sandbox` | Test clients — staging version of app |

### Railway environments & deploy branches

| Railway env | Services | Deploys from branch |
|---|---|---|
| **Sandbox** (staging) | `Dev Sandbox` + `Sandbox` (both, one Sandbox DB) | `sandbox` |
| **Commercial** | `Commercial website` (= apps/web → getyippie.com) | `devsandbox` (was `commercial`, retired 2026-06-20) |
| **Production** (live) | `Dev Sandbox` + `Sandbox` | ⚠️ NOT wired — still on stale branch `claude/modular-account-management-design-XrQwj`; repoint to the live branch before go-live |

- **Deploy staging + marketing site:** `git push origin devsandbox` — rebuilds both Sandbox-env services AND the Commercial website (all on the same branch now).

**Key rules:**
- `dev` and `app` share one Production DB — clients Diederik creates in dev appear in app automatically
- `devsandbox` and `sandbox` share one Sandbox DB — completely separate from production
- Clients can only see their own data — tenant isolation via `tenant_id` + `set_tenant_context()` on every request
- The two staging services must share the same `DATABASE_URL` (same Sandbox DB)
- **Never point a staging service at the production DB**
- Promotion flow: build + test in staging (Sandbox env) → deploy code to dev↔app (live)

## apps/app — Yippie customer service platform

This is the main product. See `apps/app/CLAUDE.md` for the full reference.

### Local dev (Docker Compose)
```bash
cd apps/app
cp .env.example .env   # fill in SECRET_KEY, ANTHROPIC_API_KEY, etc.
docker compose up --build
docker compose exec backend alembic upgrade head
docker compose exec -e ADMIN_EMAIL=you@example.com -e ADMIN_PASSWORD=pass backend python seed.py
```
- Frontend: http://localhost:5173
- API docs: http://localhost:8000/api/docs

### Railway deployment
`apps/app/railway.json` uses `Dockerfile.railway`. Start command runs on every deploy:
1. `alembic upgrade heads` — applies all pending migrations
2. `python seed.py` — creates initial tenant + superadmin (idempotent)
3. `python promote_superadmin.py` — promotes ADMIN_EMAIL to superadmin (idempotent)
4. uvicorn + nginx

Set these env vars in Railway per environment:
- `DATABASE_URL` — Railway Postgres plugin injects this automatically
- `SECRET_KEY` — `openssl rand -base64 32`
- `ANTHROPIC_API_KEY` — for inbox AI scanning
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — superadmin credentials
- `TENANT_ID` / `TENANT_NAME` — first-tenant bootstrap (used once by `seed.py`); optional `ENABLED_MODULES` (comma-separated, defaults to all), `BRANDING_PRIMARY_COLOR`, `BRANDING_LOGO_URL`. After bootstrap, per-tenant config lives on the `Tenant` DB row, not env.
- `ENVIRONMENT` — set to `devsandbox`, `sandbox`, `dev`, or `production`
- `EVOLUTION_API_URL` / `EVOLUTION_API_TOKEN` — WhatsApp gateway (Evolution API instance base URL + global API token); required for Live Chat's WhatsApp send/receive and the QR pairing card to work

**Critical:** the two staging services (`Dev Sandbox` + `Sandbox`, both in the Sandbox Railway env) must share the same `DATABASE_URL` (the Sandbox DB). `ENVIRONMENT` is still set per service to `devsandbox`, `sandbox`, `dev`, or `production`.

## apps/web — Marketing site

Next.js 14, minimal content. Completely separate from the platform (own DB-less service, not part of the staging/production pairs).
- Runs as the **`Commercial website`** service in the **Commercial** Railway env, serving **getyippie.com**; deploys from the **`devsandbox`** branch (`git push origin devsandbox`). The `commercial` branch is retired as of 2026-06-20.
- Build/start (`apps/web/railway.json`, NIXPACKS): `node .next/standalone/server.js` with `HOSTNAME=0.0.0.0`.
- ⚠️ **The standalone server binds port 8080.** Railway's domain `targetPort` MUST be **8080** for every domain on this service (custom + auto `*.up.railway.app`), or the edge returns **502** even though the build shows SUCCESS (it's a routing failure, not a crash). This caused the 2026-06-15 getyippie.com outage.
- Do NOT add apps/web to the staging (Sandbox) or production platform services — it's its own service.

## Monorepo commands

```bash
pnpm dev:web    # marketing site only
pnpm build:web  # build marketing site
```
