# Yippie — Go-Live Checklist
**Target date:** 2026-06-28
**Last updated:** 2026-06-17

Work through every section top to bottom. Check off each item as done. Do NOT skip sections.

---

## 0. Prerequisites (do these first)

- [ ] Production branch is pointed at the correct live code — **Production Railway env is currently wired to stale branch `claude/modular-account-management-design-XrQwj`**. Repoint both Production services (`Dev Sandbox` + `Sandbox`) to the live branch before any other step.
- [ ] Sandbox staging passes a manual smoke test (login, send mail, open ticket) — never go live off untested code.

---

## 1. Railway — Production env vars

Set on **both** Production services (`Dev Sandbox` service → `dev.getyippie.com`, and `Sandbox` service → `app.getyippie.com`). They share one Production DB, but each gets its own copy of every var.

### Required on both services

| Env var | Value / notes |
|---|---|
| `DATABASE_URL` | Railway Postgres plugin injects this automatically — verify it points to the **Production** DB, not Sandbox |
| `SECRET_KEY` | `openssl rand -base64 32` — must be a real random key, **not** `change-me-in-production` (startup fails if unchanged) |
| `ANTHROPIC_API_KEY` | The live Anthropic API key — required for inbox AI scanning |
| `RESEND_API_KEY` | Production Resend API key |
| `RESEND_FROM` | `Yippie <noreply@getyippie.com>` (or whatever verified sender) |
| `RESEND_WEBHOOK_SECRET` | From Resend dashboard → Webhooks — used to verify delivery/open events |
| `INBOUND_EMAIL` | e.g. `support@getyippie.com` — the address email is received on; set this **before** go-live |
| `EVOLUTION_API_URL` | Base URL of the live Evolution API instance (WhatsApp gateway) |
| `EVOLUTION_API_TOKEN` | Global API token for the Evolution API instance |
| `ENVIRONMENT` | `dev` on the Dev Sandbox service; `production` on the Sandbox service |
| `ADMIN_EMAIL` | Diederik's superadmin email (e.g. `diederik@getyippie.com`) |
| `ADMIN_PASSWORD` | Strong password — used only on first deploy by `seed.py` (idempotent after that) |

### Bootstrap vars (used once by `seed.py` on first deploy; safe to keep set)

| Env var | Value |
|---|---|
| `TENANT_ID` | `yippie` (or desired slug for the root tenant) |
| `TENANT_NAME` | `Yippie` |
| `ENABLED_MODULES` | Leave unset → defaults to all modules |
| `BRANDING_PRIMARY_COLOR` | `#5BA4F5` (Yippie brand blue) |
| `BRANDING_LOGO_URL` | URL to the live Yippie logo asset |

### Required on Dev Sandbox service only (invite links point to client app)

| Env var | Value |
|---|---|
| `CLIENT_BASE_URL` | `https://app.getyippie.com` — invite emails from `dev.getyippie.com` link here |
| `APP_BASE_URL` | `https://dev.getyippie.com` |

### Required on Sandbox (client) service only

| Env var | Value |
|---|---|
| `APP_BASE_URL` | `https://app.getyippie.com` |

---

## 2. Railway — Production DB

- [ ] Production DB plugin attached to both Production services — confirm `DATABASE_URL` in each service points to the **same** Production Postgres instance (not the Sandbox DB)
- [ ] `[PRIV1]` Switch `DATABASE_URL` to the **private** Railway internal URL (`postgresql+asyncpg://postgres.railway.internal/...`) to keep DB traffic off the public internet — no code change needed, just update the env var

---

## 3. DNS

All DNS records live in Cloudflare. Verify each:

