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

### Branches (as of 2026-06-20)

| Branch | Purpose | What rebuilds |
|---|---|---|
| `sandbox` | **Everything** — app platform + marketing site | Railway Watch Paths route to correct services |
| `live` | Production (not created yet — wire before go-live) | Railway Production env |

- **Deploy everything:** `git push origin sandbox`
- `commercial` branch: deleted (merged into `sandbox`)
- `devsandbox` branch: deleted (merged into `sandbox`)

### Railway environments

```
sandbox branch push
  ├─ Watch: apps/app/**  → Railway "Sandbox" env → Sandbox DB → sandbox.getyippie.com
  └─ Watch: apps/web/**  → Railway "Commercial" env → getyippie.com
```

| URL | What | Who |
|---|---|---|
| `sandbox.getyippie.com` | Staging platform | Diederik + test clients |
| `app.getyippie.com` | **Production platform** | Real clients — superadmin access via email address |
| `getyippie.com` | Marketing site | Public |

**Key rules:**
- Sandbox DB ≠ Production DB — never cross them
- Tenant isolation via `tenant_id` + `set_tenant_context()` on every request
- Promotion flow: test on sandbox URLs → push `live` branch at go-live

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
- `ENVIRONMENT` — set to `sandbox` (staging) or `production`
- `EVOLUTION_API_URL` / `EVOLUTION_API_TOKEN` — WhatsApp gateway (Evolution API instance base URL + global API token); required for Live Chat's WhatsApp send/receive and the QR pairing card to work

**Critical:** the staging service must use the Sandbox DB `DATABASE_URL`. Never point it at the production DB.

## apps/web — Marketing site

Next.js 14, minimal content. Completely separate from the platform (own DB-less service, not part of the staging/production pairs).
- Runs as the **`Commercial website`** service in the **Commercial** Railway env, serving **getyippie.com**; deploys from the **`sandbox`** branch (`git push origin sandbox`). The `commercial` branch is retired as of 2026-06-20.
- Build/start (`apps/web/railway.json`, NIXPACKS): `node .next/standalone/server.js` with `HOSTNAME=0.0.0.0`.
- ⚠️ **The standalone server binds port 8080.** Railway's domain `targetPort` MUST be **8080** for every domain on this service (custom + auto `*.up.railway.app`), or the edge returns **502** even though the build shows SUCCESS (it's a routing failure, not a crash). This caused the 2026-06-15 getyippie.com outage.
- Do NOT add apps/web to the staging (Sandbox) or production platform services — it's its own service.

## Parallel dev — running two Claude Code instances simultaneously

Each instance must live in its own **git worktree** on its own branch so they never conflict.

### Setup (run once per secondary session)

```bash
# From ~/obsidian-vault/yippie/
./scripts/new-session.sh b "short-description"
# → Creates ~/yippie-b/ on branch session/b-YYYYMMDD-short-description
# → Open the second Claude Code in: ~/yippie-b/yippie/
```

### Rules

| Instance | Working directory | Branch |
|---|---|---|
| Primary (A) | `~/obsidian-vault/yippie/` | `sandbox` (as normal) |
| Secondary (B) | `~/yippie-b/yippie/` | `session/b-…` (never sandbox directly) |

- Secondary instance: **commit freely to its session branch** — never push to `sandbox` directly.
- Primary instance: **pushes to `origin sandbox`** as normal.
- Do **not** land a session while the other instance has uncommitted changes, to keep rebases clean.

### Landing the secondary session

When secondary is done:

```bash
# From ~/obsidian-vault/yippie/  (primary terminal)
./scripts/land-session.sh b
# → Rebases session/b-… onto latest sandbox
# → Merges --no-ff into sandbox and pushes
# → Removes ~/yippie-b/ worktree and branch
```

If there are rebase conflicts, resolve them inside `~/yippie-b/` then re-run `land-session.sh b`.

### Slot labels

Use any short label (`b`, `c`, `ui`, `api`, …). Labels only need to be unique at the same time.

## Monorepo commands

```bash
pnpm dev:web    # marketing site only
pnpm build:web  # build marketing site
```
