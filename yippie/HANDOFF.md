# Yippie — Handoff Document
**Last updated:** 2026-06-05 (session 10)**
**Branch:** `sandbox` / `devsandbox`
**Repo:** github.com/DBrinkman1710/obsidian-vault

---

## Session 10 — 2026-06-05 (Phase 2 complete)

### What was done

#### Phase 2 — Client management extensions (fully implemented)

**Backend:**
- `TenantCreate` schema: added `is_demo: bool = False` — create a client directly as demo
- `admin/service.py`: `create_tenant()` sets `is_demo` on new tenants; added `list_superadmins()`, `toggle_superadmin_active()`
- `admin/router.py`: `GET /admin/superadmins` + `PATCH /admin/superadmins/{id}` — list and toggle superadmin active status
- `admin/schemas.py`: `SuperadminOut` + `ToggleSuperadminRequest`
- Migration `c2d3e4f5a6b7`: adds `is_active` column to `users` table

**Frontend:**
- `SuperAdminPage.tsx`: completely rewritten with:
  - Filter tabs (All / Active / Demo / Inactive) with per-tab counts
  - Unified status pill per row (Active/Demo/Inactive) replacing toggle+badge
  - "Start as demo" checkbox in CreateClientModal
  - Own environment hidden (filtered by `config.tenant_id`)
  - Bulk select checkboxes + action bar (Set Active / Set Demo / Set Inactive)
- `SuperadminsSettingsPage.tsx` (new): `/settings/superadmins` page — lists all superadmins with active toggle, requires own password to deactivate, shows scope note (sandbox ≠ live)
- `Sidebar.tsx`: Superadmins nav link visible to superadmin role only
- `App.tsx`: `/settings/superadmins` route added

**ROADMAP.md:** Phase 2 items 5, 6, 7, 8a, 8b all marked ✓ DONE

### State right now
- Code committed to `sandbox`, merged to `devsandbox`, pushed to both
- Railway CLI timed out — **Railway should auto-deploy from `devsandbox` branch** (the push to origin/devsandbox triggers it)
- If auto-deploy doesn't fire: log into Railway dashboard → Dev Sandbox → redeploy manually

### Verify after deploy
- Log in at devsandbox.getyippie.com as diederik1710@gmail.com
- Check `/superadmin/clients` → filter tabs visible, own environment hidden, checkboxes work
- Check `/settings/superadmins` → link in sidebar, page loads, deactivate requires password

### Next: Phase 3 — Inbox UX
Items in order from ROADMAP.md:
1. **Item 9** — Scroll-only email list (header + tabs fixed, only list scrolls); larger compose modal
2. **Item 10** — Stay in email window after approve/reject
3. **Item 11** — Department reminder popup on approve without route
4. **Item 12** — Select + delete / spam mails
5. **Item 13** — Filter processed mails by status pill (All / Approved / Rejected / Forwarded / Bin)
6. **Item 14** — Glowing green dot in sidebar next to Inbox
7. **Item 15** — Language-matching replies
8. **Item 16** — Attachments in inbox

---

## Session 9 — 2026-06-05 (Phase 2 + email body debugging)

### What was done

#### Phase 2 — Superadmin Power Tools (fully implemented)

**Backend:**
- `Tenant` model: added `is_active`, `is_demo`, `go_live_at`, `inbound_email` fields
- Migration `a9b8c7d6e5f4` — adds those 4 columns with server defaults
- Migration `b1c2d3e4f5a6` — adds `resend_email_id` (unique, indexed) to `inbound_messages`
- `admin/schemas.py`: `TenantUpdate` + `TenantOut` include new fields; added `AddAdminRequest`, `PromoteSuperadminRequest`
- `admin/service.py`: extended `TENANT_SAFE_FIELDS`; added `add_tenant_user()`, `promote_superadmin()`
- `admin/router.py`: `POST /admin/tenants/{id}/users`, `POST /admin/promote-superadmin`, `GET /admin/resend-check`
- `core/schemas.py` + `main.py`: `TenantConfigOut` now includes `is_demo`, `is_active`

