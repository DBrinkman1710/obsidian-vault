# Yippie — Ops runbook (hands off operation)

How the platform runs itself, what alerts you when it breaks, and the few things that still need a human. Written so anyone with Railway access can operate Yippie — nothing below requires the founder specifically.

---

## 1. What runs automatically

Every deploy (`git push origin sandbox`, promotion via `git push origin sandbox:production`) runs, in order:

1. `run_migrations.py` — applies all Alembic migrations; aborts the deploy if a merge migration lists a stale parent (see `apps/app/CLAUDE.md` § Migration safety)
2. `seed.py` — idempotent bootstrap (root tenant, superadmin, default roles/templates)
3. `promote_superadmin.py` — promotes `ADMIN_EMAIL` to superadmin, never blocks startup
4. uvicorn + nginx, with all six background schedulers self starting (inbox polling, SLA escalation, marketing, SaaS health, Yip, contracts)

The Docker build runs `pytest -q` as a gate — broken wiring fails the build instead of crash looping in production. Railway restarts the service automatically on healthcheck failure (`GET /api/v1/health`).

Scheduler jobs take a Redis lock (`skip_if_locked`) so they never double run if the service is scaled to multiple instances. Without `REDIS_URL` this degrades to single instance safety only — set Redis before scaling beyond one instance.

## 2. Error alerting — who finds out when production breaks

Two layers, both platform wide. **Tenants never set up anything.**

| Layer | What it needs | What it does |
|---|---|---|
| Owner email alerts | Nothing (uses the existing Resend key) | In production, every ERROR level log record (unhandled 500s, scheduler job failures, webhook errors) emails `OWNER_NOTIFICATION_EMAIL`, capped at one email per error context per hour |
| Sentry | One `SENTRY_DSN` env var on the backend service | Full error capture with stack traces, grouping, history — across all tenants. Create one free project at sentry.io, copy the DSN into Railway, redeploy. Verify with `GET /api/v1/public/sentry-test` (returns 500 and must appear in Sentry) |

Recommended third layer: an external uptime monitor (UptimeRobot, Better Stack — free tiers are fine) pinging `https://app.getyippie.com/api/v1/health` every minute. This is the only thing that catches "the whole service is down" (when it's down it can't email you).

## 3. Backups

The database is Railway's managed Postgres. Backups are Railway's plugin backups — **verify in the Railway dashboard that scheduled backups are enabled for the Production Postgres**, and do one test restore to a scratch service so the procedure is known before it's needed.

Manual snapshot at any time:

```bash
railway run --service Postgres --environment Production pg_dump -Fc > yippie_prod_$(date +%F).dump
```

Restore: `pg_restore --clean --no-owner -d $DATABASE_URL yippie_prod_YYYY_MM_DD.dump`

## 4. Billing — when Stripe is not configured

Self serve signup **always succeeds**. If `STRIPE_SECRET_KEY` is unset (or Stripe errors), `payment_service.py` falls back to a manual invoice (`not_sent`) — the tenant lands fine, but someone must collect payment by hand. With live Stripe keys set, checkout, subscription state, dunning (`past_due`), and the in app upgrade page (`/settings/subscription`) are fully automatic.

## 5. Handover — nothing is hardcoded to a person

All personal identity is env configuration on the Railway backend services:

| Env var | Default | Used for |
|---|---|---|
| `OWNER_NOTIFICATION_EMAIL` | diederik1710@gmail.com | Error alerts + business lead notifications |
| `OWNER_NAME` | Diederik | Signature on platform emails (demo, signup, outreach) |
| `PLATFORM_FROM_EMAIL` | diederik@getyippie.com | From/reply to on platform emails; last resort send from |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | — | The superadmin account |

Handing the platform to someone else = change these four vars and add a second superadmin (Settings → Superadmins, or `POST /api/v1/admin/superadmins/invite`). Do that second superadmin invite **now** — a single superadmin account is a bus factor.

## 6. Still manual (by design or pending)

- **Promotion to production**: `git push origin sandbox:production` after verifying on sandbox. Before any push with migrations: `cd apps/app/backend && python3 -m alembic heads` must print exactly one line.
- **External dashboards**: DNS (Cloudflare), email domain verification (Resend DKIM/SPF/DMARC), WhatsApp instance pairing (Evolution API QR) — one time setup per domain/tenant, documented in `GOLIVE.md`.
- **Click to call** uses a personal helper daemon on the founder's machine (superadmin only feature; degrades to manual logging for everyone else).
- **Chrome extension** publishing is tied to the Google developer account that submitted it.
