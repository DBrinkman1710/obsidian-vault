# Run — Yippie local dev

To start the Yippie app locally:

```bash
cd /Users/diederik/yippie/apps/app
docker compose up --build
```

After containers are up, run migrations:

```bash
docker compose exec backend alembic upgrade head
```

To seed a fresh DB (only needed after a full reset):

```bash
docker compose exec -e ADMIN_EMAIL=diederik@getyippie.com -e ADMIN_PASSWORD=pass backend python seed.py
```

## URLs

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API docs | http://localhost:8000/api/docs |

## Package manager

Always use `pnpm` inside the monorepo — never `npm`.

## Notes

- Both frontend (Vite) and backend (FastAPI/uvicorn) start inside Docker.
- The frontend hot-reloads; the backend restarts on file changes via watchfiles.
- If containers are already running, `docker compose up` (without `--build`) is faster.