**Frontend:**
- `SuperAdminPage.tsx`: active/inactive toggle per row, demo/go-live buttons, "Add admin" in users modal, Promote Superadmin panel, Resend diagnostic panel
- `App.tsx`: amber demo-mode banner shown to all users when `config.is_demo === true`
- `api/tenant.ts`: `TenantConfig` interface has `is_demo`, `is_active`
- `InboxQueue.tsx`: `refetchInterval` → 10 s, `refetchIntervalInBackground: true`, live-pulse dot

#### Email body investigation

Root cause found: **Resend's `email.received` webhook intentionally omits the body** — only metadata (from, subject, email_id) is sent. Body must be fetched separately via `GET https://api.resend.com/emails/receiving/{id}`.

Changes made:
- `inbox/router.py`: webhook now just acknowledges (returns 200, no ingestion) to avoid race condition where body isn't ready yet
- `inbox/email_poller.py`: APScheduler job runs every 10 s; fetches Resend list → for each email, fetches body → ingests (new) or updates body + re-runs AI scan (existing empty-body records)
- `inbox/service.py`: `find_by_resend_id()`, `update_message_body()` added; `ingest_email()` accepts `resend_email_id`
- `inbox/models.py`: `resend_email_id` column on `InboundMessage`
- `main.py`: starts email poller scheduler on lifespan alongside SLA scheduler

**Status: WORKING ✓** — emails appear in inbox with full body within ~30 seconds of being sent.

Root cause found via diagnostic: Resend's API was returning the body correctly (`text` field populated), but the APScheduler job was blocking itself. The 10s interval fired while the previous run was still processing (AI scan ≈ 3–5s × N emails > 10s), triggering "max instances reached (1)" on every subsequent fire. Fixed with parallel body fetches + 30s interval + `coalesce=True`.

### Key reminder
**Claude can deploy to Railway via CLI** — use `railway link` + `railway up`, don't ask Diederik to deploy.

### Next session
1. Check Resend diagnostic result → fix email body (likely API key permissions)
2. Continue Phase 2 remaining items per ROADMAP.md
3. Confirm all migrations ran on devsandbox (`alembic upgrade head` runs automatically on deploy)

---

## Session 8 — 2026-06-05 (code quality pass)

### What was done

#### Code simplification pass (`201b0b4`)
Reviewed entire diff with 4 agents (reuse, simplification, efficiency, altitude). Applied all clear wins:

- **`config.py`**: `ai_model` setting added — was hardcoded as `"claude-haiku-4-5-20251001"` in 5 places
- **`ai_scanner.py`**: Switched to `AsyncAnthropic` everywhere (was blocking the event loop). Extracted `_client()`, `_model()`, `_strip_fences()` helpers. Added `generate_compose_suggestion()` so all AI calls live in one file.
- **`auth/dependencies.py`**: `_require_role()` factory replaces the duplicate bodies of `require_admin` and `require_superadmin`
- **`admin/service.py`**: `_tenant_to_dict()` helper replaces 3 copies of the `Tenant.__table__.columns` comprehension
- **`inbox/router.py`**: `asyncio.gather` sends all compose emails in parallel (was sequential); `compose_suggest` delegates to `ai_scanner`; removed `get_settings` import (no longer needed here); `asyncio` import moved to top
- **`ChatPage.tsx`**: Removed redundant `style=` attribute (same value as `className`)
- **`InboxQueue.tsx`**: `allContacts` query gated on `enabled: open` — was fetching 1000 contacts on every page load, now only loads when compose modal is open

#### Skipped (debated/too invasive)
- Refactoring `set_tenant_context` to skip role switch for admin users — correct fix but risky for Phase 1
- Switching `admin/service.py` to return `TenantOut` Pydantic models instead of dicts — Phase 2 item
- `resolve_tenant_uuid` per-tenant routing — Phase 2 item (already in roadmap)

### Next session: Phase 2
Start with the Alembic migration adding 4 fields to Tenant model. See ROADMAP.md.

---