- [ ] `getyippie.com` → A/CNAME pointing to Commercial Railway service — Cloudflare proxy ON
- [ ] `www.getyippie.com` → same, or CNAME → `getyippie.com`
- [ ] `app.getyippie.com` → CNAME pointing to Production Sandbox service — **Cloudflare proxy OFF** (Railway SSL terminates directly)
- [ ] `dev.getyippie.com` → CNAME pointing to Production Dev Sandbox service — **Cloudflare proxy OFF**
- [ ] `_dmarc.getyippie.com` TXT — exactly one record (duplicate was cleaned up 2026-06-11 ✅)
- [ ] `resend._domainkey.getyippie.com` TXT — Resend DKIM key present and verified
- [ ] SPF TXT on `getyippie.com` — includes `include:_spf.resend.com` (or Resend's current SPF record)
- [ ] HSTS header shipping on `getyippie.com` — verify: `curl -sI https://getyippie.com | grep -i strict-transport` ✅ (done 2026-06-17)

---

## 4. Resend

- [ ] Domain `getyippie.com` status = **Verified** in Resend dashboard
- [ ] DKIM record verified (green tick)
- [ ] SPF record verified (green tick)
- [ ] DMARC record verified (green tick)
- [ ] Webhook endpoint configured → `https://dev.getyippie.com/api/v1/emailtracking/webhooks/resend` (or the canonical production URL)
- [ ] Webhook secret matches `RESEND_WEBHOOK_SECRET` env var
- [ ] Test send from `diederik@getyippie.com` lands in inbox (not spam)

---

## 5. First deploy

Railway runs this start command automatically on every deploy:

```
alembic upgrade heads   ← applies all pending migrations
python seed.py          ← creates root tenant + superadmin (idempotent)
python promote_superadmin.py  ← promotes ADMIN_EMAIL to superadmin (idempotent)
uvicorn + nginx
```

- [ ] Trigger the first Production deploy (push to live branch or click "Deploy" in Railway)
- [ ] Check Railway build logs — no `SECRET_KEY is still the insecure default` error
- [ ] Check Railway deploy logs — `alembic upgrade heads` completes without error
- [ ] Check Railway deploy logs — `seed.py` prints `Tenant 'yippie' already exists` OR creates cleanly on first run
- [ ] Health check passes: `curl https://dev.getyippie.com/api/v1/health` → `{"status": "ok"}`

---

## 6. Superadmin account

- [ ] Log in to `dev.getyippie.com` with `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- [ ] Confirm role = superadmin (can see the Clients tab / superadmin panel)
- [ ] Change the password from the Railway-set default to a strong personal password
- [ ] Set `diederik@getyippie.com` as `inbound_email` on the root Yippie tenant (Clients → Edit → Info tab) — this is the catch-all for emails addressed to Diederik's own tenant

---

## 7. Smoke tests

Run these in order. Each step depends on the previous ones working.

### Auth
- [ ] Register a new user at `app.getyippie.com` → receives invite email from Resend → can log in
- [ ] Password reset flow works end-to-end

### Inbox
- [ ] Send a test email to `INBOUND_EMAIL` → appears in Inbox within ~60s
- [ ] AI scanning runs on the inbound email (subject/description suggested)
- [ ] Approve the draft → ticket created

### Tickets
- [ ] Create a ticket manually
- [ ] Reply to a ticket → outbound email arrives at recipient

### Contacts
- [ ] Create a contact
- [ ] Import a small CSV

### Kanban
- [ ] Kanban board loads, contact can be dragged between stages

### Booking
- [ ] Send a booking link to a test email → public `/book/:token` page loads and works

### Calendar
- [ ] Create a calendar event linked to a contact → contact receives invite email

### Live Chat
- [ ] Chat widget loads on a test page (embed `widget.js`)

---

## 8. Post-deploy ops (Diederik, manual)

- [ ] Set `INBOUND_EMAIL` + `diederik@getyippie.com` in **both** Production Railway services (if not already done in step 1)
- [ ] Set invite-link base URLs `[Phase 13]` — `CLIENT_BASE_URL=https://app.getyippie.com` on Dev Sandbox service
- [ ] Confirm Evolution API instance is live and the WhatsApp QR code pairs correctly (`[LIVECHAT-QR]` fix must ship before this)
- [ ] Create a test client tenant via the Superadmin panel → invite an agent → agent logs in via `app.getyippie.com`
- [ ] Check Cloudflare Analytics — no 5xx spike after deploy
- [ ] Confirm `ENVIRONMENT=production` is set on both Production services — this auto-restores tight scheduler intervals (email flush 5s, AI enrich 10s) and full DB pool (5+10 connections) that are intentionally relaxed in sandbox to cut Railway costs

---

## 9. Deferred (after June 28)

These are explicitly **not** blocking go-live and are in the ROADMAP deferred list:

- `[BIZ-Q1]` Business questionnaire
- `[CUSTOM1]` Bespoke package configurator
- `[B2X1]` B2B vs B2C split
- `[DEPT-ROUTING]` Department inbox routing
- `[RBAC1]` Full RBAC
- `[LANG1]` EN/NL language switch
- `[WEB-CONS1]` Commercial site consistency pass
- Per-tenant custom domain

---

## Quick reference — key URLs

| What | URL |
|---|---|
| Marketing site | https://getyippie.com |
| Superadmin (prod) | https://dev.getyippie.com |
| Client app (prod) | https://app.getyippie.com |
| Staging superadmin | https://devsandbox.getyippie.com |
| Staging client | https://sandbox.getyippie.com |
| Railway dashboard | https://railway.app |
| Resend dashboard | https://resend.com |
| Cloudflare dashboard | https://dash.cloudflare.com |
| GitHub repo | https://github.com/DBrinkman1710/obsidian-vault (`devsandbox` branch) |
