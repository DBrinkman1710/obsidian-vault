# Run — Yippie local dev

**Canonical working directory: `~/obsidian-vault/yippie/`** — the `~/yippie/` clone is stale, never use it.

## App platform (apps/app — FastAPI + React)

```bash
cd ~/obsidian-vault/yippie/apps/app
cp .env.example .env   # first time only — fill SECRET_KEY at minimum
docker compose up --build
docker compose exec backend alembic upgrade head
```

Seed a fresh DB (only after a full reset):

```bash
docker compose exec -e ADMIN_EMAIL=diederik@getyippie.com -e ADMIN_PASSWORD=pass backend python seed.py
```

| Service | URL |
|---|---|
| Frontend (Vite, hot reload) | http://localhost:5173 |
| API docs | http://localhost:8000/api/docs |

- If containers are already running, `docker compose up` (without `--build`) is faster.
- The backend restarts on file changes via watchfiles.

## Marketing site (apps/web — Next.js 14)

```bash
cd ~/obsidian-vault/yippie
pnpm dev:web            # dev server
pnpm build:web          # production build
# serve the production standalone build (binds PORT, default 8080):
HOSTNAME=127.0.0.1 PORT=8321 node apps/web/.next/standalone/apps/web/server.js
```

## Verification handles

- Playwright 1.61 is installed at the monorepo root — use it to drive either surface and capture screenshots.
- App frontend production bundle: `cd apps/app/frontend && pnpm run build` (runs `tsc -b && vite build`, same as Railway).
- UI drift barrier: `pnpm run check:ui` in apps/app/frontend (contract: apps/app/frontend/DESIGN.md).

## Package manager

Always `pnpm` inside the monorepo — never `npm`.