## Session 7 — 2026-06-04 (UI overhaul + email system + bug fixes)

### What was done

#### 1. Full Tailwind UI conversion (13 pages)
Every page now uses the consistent Tailwind design system matching the Sidebar/DraftReview. Commit `078795e`.
- LoginPage, ContactList, ContactDetail, ContactNew
- TicketList, TicketDetail, TicketNew
- InboxQueue, ActivityFeed, InvoiceList
- ChatPage, DepartmentsPage, SuperAdminPage

#### 2. Environment-aware Clients tab (`dc42746`)
Clients management tab now only shows on `dev` and `devsandbox` environments. On `sandbox` and `production` (client-facing URLs) it's hidden even for superadmin. `environment` field added to `GET /api/v1/tenant/config` response → `Sidebar.tsx` uses it.

#### 3. Superadmin response serialization fixes (`9c05af4`, `528946f`)
Both `create_tenant` and `update_tenant` now return a dict with `user_count` instead of a plain ORM object. This fixed the false "Failed to create client" / "Failed to update modules" errors — operations were succeeding but FastAPI 500'd on response serialization.

#### 4. Compose email feature (`509e7df`)
New "Compose" button top-right on InboxQueue. Full modal with:
- Multi-contact picker (search contacts, free-email entry, "All contacts" shortcut)
- BCC send for multiple recipients
- AI suggestion panel (describe email in plain text → Claude Haiku writes subject + body)
- Direct send via Resend, no draft review step
- Backend: `POST /api/v1/inbox/compose` + `POST /api/v1/inbox/compose/suggest`

#### 5. Email inbound fixes
- **Webhook 403 fix** (`7ed5004`): Webhook endpoints moved to `webhook_router` mounted without auth in `main.py`. Resend was getting 403 because the router required a Bearer token.
- **AI scan fallback** (`f5e482e`): If `scan_message` fails (no `ANTHROPIC_API_KEY`, API error), draft now uses the raw email subject/body instead of NULL → no more NOT NULL constraint crash.
- **Tenant routing fix** (`3929e09`): `resolve_tenant_uuid` now uses `ORDER BY created_at` to always pick the first-seeded (Yippie) tenant, not a random one.
- **Resend payload fix** (`9936773`): Resend wraps inbound email fields inside `data` object. Was reading from top level so sender/subject came in empty. Now reads `payload["data"]` with fallback.

#### 6. Inbox UX (`e02824f`)
Entire draft card is now clickable (wrapped in `Link`), not just the Review button. Hover highlights border blue.

#### 7. resolve_tenant_uuid note
Current behaviour: all inbound emails land in the first-created (Yippie) tenant. **Phase 2 fix**: add `inbound_email` to Tenant model → webhook looks up tenant by `to` field from email payload → each client's customers email their own address and land in the right inbox.

### State right now
- All deploys pushed to `sandbox` branch, Railway deploying
- Email system: Resend receives at `support@getyippie.com` → sandbox webhook → Yippie inbox (after replay in Resend dashboard)
- Hit **Replay** in Resend for the two pending events once sandbox finishes deploying

### Next session: start Phase 2
All pre-Phase 2 items are done. Phase 2 starts with one Alembic migration adding 4 fields to `Tenant`:
```python
is_active: bool = True
is_demo: bool = False
go_live_at: datetime | None
inbound_email: str | None
```
See ROADMAP.md Phase 2 section for full list of items.

---

## Session 6 — 2026-06-04 (bug fixes + next steps)

### What was done

#### 1. `require_admin` RESET ROLE fix (`auth/dependencies.py`)
Settings page (Departments) was broken because `app_user` (the restricted Postgres role set by `set_tenant_context`) lacked GRANT on the `departments` table. Extended the same RESET ROLE fix already applied to `require_superadmin` to also apply to `require_admin`. Now ALL admin+ routes run with the privileged connection user, not `app_user`. Commit: `7739e86`.

