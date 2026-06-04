# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **apps/app**: The full Yippie customer service platform — FastAPI (Python) backend + React/Vite frontend
- **apps/web**: Next.js 14 marketing site (`getyippie.com`) — completely separate, not part of the platform pair architecture
- **Package manager**: pnpm 9.15.4 — always use `pnpm`, never `npm` inside this repo
- **Email provider**: Resend (not Mailgun) for all outbound email

## Environment architecture — IMPORTANT

Environments come in **pairs** that share one Postgres DB:

```
Staging pair:                        Production pair:
  devsandbox.getyippie.com ──┐         dev.getyippie.com ──┐
                              ├─ DB                          ├─ DB
  sandbox.getyippie.com ──────┘         app.getyippie.com ──┘
```

| URL | Role |
|---|---|
| devsandbox.getyippie.com | Staging superadmin control plane |
| sandbox.getyippie.com | Staging client-facing app |
| dev.getyippie.com | Production superadmin control plane |
| app.getyippie.com | Production client-facing app |

**Key rules:**
- Superadmin logs into the **control plane** (devsandbox or dev) to create and manage client tenants
- Client tenants created by superadmin appear in the **client-facing app** (sandbox or app) because they share the same DB
- **devsandbox and sandbox must point to the same DATABASE_URL** in Railway — this is what makes the interaction work
- Promotion flow: build+test in devsandbox↔sandbox → when stable → deploy to dev↔app (live)
- Never change DATABASE_URL of sandbox without also updating devsandbox (they must stay in sync)

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
- `ENVIRONMENT` — set to `devsandbox`, `sandbox`, `dev`, or `production`

**Critical:** devsandbox and sandbox environments must share the same `DATABASE_URL`.

## apps/web — Marketing site

Next.js 14, minimal content. Completely separate from the platform.
- Only deployed from the production branch
- Do NOT configure Railway sandbox/devsandbox environments to build apps/web

## Monorepo commands

```bash
pnpm dev:web    # marketing site only
pnpm build:web  # build marketing site
```