#### 2. `create_tenant` response serialization fix (`admin/service.py`)
Creating a client showed "Failed to create client" even though the client WAS created. Root cause: `TenantOut` schema requires `user_count: int` but `create_tenant` returned a plain `Tenant` ORM object (no `user_count` column). FastAPI threw a 500 during response serialization — AFTER the commit had already succeeded. Fixed by returning a dict with `user_count: 1`. Commit: `9c05af4`.

### State right now (end of session 6)
- `sandbox` branch is deploying commits `9c05af4` + `7739e86`
- Login: `diederik1710@gmail.com` / `password` (change this — see below)
- Creating clients works (no false error after fix)
- Settings (Departments) page works after redeploy lands

---

## Instructions for tomorrow

### 1. First thing: verify everything works on devsandbox
```
devsandbox.getyippie.com — log in as diederik1710@gmail.com
```
Check:
- [ ] Clients nav visible in sidebar ✓
- [ ] Settings nav visible in sidebar ✓
- [ ] Create a test client — should succeed without error, client appears in list immediately
- [ ] Click Settings → Departments page loads (may be empty, that's fine)
- [ ] Create a department in Settings → should save without error

### 2. Change your password (important)
The shared Sandbox DB was seeded with `ADMIN_PASSWORD=password` — that's the current password. Change it via Railway dashboard before doing anything else:
- Railway → Sandbox environment → Variables → set `ADMIN_PASSWORD` to something strong
- Railway → Dev Sandbox → Variables → set `ADMIN_PASSWORD` to the same strong value
- Then reset your password in the shared DB (run in terminal):
```bash
cd /Users/diederik/yippie/yippie/apps/app && railway run --environment "Sandbox" python -c "
import asyncio
from passlib.context import CryptContext
from sqlalchemy import update
from app.core.models import User
from app.database import db_session, get_engine

async def r():
    async with db_session() as db:
        await db.execute(update(User).where(User.email == 'diederik1710@gmail.com').values(hashed_password=CryptContext(schemes=['bcrypt']).hash('YOURNEWPASSWORD')))
        await db.commit()
    await get_engine().dispose()

asyncio.run(r())
"
```

### 3. Test the email system (Resend)
Before starting Phase 2 features, confirm inbound + outbound email works end to end:

**Test outbound (reply from inbox):**
1. Send a real email to your Resend inbound address (sandbox pair)
2. It should appear in the Inbox of `sandbox.getyippie.com`
3. Open the draft → click "Generate reply" → click "Send"
4. Check that the reply lands in your email inbox
5. Confirm it comes from `support@getyippie.com`

**Test inbound isolation:**
1. Send email to your devsandbox Resend inbound address
2. Should appear ONLY in `devsandbox.getyippie.com` inbox, NOT in `sandbox.getyippie.com`
3. Confirms the two Resend routes are correctly isolated per environment pair

**If outbound fails:** Check that `RESEND_API_KEY` and `RESEND_FROM=support@getyippie.com` are set in both Sandbox and Dev Sandbox Railway Variables.

### 4. Phase 2 — Superadmin Power Tools (start here after verification)

**Work in `sandbox` branch, test on devsandbox↔sandbox pair.**

Items in order:

**a) Make client inactive** — `is_active` flag on Tenant
- Backend: add `is_active: bool = True` to `Tenant` model in `core/models.py`
- Migration: `alembic revision --autogenerate -m "add is_active to tenants"`
- Backend: add `is_active` to `TENANT_SAFE_FIELDS` in `admin/service.py`
- Frontend: add active/inactive toggle to each client row in `SuperAdminPage.tsx`

**b) Multiple admin users per client**
- Backend: `POST /api/v1/admin/tenants/{id}/users` → creates an additional admin for a tenant
- Frontend: "Add admin" button in client detail in `SuperAdminPage.tsx`

**c) Demo/offline mode per client**
- Backend: add `is_demo: bool = True` and `go_live_at: datetime | None` to `Tenant` model
- Frontend: superadmin can toggle "go live" per client; clients in demo mode see a banner

**d) Promote more superadmins**
- Backend: `POST /api/v1/admin/promote-superadmin` protected by `require_superadmin`, re-verifies with Diederik's password
- Frontend: form in SuperAdminPage

### Key files to touch in Phase 2
| File | What to change |
|---|---|
| `apps/app/backend/app/core/models.py` | Add `is_active`, `is_demo`, `go_live_at` to `Tenant` |
| `apps/app/backend/app/modules/admin/service.py` | Extend `TENANT_SAFE_FIELDS`, add create_user function |
| `apps/app/backend/app/modules/admin/router.py` | Add new endpoints |
| `apps/app/backend/app/modules/admin/schemas.py` | Add new fields to `TenantOut`, `TenantUpdate` |
| `apps/app/frontend/src/modules/admin/SuperAdminPage.tsx` | Add toggles, modals, buttons |
| `apps/app/backend/migrations/versions/` | New Alembic migration after model changes |

---

## Session 5 — 2026-06-04 (Phase 1 complete + deployment debugging)

### What was done

#### 1. Environment isolation fully working
- Dev Sandbox now uses Sandbox's **public** Postgres URL (`acela.proxy.rlwy.net:26574`) in `DATABASE_URL`. Internal Railway hostnames (`*.railway.internal`) only resolve within their own environment's network — copying them across environments connects to the wrong Postgres with the wrong credentials.
- `PORT` env var was deleted from Dev Sandbox — it was overriding Railway's default port routing and preventing nginx from starting.
- Both `sandbox.getyippie.com` and `devsandbox.getyippie.com` now share one Postgres DB and deploy cleanly.

#### 2. Startup chain fixed
- `promote_superadmin.py` now catches all exceptions internally (never exits non-zero) — startup chain can't be broken by it.
- `require_superadmin` in `auth/dependencies.py` now calls `RESET ROLE` after the superadmin check — this fixes the `POST /api/v1/admin/tenants` "Failed to create client" error caused by `app_user` not having INSERT on the tenants table.

#### 3. Credentials note
- Login: `diederik1710@gmail.com` / `password` (the initial seed password — weak, will be changed in Phase 3 settings page)
- **Action needed:** Update `ADMIN_PASSWORD` in Railway Variables for both Sandbox and Dev Sandbox to a strong value so fresh reseeds never use "password" again.
- Password change in the app UI is a Phase 3 feature (settings/profile page).

### Phase 1 status: COMPLETE
All Phase 1 items are done. Both sandbox and devsandbox are running, healthy, and sharing the same database. Ready to start Phase 2.

### Next session: Phase 2 — Superadmin Power Tools
1. Make client inactive (`is_active` on Tenant model + migration + UI toggle)
2. Multiple admin users per client (`POST /admin/tenants/{id}/users`)
3. Make more superadmins from dev (protected endpoint + UI)
4. Demo/offline mode per client (`is_demo` + `go_live_at` on Tenant)

---

## Session 4 — 2026-06-04 (Phase 1 continued + Resend migration)

### What was done

#### 1. ENVIRONMENT env vars set in Railway (CLI)
All four environments now have the correct `ENVIRONMENT` value:
- Dev Sandbox → `devsandbox`
- Sandbox → `sandbox`
- Development → `dev`
- production → `production`

#### 2. Resend migration (code — committed to `sandbox` branch)
**`apps/app/backend/app/core/mailer.py`** — completely rewritten:
- Calls `POST https://api.resend.com/emails` with `Authorization: Bearer {RESEND_API_KEY}`
- JSON body: `{"from": ..., "to": [...], "subject": ..., "text": ..., "reply_to": [...]}`
- Error class renamed: `MailgunNotConfiguredError` → `ResendNotConfiguredError`

**`apps/app/backend/app/config.py`**:
- Removed: `mailgun_api_key`, `mailgun_domain`, `mailgun_from` (from `Settings` and `InboxConfig`)
- Added: `resend_api_key: str = ""`, `resend_from: str = ""`
- Fallback from address in mailer: `support@getyippie.com`

**`apps/app/backend/app/modules/inbox/router.py`**:
- Import updated: `ResendNotConfiguredError`
- Inbound webhook renamed `email_webhook`, now parses **JSON** (Resend format) instead of form-encoded (Mailgun format)
- Field mapping: `from` → sender, `subject` → subject, `text`/`html` → body

#### 3. Resend dashboard setup (done by user)
- Domain: `getyippie.com` verified (not `yippie.com` — DNS didn't connect)
- Tracking subdomain: `links.getyippie.com` (click tracking only, open tracking skipped)
- Inbound webhooks configured:
  - Production: `https://app.getyippie.com/api/v1/inbox/webhooks/email`
  - Sandbox: `https://sandbox.getyippie.com/api/v1/inbox/webhooks/email`

#### 4. CLAUDE.md + ROADMAP.md updated
Architecture documentation updated with correct pair model and Resend decisions.

### Still outstanding before Phase 1 is complete

#### A. Share Sandbox DB between devsandbox and sandbox (YOU do this — Railway dashboard)
In Railway → Dev Sandbox environment → Variables:
- Copy the `DATABASE_URL` value from the **Sandbox** environment
- Paste it as `DATABASE_URL` in the **Dev Sandbox** environment (overwriting the separate DB it currently has)
- Redeploy Dev Sandbox

**This is the critical step** — without it, clients created in devsandbox don't appear in sandbox.

#### B. Set Resend credentials in Railway Variables (YOU do this)
For every environment (Sandbox, Dev Sandbox, Development, production):
```
RESEND_API_KEY = re_xxxxxxxxx
RESEND_FROM    = support@getyippie.com
```

#### C. Remove web from sandbox/dev Railway deploys (YOU do this — Railway dashboard)
Railway → Commercial service → Settings → Source → set watched branch to `main` or production branch only.
Stops `apps/web` rebuilding every time you push to sandbox/devsandbox.

### Phase 1 verification (after A + B above)
1. Log into devsandbox — confirm you see Clients nav (superadmin) after page load
2. Create a test client in devsandbox → confirm it appears in sandbox
3. Send a test email to your Resend inbound address → confirm it appears in devsandbox inbox (not production)

---

## Session 3 — 2026-06-04 (Phase 1: Environment Isolation)

### What was done

#### 1. Auth role refresh on app load (`useAuth.ts` + `App.tsx`)

**Problem:** `useAuth` stored the user object in `localStorage` at login time. If `promote_superadmin.py` was run on the server after login, the cached role (`admin`) never updated — so the Clients nav link stayed hidden even after the DB was updated.

**Fix:**
- Added `refreshUser()` to `useAuth.ts` — calls `GET /api/v1/auth/me` and updates localStorage + Zustand state
- `App.tsx` now calls `refreshUser()` on every mount (alongside `fetchTenantConfig()`)
- Result: role is always fresh from the DB. After running `promote_superadmin.py`, a page reload picks up `superadmin` automatically — no logout/login required.

#### 2. ROADMAP.md added to repo root
Full phased development plan committed to `sandbox` branch.

### Manual steps still required (Phase 1)

#### Fix dev settings access (you need to do this)
Your account in the **dev** Railway environment DB is still `admin`, not `superadmin`. The code fix above will pick up the new role after you run this once:
```bash
railway link                          # link to the dev environment
railway run python apps/app/backend/promote_superadmin.py
```
Then refresh the page at dev.getyippie.com — Clients nav should appear immediately (no logout needed).

#### Fix devsandbox ↔ app email isolation (you need to do this)
The webhook URL is already env-specific (`devsandbox.getyippie.com/api/v1/inbox/webhooks/email` vs `app.getyippie.com/api/v1/inbox/webhooks/email`). The issue is that your email provider routes ALL inbound mail to one URL.

**Fix in Mailgun (or whichever inbound provider):**
1. Create a separate receiving address for devsandbox, e.g. `support-dev@mg.getyippie.com`
2. Create a Mailgun route: match `support-dev@mg.getyippie.com` → forward to `https://devsandbox.getyippie.com/api/v1/inbox/webhooks/email`
3. Keep the production route (`support@mg.getyippie.com`) pointing to `https://app.getyippie.com/api/v1/inbox/webhooks/email`
4. Set `INBOUND_EMAIL=support-dev@mg.getyippie.com` in the devsandbox Railway env vars

Test: send an email to `support-dev@mg.getyippie.com` → should appear in devsandbox inbox only.

#### Set up Sandbox Railway environment (you need to do this)
Railway dashboard → Yippie project → New Environment:
1. Name: `Sandbox`, copy from production
2. Connect to `sandbox` branch
3. Add Postgres plugin
4. Add custom domain: `sandbox.getyippie.com` (DNS-only CNAME initially)
5. Set env vars: `ADMIN_EMAIL=diederik1710@gmail.com`, `ADMIN_PASSWORD=<secure>`, `ENVIRONMENT=sandbox`
6. Deploy and run `railway run python apps/app/backend/promote_superadmin.py`

#### Remove web from sandbox/dev Railway deploys (you need to do this)
No code change needed. In Railway dashboard:
- Find the **Commercial** (web) service → Settings → Source → change the watched branch to `main` or the production branch only
- This stops `apps/web` from rebuilding every time you push to sandbox/devsandbox

---

## Session 2 — 2026-06-04 (today)

### What was done

#### 1. Inbox UI redesign (apps/app/frontend)
Complete visual overhaul of the DraftReview page (mail detail view) and Sidebar.

**Tailwind CSS v3 added** to the frontend:
- `tailwind.config.js`, `postcss.config.js`, `src/index.css` created
- `lucide-react` installed for SVG icons (replacing emoji throughout)
- `main.tsx` imports the CSS; `index.html` global style stripped

**Sidebar** (`src/shell/Sidebar.tsx`):
- Yippie blue (`#5BA4F5`) background, white text
- Lucide-react icons for all nav items (Inbox, Contacts, Tickets, Activity, Billing, Live Chat, Settings, Sign out)
- Active nav item: `bg-white/20`; pending badge is white circle with blue text
- Company name + logo mark at top; user email + sign out at bottom

**DraftReview** (`src/modules/inbox/pages/DraftReview.tsx`):
- 2×2 card grid that fills `h-screen` — zero outer scroll
- **Top-left:** Customer card (avatar initials, contact info, AI briefing, subscription, recent tickets)
- **Top-right:** Customer email (source badge, timestamp, subject, scrollable body)
- **Bottom-left:** Draft ticket form (subject, description, priority pills) with pinned Approve/Reject/Back; OR processed status + linked ticket
- **Bottom-right:** Draft reply textarea (fills available space) + Generate / Improve / Copy / Send
- **Bottom strip** (col-span-2): Department routing + follow-up days — hidden in processed mode
- All existing logic (useState, mutations, queries) preserved — layout only changed

**App.tsx** updated to `flex h-screen overflow-hidden`; `<PagePad>` wrapper added for all non-DraftReview routes so they keep the original 32px padding.

#### 2. Credential protection hardening
Root cause of the password change: `railway.json` runs `python seed.py` (yippie) or `python create_admin.py` (smb-platform) on **every deploy**. If the tenant slug changed or DB was recreated, it would create a new admin with default/env password.

**Fixed in both repos** (`yippie/apps/app/backend/` AND `obsidian-vault/smb-platform/backend/`):

`seed.py` — three guards added before any user creation:
1. Tenant slug already exists → skip
2. User with that email already exists → skip
3. **Any admin/superadmin exists in the system → skip** ← new

`create_admin.py` — same role-existence guard added first.

`admin/service.py` (yippie only):
- `create_tenant`: checks duplicate email before insert → raises `ValueError` → HTTP 409
- `update_tenant`: explicit `TENANT_SAFE_FIELDS` safelist so `setattr` loop can never write unexpected fields

**Result:** As long as your admin account is alive in the DB, every future deploy is a credential no-op. Only a completely empty DB triggers creation (correct first-run behaviour).

#### 3. sandbox / devsandbox merged
`devsandbox` was one commit ahead of `sandbox` (the superadmin client UI + promote script). They were separate branches pointing at separate Railway environments that couldn't share state.

Fix: committed all session changes to `devsandbox`, then fast-forward merged into `sandbox` and pushed to `origin/sandbox`. Now one unified branch with everything.

**Current branch state:**
- `sandbox` = all features, pushed to origin ← use this going forward
- `devsandbox` = same as sandbox (can be deleted or kept as a local working branch)

#### 4. Commercial website UI prompt
Wrote a detailed design brief for the getyippie.com redesign.
File: `apps/web/UI_PROMPT.txt`

Covers:
- Brand system (colours, typography, buttons, cards)
- 10-section page structure (Nav → Hero → Stats → Features → How it works → Product Moment → Pricing → CTA → Footer)
- Strong anti-generic direction (what NOT to do)
- Inspiration references: linear.app, vercel.com, cal.com, superhuman.com
- Skills to use: `/frontend-design`, `/ui-ux-pro-max`, `/tailwind-css-patterns`
- Quality checklist (must pass before shipping)

The redesign is **not yet built** — the prompt is ready for a new session to execute it.

### Commit
`a003edf` — "UI redesign + credential protection hardening" — on `sandbox` branch

---

---

## What Yippie is

A multi-tenant SaaS customer service platform for SMB clients. One shared deployment at `app.getyippie.com` serves all clients, isolated by `tenant_id`. Diederik (superadmin) onboards clients via API — no new Railway environment needed per client.

**Stack:** FastAPI + SQLAlchemy 2 (async) + PostgreSQL 16 + Alembic | React 18 + Vite + nginx (served from same container) | Railway (hosting) | Cloudflare (DNS/proxy)

---

## Railway environments

| Environment | URL | Branch | Status (2026-06-04) | Purpose |
|---|---|---|---|---|
| production | app.getyippie.com | claude/modular-account-management-design-XrQwj | Active | Main client-facing app |
| Development | dev.getyippie.com | same | Active | Superadmin-only management |
| Commercial | getyippie.com (see note) | same | Active | Next.js marketing site |
| Sandbox | sandbox.getyippie.com | sandbox | Needs Railway setup | Staging before production |
| Dev sandbox | devsandbox.getyippie.com | devsandbox | Needs Railway branch link | Feature development & testing |

### Promotion workflow

```
devsandbox  →  sandbox  →  production (app + dev)
```

Use `scripts/promote.sh` to promote between environments:
```bash
./scripts/promote.sh devsandbox→sandbox      # promotes to sandbox.getyippie.com
./scripts/promote.sh sandbox→production      # promotes to app.getyippie.com + dev.getyippie.com
```

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

### 2. Sandbox + Dev Sandbox Railway environments — not set up
**Status:** `sandbox` and `devsandbox` git branches exist and are pushed. Railway environments need to be created manually.

**Fix (sandbox):** Railway dashboard → Yippie project → New Environment → "Sandbox" → copy from production → connect to `sandbox` branch → add Postgres → add `sandbox.getyippie.com` custom domain → set `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars.

**Fix (devsandbox):** Railway dashboard → Yippie project → New Environment → "Dev Sandbox" → copy from sandbox → connect to `devsandbox` branch → add Postgres → add `devsandbox.getyippie.com` custom domain → set `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars.

### 3. Frontend superadmin UI — DONE
Built `SuperAdminPage.tsx` at `/superadmin/clients`:
- List all client tenants (name, slug, modules, user count, created date)
- Create new client environment (modal with form — name, slug, admin credentials, modules, brand color)
- Edit enabled modules per client
- View all users for a client
- Only visible in sidebar for `superadmin` role

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
1. **Set up Railway environments** — create Sandbox + Dev Sandbox environments in Railway dashboard (see issue #2 above)
2. **getyippie.com fix** — turn off Cloudflare proxy temporarily to activate Railway routing
3. **Email notification on client creation** — send welcome email via Mailgun/Resend when `POST /api/v1/admin/tenants` is called
4. **Per-tenant custom domain** — optional: give big clients their own URL (e.g., `acme.getyippie.com`) pointing to the same Railway service

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
