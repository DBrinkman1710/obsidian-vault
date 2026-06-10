# Yippie — Roadmap
**Updated:** 2026-06-10 (checklist absorption)
**Repo:** github.com/DBrinkman1710/obsidian-vault
**Branch:** `sandbox` / `devsandbox`

---

## ▶ Next session — start here

### Priority order

1. **Verify session-16 + session-17 work in devsandbox** (all code deployed via `sandbox` branch; needs manual UI verification):
   - Reply → exactly **one** email received; undo bar counts 5s; Undo actually cancels; "Send cancelled" auto-dismisses after 3s
   - **Compose → same undo bar** (new): floating bar appears, Undo returns to the editable draft, "Send cancelled" notice; recipients receive nothing after Undo
   - `Cmd/Ctrl+Enter` sends in both compose modal and reply panel
   - **Onboarding wizard**: New client → 5 steps (company+admin / modules / branding / extra admins / demo-live); leave password empty → invite email arrives with a working `/register` link
   - **Delete client** (root owner only): trash button → password dialog → tenant + all data gone
   - **Superadmins page**: Invite superadmin (root owner) → invite email; Delete dialog works; non-root superadmins see neither button
   - **Delete ticket** (admin+): button on ticket detail → confirm → gone from list, SLA jobs skip it
   - **Undo approve/reject**: processed draft → Undo → back in Pending; the created ticket is gone
   - Login as a user of a deactivated tenant → blocked with "This workspace is inactive"
   - Demo tenant reply/compose → amber "Demo mode — email not sent", nothing delivered

2. **End-to-end test the auth flows in sandbox:** team invite → register link → login; forgot password → reset; impersonation (View as → amber banner → Exit); change own password (Profile page). `APP_BASE_URL` is now set in **all four** Railway envs (verified 2026-06-10) and the backend strips trailing slashes, so emailed links should work everywhere.

3. **Next development candidates (critical path A/B/C is complete):**
   - Item 11 — DeptReminderModal redesign (pick department AND SLA in the popup, "No department"/"No SLA" options)
   - Item 12 — select + delete/spam mails in InboxQueue (backend bulk-action endpoint exists)
   - Item 34 — ticket deadline reminder popup (≤24h before `follow_up_at`)
   - Item 18 leftover — attachment-replies now DO go through the undo queue (verified in code); compose attachments existed already — only live verification remains

4. ~~Railway deploy blocker~~ **RESOLVED 2026-06-10** — both staging envs build the **`sandbox` branch**; ship with `git push origin devsandbox:sandbox`. `railway up` does NOT upload local code. Migrations are now also safe to deploy to both envs at once: `migrations/env.py` takes a Postgres advisory lock, so the two containers can't race DDL on the shared DB.

5. **Invite-link base URL bug (important).** Invites currently emit **devsandbox** links — they must point at the **client environments** (`sandbox` / `app`), not at `dev` / `devsandbox`. The admin/superadmin-facing dev app is not where clients register. Verify per-env `APP_BASE_URL` so each environment mints links to the correct client URL. (See Phase 13.)

6. **Prototype 2.0 → promote to live.** Push `devsandbox → sandbox → live` (`dev` + `app`). As part of this, set up **`diederik@getyippie.com` (individual)** and **`support@getyippie.com` (shared)** as the addresses for `dev.getyippie.com`; sandbox keeps `sb-support@`, live uses `support@`. (See Phase 13.)

---

## ▶▶ Performance — make the tool faster

Top priority initiative. Diederik wants Yippie to feel fast. A code pass over
`apps/app` found concrete, fixable bottlenecks (file refs below).

### Why it feels slow today (root causes)

- **Blocking AI scan in the ingest loop** — inbound ingest calls `scan_message()`
  (Anthropic, ~300–800ms) **synchronously** plus `_build_context()` (5 sequential
  DB queries) per email: `email_poller.py:93`, `inbox/service.py:198–242`. High
  volume blocks the poller for seconds → drafts appear to stall.
- **Missing composite indexes on hot list filters** — `tenant_id` alone *is*
  indexed, but list queries filter `(tenant_id, status)` etc. without a matching
  index: needs `draft_tickets(tenant_id, status)`, `tickets(tenant_id, status,
  deleted_at)`, `tickets(tenant_id, assigned_to)` (`inbox/models.py:50`,
  `tickets/models.py:42`). Seq-scans grow with data.
- **Aggressive / wide frontend queries** — inbox polls every 10s
  (`InboxQueue.tsx:469`) so new mail can take up to 10s to appear; the compose
  modal eager-loads up to **1000 contacts** (`InboxQueue.tsx:52–56`).
- **Contact search is `ILIKE %term%`** with no full-text index
  (`contacts/service.py:20–30`) — substring seq-scan on every keystroke.
- **No Vite route code-splitting** (`vite.config.ts`) → one large initial bundle.
- **RLS overhead with no current benefit** — `set_tenant_context` runs two
  `SET LOCAL` round-trips/request (`database.py:101–123`) for RLS policies that
  **aren't enforced yet**. Nginx has no gzip / cache headers (`nginx.conf`).

### Next steps after "make my tool faster" — leverage-ordered

**Step 1 — Quick wins (~1 day, highest leverage):**
1. Add the missing composite indexes (one idempotent migration). Biggest
   actual-latency win as tenants grow.
2. Drop inbox `refetchInterval` 10s → 5s **and** invalidate the inbox query on
   send/compose so new mail/sent state shows instantly.
3. Nginx `gzip on` + long-cache hashed assets, short-cache `index.html`.

**Step 2 — Async ingest (~1 day):** return a minimal draft immediately, move
`scan_message()` + `_build_context()` to a background APScheduler sub-job that
enriches the draft after. Kills the poller stall.

**Step 3 — Perceived speed (~1 day):** Vite `manualChunks` route splitting;
loading skeletons on inbox/contacts/tickets; parallelize
`get_draft_with_context()` reads with `asyncio.gather()`
(`inbox/service.py:245–303`).

**Step 4 — Search & scale (later):** Postgres `tsvector` GIN index for contact
search; paginate the compose contacts picker; tune the connection pool
(`pool_size`/`max_overflow`) + benchmark; decide RLS — either enforce policies
(so the `SET LOCAL` cost is justified) or defer it and drop the per-request role
switch.

Ship each step `devsandbox → sandbox`, `/verify` in sandbox, then promote. The
migration-deploy hazard is already handled (advisory lock in `migrations/env.py`).

---

## What's done

- ✓ Resend email system (inbound + outbound)
- ✓ Email poller (30s, body fully populated)
- ✓ is_active / is_demo / go_live_at / inbound_email on Tenant
- ✓ Multiple admin users per client
- ✓ Promote superadmin (password-protected)
- ✓ Demo banner for clients in demo mode
- ✓ SuperAdminPage: toggles, add admin, go-live, demo, promote, diagnostic
- ✓ Phase 3 items 15/17/18/19 (language badge, undo send, attachments-in-reply, modules
  order) shipped in `7967bac` — see notes on items 16-19 below for bugs found & fixed
  in session 14 testing
- ✓ Reply-to-email — fully traced and fixed across **four stacked bugs** (the first
  patch alone wasn't enough — see item 16 for the full chain): wrong `Content-Type`
  override → shared axios instance's default `Content-Type: application/json` clobbering
  FormData's auto-boundary → missing `app_user` DB grant on `pending_sends`
  (migration `c9d0e1f2a3b4`)
- ✓ White-screen-on-reply crash fixed — a 422 error response renders `detail` as an
  array of objects; React throws "Objects are not valid as a React child" with no error
  boundary → blank page. Hardened `DraftReview.tsx`'s send-reply error handler to
  stringify array/string `detail` before rendering (see item 16)
- ✓ Module order — fixed **at the source**: `/api/v1/tenant/config` now sorts
  `enabled_modules` by canonical `ALL_MODULES` order server-side, so every tenant's
  sidebar is correct immediately — no per-tenant "Edit modules → Save" needed
- ✓ "Back" buttons removed from Draft Ticket panel
- ✓ AI Briefing rewritten to return short keywords instead of a paragraph

---

## Access roles

| Role | Access |
|---|---|
| Root owner | diederik1710@gmail.com only — can see Superadmins panel in dev, can promote/deactivate superadmins |
| Superadmin | dev.getyippie.com + all client apps — full access but cannot manage other superadmins |
| Admin | Own client app only (can edit settings) |
| User | Own client app only (cannot edit settings) |

**Environments:** live = `app.getyippie.com` + `dev.getyippie.com`; sandbox = `sandbox.getyippie.com` + `devsandbox.getyippie.com`

> **TODO (future):** Formally implement the root-owner distinction as a DB role above superadmin. For now, gate the Superadmins panel behind `email === "diederik1710@gmail.com"` check.

---

## Phase 1 — Critical bugs ✓ DONE

- ✓ devsandbox ↔ app DB isolation fixed
- ✓ Dev settings page access restored
- ✓ Activity tab repaired
- ✓ Web removed from sandbox/devsandbox builds

---

## Prototype critical path

Everything needed for the platform to actually work for real clients.

### A. Multi-tenancy correctness

#### Per-tenant webhook routing
`resolve_tenant_uuid()` in `core/tenant.py:19-29` has a literal `TODO: replace with per-tenant webhook URLs` and currently routes **all** inbound email/webhooks to the first tenant in the DB — silently misrouting for every other client. Fix to look up tenant by `inbound_email` field.

#### Enforce `is_active` / `is_demo` / `go_live_at`
Fields exist on `Tenant` (`models.py:36-38`) and are toggled in SuperAdminPage, but do nothing. Add:
- Login-blocking for `is_active=false` tenants
- Feature/data restrictions for `is_demo=true`
- Read and act on `go_live_at` (e.g., auto-activate on date)

### B. Client management (superadmin tools)

#### 23. Impersonation / "view as tenant"
- From SuperAdminPage, "Impersonate" button per client → logs in as their admin (generates short-lived token)
- JWT swap + sessionStorage + amber banner; no DB/migration needed
- Lets Diederik test/debug a client's environment without knowing their password

#### 21. Client onboarding wizard
Guided multi-step flow in SuperAdminPage when creating a new client:
1. Company name + contact name + admin email
2. Modules toggle
3. Branding (color, logo)
4. Add additional admin users
5. Status: start as demo or go live immediately
- After creation: invite email sent via Resend so admin can set their own password

#### 22. Client environment management from dev
- From dev.getyippie.com, Diederik sees all client tenants
- Can activate / deactivate / set to demo from the list
- The "client app" is their isolated tenant in the shared deployment — no separate Railway env per client

#### 24. Delete client / delete superadmin — password protected
- **Delete client:** password confirmation required (diederik1710@gmail.com) → wipes all tenant data; irreversible
- **Delete superadmin:** same password gate; removes the superadmin account entirely (deactivate first if just suspending). Cannot delete yourself.

### C. Auth completeness

#### 25. Repair settings page
- `/settings/profile` — update name, email, **change own password** (important)
- `/settings/team` — invite/manage users for this tenant (admin only)
- `/settings/departments` — already exists
- Sidebar: admin sees Profile + Team + Departments; superadmin also sees Superadmins link

#### 26. User registration / invite
- Admins (and superadmins) can add users from the Settings → Team page
- UI: "Add user" button → ask for name + email (company is already set from tenant context)
- Backend generates signed invite token → Resend email to new user with `/register?token=xxx` link
- User sets their own password on registration; gets assigned `agent` role by default
- Backend: `POST /admin/invite`, `POST /auth/register` (token-gated)

#### 27. Forgot password
- `/forgot-password` → enters email → receives reset link via Resend
- `/reset-password?token=xxx` → sets new password

#### 28. Superadmin invite flow (from dev)
- Password-verification popup (root owner confirms) → name + email → invite email → new superadmin sets password via link
- Sandbox superadmins only have superadmin access in sandbox DBs, not live

---

## Phase 3 — Inbox UX (functional gaps)

### 10. Stay in email window after approve/reject ✓ DONE (mostly)
- After approve or reject: don't navigate away — shipped session 12
- "Back" / "← Back to Inbox" buttons removed from the panel entirely (session 14)
- **Still open:**
  - Add a clear "✗ Rejected" overlay/state mirroring the "✓ Approved" treatment
    (`DraftReview.tsx` ~line 630) — right now a denied draft has no visual confirmation
  - "Undo approve / reject" — needs a backend endpoint to revert `draft_ticket.status`
    (and the ticket it created, if approved) plus a button in the processed view

### 11. Department/SLA reminder on approve — needs redesign
`DeptReminderModal` exists but Diederik wants:
- Pick **department AND SLA directly from the popup** instead of bouncing back to the form
- Explicit **"No department"** + **"No SLA"** options
- **Also trigger when a department IS picked but no SLA is set** — currently no notification

### 12. Select + delete / spam mails
- Checkbox per draft card in InboxQueue
- Action bar: Delete selected / Mark as spam
- Deleted mails → `DraftStatus.bin` (soft delete, visible in Bin tab)
- Spam → `DraftStatus.spam` + call Resend API to block sender

### 13. Filter processed mails by status ✓ DONE
- Filter pills on Processed tab: All / Approved / Rejected / Forwarded / Bin — shipped session 12

### 15. Language-matching replies ✓ DONE
- Shipped in `7967bac`: badge "Reply in {language}" when detected language ≠ English
  (`DraftReview.tsx`, ~line 729)

### 16. Reply to email in inbox — was BROKEN, now FIXED (session 15 follow-up — 4 stacked bugs)

This took **three** rounds to fully fix — each fix uncovered the next layer:

**Bug 1 — manual `Content-Type` override.** `handleSendReply()` (`DraftReview.tsx` ~line 347)
built a `FormData` body but manually set `headers: { 'Content-Type': 'multipart/form-data' }`.
With axios this overrides the auto-generated `boundary=...`, so FastAPI's multipart parser
couldn't read the form fields. *Fix attempt 1: removed the header.* Didn't fully fix it —

**Bug 2 — shared axios instance default header.** The `api` instance (`api/client.ts`) sets
`headers: { 'Content-Type': 'application/json' }` as an **instance-level default**, which axios
merges into every request — including this one — even with no per-request header. So the request
was still going out as `application/json`, still breaking FastAPI's multipart parsing (confirmed
via Railway logs: `POST .../send-reply → 422 Unprocessable Entity`). *Fix: explicitly unset it
with `headers: { 'Content-Type': undefined }`* so the browser generates the correct
`multipart/form-data; boundary=...` itself.

**Bug 3 (the actual "white screen") — 422 error rendered as a React child.** FastAPI returns
`detail` as an **array of validation-error objects** on a 422, and the old catch handler did
`setSendError(detail)` then rendered `{sendError}` directly — React throws "Objects are not valid
as a React child," and with no error boundary the whole tree unmounts to a blank page. *Fix:
hardened the handler to stringify array/string `detail` before storing it.*

**Bug 4 — missing DB grant on `pending_sends` (the true root cause of the 422/500).** Once the
Content-Type was finally correct, the request hit the backend cleanly but returned `500 permission
denied for table pending_sends` (`asyncpg.exceptions.InsufficientPrivilegeError`). The RLS
migration (`c3d4e5f6a7b8`, session 13) ran `GRANT ... ON ALL TABLES IN SCHEMA public TO app_user`,
which only covers tables that existed *at that moment*. `pending_sends` was created in a **later**
migration (`b8c9d0e1f2a3`, session 14) and never got the grant — so `set_tenant_context`'s
`SET LOCAL ROLE app_user` (`database.py:104`) leaves every send-reply request unable to write to
its own queue table. *Fix: new migration `c9d0e1f2a3b4`* grants `app_user` access to
`pending_sends` directly, **and** adds `ALTER DEFAULT PRIVILEGES` so any table created by future
migrations is auto-granted — preventing this whole class of bug from recurring.

All four are now fixed and pushed (`d39b56a`, `a6a58f2`). ⚠️ See deploy hazard in Reference.

### 17. Undo send ✓ DONE — should now actually work, needs final live confirmation

Shipped in `7967bac`: floating "Yippie" bar with 5s progress + Undo button (`DraftReview.tsx`
~line 896), backed by a `pending_sends` queue (`queue_send`/`cancel_send`/`flush_pending_sends`
in `service.py`, flushed every 1s by `email_poller.py`). With migration `c9d0e1f2a3b4` granting
`app_user` access, the queue should now work end-to-end. **Once `devsandbox` is redeployed, send
a reply and confirm the bar appears + Undo works — then mark fully done.**

**Known bugs (not fixed yet):**
- Undo doesn't cancel in time — `cancel_send` is called but the 1s flush has already fired; "email may already be sent" shown after hitting Undo. Fix: increase flush interval or check cancel timestamp before flushing.
- After a successful undo, the progress bar window should **auto-dismiss** — currently stays visible.
- Replies **with attachments** bypass the undo queue — `router.py` (~line 140) acknowledges `PendingSend` has no `attachments` field, so attachment-replies send immediately and return a fake `undo_until` in the past. Fix: add `attachments_json` column to `pending_sends` (migration), thread attachments through `queue_send`/`flush_pending_sends`.
- **Undo send is only wired for replies, not compose** — compose modal sends immediately with no queue or undo bar. Add same queue/undo flow to compose.

### 18. Attachments — partially built; gaps found (session 14)
Shipped for **reply** flow only:
- Reply panel: file picker + chips (`DraftReview.tsx` ~line 778 ✓)
- Inbound messages: attachment list + download proxy via Resend
- Backend: `attachments_json` column, `mailer.py` sends via Resend attachment API

**Gaps:**
- **Compose modal has no attachment support** — `InboxQueue.tsx` has zero attachment code.
  Add the same file-picker + filename-chip UI, reusing `DraftReview.tsx` ~line 778-790 pattern,
  wired through existing `send_email`/attachments backend support
- Attachment-replies skipping the undo queue (see item 17)

### 19. Modules order matches sidebar ✓ DONE — fixed at the source, no manual action needed

### 32. Duplicate email sending (bug)
- Replies are sending twice — user receives two identical emails.
- Likely cause: `flush_pending_sends` fires AND a direct send path is also executing. Investigate `router.py` send-reply flow and `email_poller.py` flush loop for double-trigger.
- Fix before any further inbox work — corrupts every client interaction while broken.

### 33. Delete tickets
- From ticket detail view: "Delete ticket" button → confirmation dialog
- Soft delete (add `deleted_at` column) so ticket history is preserved; filter deleted from default views
- Admin+ only; agents cannot delete

### 34. Ticket deadline reminder popup
- When viewing a draft/ticket that has `follow_up_at` set and the deadline is ≤24h away, show a small toast/badge
- Also surface in inbox list as a warning indicator on the card
- Relates to item 11 (SLA assignment) — deadline only fires when SLA is set

### 35. Hotkey for send — `Cmd/Ctrl + Enter`
- In both compose modal and reply panel: `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows) triggers send ✓ DONE (session 17)
- Should respect the same undo queue flow (item 17)
- **Backlog — more hotkeys:** `c` compose, `r` reply, `e` archive/process, `j`/`k`
  next/prev mail, `/` focus search, `Esc` close panel/modal, `g i` go to inbox

Shipped in `7967bac`. `Sidebar.tsx` renders nav items by iterating `config.enabled_modules`.
The catch was modules were saved in toggle-click order, not canonical order.

**Real fix (session 15 follow-up):** `/api/v1/tenant/config` (`main.py:69-77`) now sorts the
returned `enabled_modules` by canonical `ALL_MODULES` order server-side —
`['inbox', 'contacts', 'tickets', 'activity', 'billing', 'chat']`. Fixes every tenant
immediately — **no per-tenant action required**.

### 41. Sent mail view
- A **Sent** tab/view, placed to the **right of Processed**, listing outbound mail
  (replies + composes). Reads from the send log / `pending_sends` history.

### 42. Spam tab + bin/spam retention
- Expose a **Spam** view alongside **Bin** (only Bin is visible today). `bin` and
  `spam` already exist on `DraftStatus` (migration `e4f5a6b7c8d9`).
- **Spam → Bin after 10 working days** (show a note explaining this).
- **Bin emptied after 20 working days** (show a note explaining this).
- Scheduler jobs perform both moves; spam senders also blocked in Resend (item 12).

### 43. Ticket deadline reminders (extends item 34)
- Small pop-up/toast reminder when a ticket is close to its `follow_up_at`.
- **Sidebar badge:** glowing-red dot on the Tickets nav item with the **count** of
  tickets near deadline.

### 44. Reply subject language (extends item 15)
- **Bug:** reply subjects are being forced to English. The reply subject must match
  the **language of the received mail body** (same detection used for item 15).

### 45. Attachment chips UX (extends item 18)
- In compose and reply: a small **dropdown listing all attached files** plus an
  **`x`** to remove each. Inbound attachments should also reliably appear on
  received mail (verify item 18 backend end-to-end).

### 46. Outbound email formatting (nice HTML)
- Proper HTML email templates/layout for outbound mail so it looks polished
  (header, spacing, signature). Precursor to the full template system (Phase 9).

### 47. Undo-send UI polish (reconcile item 17)
- Replace "email sent" headline with **"Yippie"**; show "email sent" small + grey
  below; a **filling progress panel** to undo; window **auto-dismisses after undo**.
- Compose: pressing send **hides the compose window → shows the undo bar**; undo
  **returns to the editable compose draft**.
- Item 17 already implements most of this — remaining items are cosmetic deltas +
  the "undo doesn't work / check again if true" report → **live-verification**.

### 48. Clickable rows everywhere (UX convention)
- Make the **whole ticket bar clickable** to open it, mirroring how mail opens.
- Apply this **throughout Yippie** and treat it as a standing convention for
  future UI work (lists open on full-row click).

---

## Phase 4 — Contact management

### 20. Multi-select contacts
- Checkbox per contact row
- Action bar when ≥1 selected (admins + superadmins):
  - **Compose** → pre-fills Compose modal with all selected emails
  - **Export CSV** → download name, email, company, phone, tags
  - **Label** → apply/replace a label on all selected (new — see item 38)
  - **Delete** → soft delete with confirmation (retention — see item 39)

### 36. Company grouping for contacts
- Ability to tie multiple contacts under the same company
- Add a `Company` entity (name, domain, notes) that contacts can belong to
- Contact list shows company badge; filter/group by company
- Composing to a company auto-selects all contacts in that company

### 38. Contact labels (client workflow embedding)
- Tenant-defined labels so each client can embed **their own** workflow in Yippie
  — e.g. `potential client`, `new client`, `process step 1`, `process step 2`,
  `after sales`, and `potential client: demo` (used by the demo pipeline, Phase 12)
- CRUD for labels in settings; assign one or more labels per contact
- **Filter contacts by label** (label pills / dropdown on the contact list)
- Bulk **Label** action from multi-select (item 20)

### 39. Contact soft-delete + retention
- Deleted contacts are **soft-deleted**, retained **1 month**, then permanently
  purged by a scheduled job (reuse the `deleted_at` pattern from tickets, session 17)
- Admins can **filter for deleted contacts** and restore within the window
- A scheduler job purges contacts past the 1-month window

### 40. Contact import — multiple formats
- Extend item 29 (CSV) to also accept **JSON and Excel (.xlsx)**
- Same validate / dedupe-by-email / results-summary flow per format

---

## Phase 7 — Data & communications

### 37. Import users / staff from CSV
- `POST /admin/tenants/{id}/users/import` — superadmin only, or `POST /admin/users/import` for own tenant (admin)
- CSV columns: name, email, role (agent/admin)
- Backend: validate, deduplicate by email, bulk-invite (sends invite email per new user via Resend)
- Frontend: upload widget in Settings → Team, results summary (invited / skipped / errors)
- Different from contact import (item 29) — these become platform users, not contacts

### 29. Klantenbestand migratiesysteem (contact CSV import)
- `POST /contacts/import` — multipart CSV upload
- Backend: validate, deduplicate by email, bulk insert
- Frontend: upload widget + results summary (imported / skipped / errors)

### 30. Mail-all system
- `POST /admin/tenants/{id}/broadcast` — superadmin only
- Sends to all contacts of a tenant via Resend batch
- Needs rate limiting + opt-out tracking

### 31. Demo environments (template data)
- Seed a template dataset per tenant in demo mode
- Superadmin can "Reset to demo" — wipes real data, restores template seed

---

## Phase 2 — Client management extensions (SuperAdminPage)

### 5. Client list filter + demo tick in create modal ✓ DONE
- Filter tabs (All/Active/Demo/Inactive) with per-tab counts
- `is_demo` checkbox in CreateClientModal
- Unified status pill per row (Active/Demo/Inactive)
- TODO: switch from admin_password field to invite-email flow (covered by item 26)

### 6. Bulk status change ✓ DONE
- Checkbox per row + select-all in header
- Bulk action bar with Set Active / Set Demo / Set Inactive
- `PATCH` each in parallel via `Promise.all`

### 7. Company name in sidebar ✓ DONE
- `Sidebar.tsx` already renders `config.tenant_name` below the logo mark

### 8a. Hide own environment ✓ DONE
- Client list filters out the tenant whose `id === config.tenant_id`

### 8b. Scoped superadmin management in settings ✓ DONE
- `/settings/superadmins` page (superadmin only) — lists all superadmins with active toggle
- `GET /admin/superadmins` + `PATCH /admin/superadmins/{id}` endpoints
- Deactivation requires own password confirmation; own account protected
- Scope note shown in UI: sandbox superadmins ≠ live superadmins
- TODO: "Add superadmin" button covered by item 28

### 8c. Status column labels (pending)
- Clients tab status column should show "Active" / "Inactive" / "Demo" as text labels clearly
- Allow changing active/inactive/demo directly from that status column

### 38c. Per-client edit modal (UX redesign)
The client row currently exposes many inline options — too noisy. Consolidate:
- Keep only **"View as"** inline on each row
- One **Edit** modal per client with **multiple pages/tabs** for all the
  settings currently scattered on the row (status, modules, branding, info)
- Multi-select still shows the bulk action bar (item 6c) instead of the modal

### 38d. Manage client users from the edit modal
- Inside the per-client Edit modal, superadmins see that client's **user list**
- Can **add / remove / inactivate** users in that client's environment from here
  (reuses the team endpoints — `GET /team/users`, `POST /team/invite`,
  `PATCH /team/users/{id}`)

### 6c. Bulk delete clients
- Extend the existing bulk status bar (item 6) with a **Delete** action so
  superadmins can set selected clients to active/inactive/demo **or delete** at
  once. Delete stays password-gated (item 24).

---

## Phase 8 — Polish & advanced

- **Inbox layout** (item 9) — scroll-only email list, larger compose modal (cosmetic)
- **Glowing green dot in sidebar** (item 14) — pulse animation when `isFetching`; solid green when idle (cosmetic)
- **Per-tenant custom domain** (`acme.getyippie.com` → shared Railway service)
- **PostgreSQL RLS** — row-level security policies as defense-in-depth
- **getyippie.com 502 fix** — Cloudflare proxy toggle for Railway domain verification
- **Billing/plans per client** — Tenant gets a `plan` field, gating advanced features
- **Mobile web** — responsive layout for sandbox + devsandbox first
- **diederik@getyippie.com** — Diederik's personal account for live environments
- **Sandbox email address** — sandbox uses `sb-support@getyippie.com`; live uses `support@getyippie.com`
- **Personalized user emails** — ✅ v1 shipped (session 18, commit `9eb8620`): `users.inbound_email` (unique, @getyippie.com) set on the Profile page; Resend poller routes those addresses to the user's tenant; `GET /inbox/drafts?mailbox=shared|personal` filter; Shared/Personal switch in InboxQueue. Remaining: client-domain white-label (verify e.g. `klimaatexamen.nl` in Resend, per-tenant `reply_from_email`), and per-draft privacy (any tenant agent can still open a personal draft by direct ID/URL)
- **Customer data + AI briefing** *(architecture decision)* — define where full contact history is stored; AI briefing must pull complete history

---

## Phase 9 — Email templates (post-prototype)

### A. Resend email templates
- Register reusable templates in Resend dashboard; backend references by template ID

### B. Mail templates in settings
- `/settings/templates` page — accessible to admins and superadmins
- Full CRUD: create, edit, delete

### C. Template insertion for users
- "Insert template" button in compose modal and reply modal
- AI recommends a template based on the content of the received email

---

## Phase 10 — Additional modules (post-prototype)

### Email tracking module
- New `emailtracking` module — tracks opens, clicks, and delivery events per outbound email
- Webhook receives Resend tracking events (`email.opened`, `email.clicked`, `email.bounced`)
- Shows per-email status in Inbox and Sent views
- Superadmin can enable/disable per tenant

### AI tools module
- New `aitools` module — AI-powered utility tools inside the platform
- Examples: summarise contact history, auto-categorise tickets, draft department responses
- Superadmin can enable/disable per tenant via Clients tab

### Calendar module
- New `calendar` module — view and manage appointments, follow-up dates, and ticket deadlines
- Calendar view per agent showing scheduled follow-ups from tickets (`follow_up_at`)
- Ability to create standalone calendar events tied to a contact or ticket
- Superadmin can enable/disable per tenant

---

## Phase 11 — getyippie.com (marketing site)

`apps/web` (Next.js) is separate from the platform pair. Group all marketing
work here.

### A. Copy & branding
- Replace **"Give yourself back the time that matters"** → **"Take back the time
  that matters."**
- Add hero line: **"Stop losing hours to repetitive support tickets. Yippie
  automates and reduces your customer service so you can focus on building your
  business."**
- Add Diederik's **current logo** (replace placeholder).
- Replace **"Sign up"** CTA → **"Request demo"** (→ Phase 12 flow).
- **"Start for free"** also routes to the demo-request flow (Phase 12).

### B. The Hour Counter (live ticker)
- Feature a live ticker showing total hours Yippie has saved business owners
  globally — e.g. *"Together, Yippie users have taken back 142,300 hours."*
- Backend: public aggregate endpoint summing estimated hours saved across tenants
  (e.g. tickets-automated × avg-handle-time). Seed a configurable base + live
  delta so it's never zero; animated count-up on the page.

### C. Customer-support ROI calculator (design input)

Build in tiers, easiest first.

**Tier 1 — On-page calculator (build first).** Inputs: tickets/month, avg
minutes/ticket, # support staff, hourly cost, % automatable. Output: hours & €
saved/month + payback vs Yippie price. **Pure frontend, no data leaves the
browser → zero privacy concerns.** Ships in days and feeds the Hour Counter
messaging.

**Tier 2 — "Connect your inbox" estimate (higher conviction, more work).**
Analyze the prospect's real support volume. Options, privacy tradeoffs noted:
- **Gmail / Google Workspace add-on (Diederik's idea):** an add-on that reads
  only **metadata** (message counts, threads, response times over a date range)
  — **not bodies** — via the Gmail API with a narrow read-only scope, computes
  volume client-side, returns only aggregate numbers. Privacy: requires Google
  **OAuth verification + a security assessment for restricted scopes**
  (heavyweight, weeks of review). Messaging must be explicit: *"we never read
  your email content."*
- **Lighter — one-time IMAP/OAuth scan:** prospect connects an inbox once; count
  headers only, show ROI, **store nothing**. Faster to ship than a verified
  Workspace add-on.
- **Lightest — CSV / mailbox-export upload:** prospect uploads a mailbox export
  or helpdesk CSV; parsed **in-browser**. No OAuth, no verification, strongest
  privacy story.

**Recommendation:** ship **Tier 1 now**; for Tier 2 pursue the **CSV upload**
path first (best privacy/effort ratio); treat the Google add-on as a later "wow"
once there's demand, flagging the OAuth-verification cost up front.

### D. getyippie.com 502 fix (from Phase 8)
- Cloudflare proxy toggle for Railway domain verification (carried over).

---

## Phase 12 — Demo-request → auto-provisioned demo

Cross-cutting feature: turn a website demo request into a live, self-expiring
demo tenant. Reuses invite-token infra (`auth/invite.py`, `auth/tokens.py`),
tenant creation (`admin/service.py create_tenant`), and demo enforcement
(session 16).

### Request-demo flow
1. Public **Request-demo form** on getyippie.com: **name\***, **email\***,
   company, phone number. ("Start for free" routes here too.)
2. On submit, in the **live env (dev/app)**:
   - **Auto-create a demo tenant** (`is_demo=true`).
   - Email the prospect a **set-password link** (invite token).
   - Demo is **active 7 days, then auto-inactivates** — add a demo-expiry job
     mirroring the existing 60s `go_live_at` scheduler that flips demo↔active.
   - **Notify `diederik@getyippie.com`** that a demo was created.
   - Save the prospect under **Contacts**, labeled **"potential client: demo"**
     (needs Phase 11→ item 38 labels).
   - Open a **ticket with a 3-day follow-up reminder** ("ask about their
     experience / offer setup help").

### Build-first, invite-later (deferred client onboarding)
- Allow building a client environment **without inviting the admin yet** — create
  the tenant in **demo** with no admin invite.
- In the demo environment's **Settings**, a button to **send the invite /
  password link** to the client when ready.
- After the client approves, superadmin **flips it to live** (existing go-live).

---

## Phase 13 — Prototype 2.0 promotion & email identity

### Promotion
- Push **`devsandbox → sandbox → live` (`dev` + `app`)** for prototype 2.0.
- Set up **`diederik@getyippie.com` (individual)** and
  **`support@getyippie.com` (shared)** as the addresses for `dev.getyippie.com`.
- Sandbox keeps `sb-support@getyippie.com`; live uses `support@getyippie.com`
  (existing convention).

### Invite-link base URL (bug — also in Next session)
- Invites must point at **client environments** (`sandbox` / `app`), **not**
  `dev` / `devsandbox` — currently emitting devsandbox links. Verify per-env
  `APP_BASE_URL` so each environment mints links to the correct client URL.

### Email identity
- **`diederik@getyippie.com` as primary Yippie address** — make it Diederik's
  working address; verify it can **receive** (the "Resend doesn't show it at
  receiving" report) and is a valid receiving address end-to-end.
- **One personal mailbox, multiple "send from" addresses** — collapse the
  current "2 personal mail options" into a **single inbox that both sends and
  receives**, plus a setting to add extra **"send from"** addresses (refines the
  session-18 personalized-emails work).

### Onboarding emails & tour
- **Introductory/welcome email on onboarding** (ties to the item 21 wizard): a
  first email explaining how the user sets up their email, etc. Important —
  the in-app **welcome tour can come later**.
- **App tour for new clients** (deferred): guided in-app tour after first login.

### Deliverability
- **Invalid DMARC record** — fix the DMARC DNS record for `getyippie.com` so
  outbound mail authenticates and lands in inboxes.

---

## Open questions

- **Superadmin without password** — second superadmin was created but never set a password, yet can log in. Investigate how promote-superadmin sets credentials; fix so invite-email flow is the only path.
- **Sandbox email routing** — sending from diederik_test sends via `sb-support@getyippie.com`; replies go to sandbox connected to diederik1710@gmail.com. Document that this is intentional. **Same root cause for "reply to `dev-support@getyippie.com` also arrives in regular sandbox"** — `devsandbox` and `sandbox` share one Sandbox DB, so inbound to either address surfaces in both. Document as intentional (or split per `INBOUND_EMAIL` if true isolation is wanted).
- **Branding wiring** — "what does the colour / logo selection actually do?" Today `primary_color` / `logo_url` are stored but may not be applied across the UI. Either **wire branding into the app shell** (sidebar logo, accent color) or document the current scope.

---

## Client-management assessment (2026-06-09)

Diederik confirmed the shared-DB tenant model is the right architecture — just needs polish in three areas. Built-vs-missing:

### 1. Activate/deactivate & demo-mode flow

**Built:** `is_active`/`is_demo`/`go_live_at` on `Tenant` (`models.py:36-38`, migration
`a9b8c7d6e5f4`); `PATCH /api/v1/admin/tenants/{id}` (`admin/router.py:33-38`); full
SuperAdminPage UI — status badges, toggle/bulk-action mutations, create-tenant demo checkbox
(`SuperAdminPage.tsx:62-72, 158-166, 471-487, 576-607, 674-711`); demo banner when
`is_demo=true` (`App.tsx:58-62`); fields returned by `GET /api/v1/tenant/config` (`main.py:62-81`).

**Missing/rough:** fields are purely informational — no enforcement. `is_active=false` doesn't
block login, `is_demo=true` doesn't restrict features or expire data, `go_live_at` is stored
but never read or acted on anywhere.

### 2. Customer-support / impersonation tooling

**Built:** list tenants + user counts (`admin/router.py:20-22`); list/add users per tenant and
promote-to-superadmin (`admin/router.py:41-54`, `SuperAdminPage.tsx:280-402`); superadmin
management page (`SuperadminsSettingsPage.tsx`); Resend email diagnostic (`admin/router.py:86-118`).

**Missing/rough:** **no impersonation/"view as tenant" mechanism at all.** Every query is gated
by `set_tenant_context()` inside `get_current_user()` (`auth/dependencies.py:42`) — to see a
client's data Diederik must create an admin account *in that tenant* and log in separately.
No cross-tenant support dashboard, no audit trail of admin actions.

### 3. Client onboarding / login routing

**Built:** `POST /api/v1/admin/tenants` creates tenant + first admin atomically with
email-uniqueness validation (`admin/router.py:25-30`, `admin/service.py:37-63`); full
create-tenant modal (`SuperAdminPage.tsx:85-178`); idempotent seed script (`seed.py:24-40`);
login resolves user's tenant from `User.tenant_id` and calls `set_tenant_context()` to scope RLS
(`auth/router.py:39-54`, `auth/dependencies.py:19-43`) — "login routes you to your own
environment" already works.

**Missing/rough:** no subdomain/slug-based tenant routing; `resolve_tenant_uuid()` in
`core/tenant.py:19-29` has a literal `TODO: replace with per-tenant webhook URLs` and currently
routes **all** inbound email/webhooks to the first tenant in the DB — silently misrouting for
every other client; no public endpoint to look up a tenant's config by slug before login.

---

## Session log

---

### Session 18b — 2026-06-10 (checklist absorption — no code)

Absorbed Diederik's large working checklist into this roadmap (documentation
only, no code changes). Method: every `[ ]` line maps to exactly one of —
the new **Performance** block, a new/extended **section**, or the
**reconciliation table** below.

**New top-priority initiative:** *▶▶ Performance — make the tool faster* (root
causes + leverage-ordered next steps, grounded in an `apps/app` code pass).

**New sections/phases:**
- Phase 11 — getyippie.com (copy, logo, CTAs, Hour Counter, **ROI calculator
  design input**)
- Phase 12 — Demo-request → auto-provisioned demo (+ build-first/invite-later)
- Phase 13 — Prototype 2.0 promotion, email identity, onboarding emails, DMARC

**Extended existing items:**
- Phase 4 contacts: items 38 (labels), 39 (soft-delete + retention), 40
  (JSON/Excel import); item 20 gains a bulk Label action
- Phase 2 clients: items 38c (per-client edit modal), 38d (manage users in
  modal), 6c (bulk delete)
- Phase 3 inbox: items 41 (Sent view), 42 (Spam tab + retention), 43 (deadline
  reminders/badge), 44 (reply subject language), 45 (attachment chips), 46 (HTML
  formatting), 47 (undo polish), 48 (clickable rows everywhere); item 35 gains a
  hotkeys backlog
- Open questions: branding wiring + the shared-Sandbox-DB routing behaviour
- Next session: invite-link base-URL bug (#5) + prototype 2.0 promotion (#6)

#### Reconciliation — checklist lines already tracked

| Checklist line | Roadmap entry | Status |
|---|---|---|
| add users / user registration | Items 25/26, Team module | DONE — verify |
| add superadmins from settings, password gate | Items 28 / 8b | DONE — verify |
| scroll-only inbox / larger compose | Item 9 | DONE — verify |
| demo tick + active/demo/inactive filter | Item 5 | DONE |
| multi-select clients → status | Item 6 (+ 6c delete) | DONE |
| hotkey Cmd/Ctrl+Enter | Item 35 (+ hotkeys backlog) | DONE |
| glowing green fetching dot | Item 14 | DONE |
| select + delete/spam mails | Item 12 (+ item 42) | tracked |
| import users CSV | Item 37 | tracked |
| mail-all system | Item 30 | tracked |
| email templates (Resend / settings / insert+AI) | Phase 9 A/B/C | tracked |
| email tracking module / calendar module | Phase 10 | tracked |
| customer data + AI briefing storage | Phase 8 | tracked |
| mobile web for sandbox/devsandbox | Phase 8 | tracked |
| company name in sidebar / hide own env | Items 7 / 8a | DONE |
| company grouping for contacts | Item 36 | tracked |
| undo auto-dismiss / "say Yippie" | Items 17 / 47 | DONE — verify |
| access roles clarification | Access roles table | documented |
| repairing activity tab | Phase 1 | DONE |

---

### Session 17 — 2026-06-10 (critical path COMPLETE: wizard, deletes, invites, compose undo, ticket delete, undo review)

Diederik set `APP_BASE_URL` in every Railway env and asked to proceed with the critical path.
All remaining A/B/C frontend shipped, plus the open inbox-reliability items. Five commits on
`devsandbox`, each also pushed to `sandbox` (deploys both staging envs): `f8287c5`, `e86b038`,
`5543d29`, `5815449`, `ae1c80d`.

#### Items 21/24/28 — remaining frontend (`f8287c5`)
- **Onboarding wizard**: `CreateClientModal` reworked into 5 steps (company+admin → modules →
  branding → extra admins → demo/live) with step indicator, per-step validation, summary, and a
  success screen listing sent invites. Password empty ⇒ invite-email flow.
- **Bug found & fixed**: the create form's `inbound_email` was silently dropped — `TenantCreate`
  had no such field, so Pydantic discarded it. Now accepted and stored on the tenant.
- **Delete client**: root-owner-only trash button per row + password-confirm dialog →
  `POST /admin/tenants/{id}/delete`.
- **Superadmins page**: "Invite superadmin" modal (root-owner-only) → `POST /admin/superadmins/invite`
  with sent-confirmation; "Delete" per row (root owner, not self, not root owner row) →
  `POST /admin/superadmins/{id}/delete`. Info box updated per role.
- **AddAdminModal**: password optional — empty sends an invite link; button switches to
  "Send invite"; in-modal confirmation (invitees don't appear in the list until they register).
- `ROOT_OWNER_EMAIL` exported from `useAuth.ts` (UI gating only — server re-verifies with password).

#### APP_BASE_URL hardening (`e86b038`)
All four envs verified set via `railway variables`. Development had a **trailing slash**
(`https://dev.getyippie.com/`) which would have produced `//register` links that React Router
won't match — `config.py` now strips trailing slashes via a field validator.

#### Item 17 (compose undo) + item 35 (hotkey) — (`5543d29`)
- `/inbox/compose` no longer sends immediately: queues one `pending_sends` row **per recipient**
  under a shared compose batch id (8s server hold / 5s UI countdown, same as replies). The
  existing `/drafts/{id}/undo-send` cancels the whole batch (`cancel_send` now deletes all rows,
  not `scalar_one`).
- New `pending_sends.kind` column ('reply'|'compose') so the flush logs `email.composed` vs
  `email.replied` (migration `f4a5b6c7d8e9`, idempotent ADD COLUMN IF NOT EXISTS).
- ComposeModal: floating Yippie undo bar with progress; Undo returns to the **editable draft**
  ("Send cancelled — your draft is unchanged."); send button shows Queued…
- `Cmd/Ctrl+Enter` sends in both the compose modal and the reply panel.
- **`migrations/env.py` now takes `pg_advisory_xact_lock(912021)`** before running migrations —
  one `sandbox` push triggers BOTH staging containers to run `alembic upgrade heads` on the same
  DB simultaneously; the lock serializes them, killing the session-15 "tuple concurrently
  updated" failure class for good. (The lock ships in the same image that runs it.)
- Note: attachment-replies through the undo queue + compose attachments turned out to be
  **already built** (sessions 14-16 + PR #14) — the ROADMAP notes were stale.

#### Item 33 — delete tickets (`5815449`)
- `tickets.deleted_at` (migration `a5b6c7d8e9f0`, idempotent). `list_tickets`, `get_ticket_orm`
  (so every mutation path 404s), and both SLA automation jobs filter deleted tickets.
- `POST /tickets/{id}/delete` gated by `require_admin`.
- TicketDetail: Delete button (admin/superadmin only) + confirm dialog → back to list.

#### Item 10 leftover — undo approve/reject (`ae1c80d`)
- `POST /inbox/drafts/{id}/undo-review`: approved/rejected → pending; clears
  `reviewed_by/reviewed_at/follow_up_at`; the approval's created ticket is **soft-deleted**
  (reuses item 33). 409 for forwarded/pending drafts.
- Undo button in the processed-state box on DraftReview (hidden for forwarded).
- The "✗ Rejected" red state box already existed — that half of item 10 was already done.

#### Open / not done
- All of priority 1+2 verification (manual, needs Diederik's mailbox + UI).
- Items 11, 12 (UI), 34 remain — see "Next session" item 3.
- Production/Development/Commercial Railway envs still trigger on stale branch
  `claude/modular-account-management-design-XrQwj` — must fix before any production deploy.

---

### Session 16 — 2026-06-09/10 (critical path A+B+C, bugs 32+17 root-caused)

Diederik asked for critical-path sections A, B and C, with the two critical inbox bugs fixed
first. All backend work shipped; frontend ~70% done. **Nothing is live yet — see the deploy
blocker in "▶ Next session".** Three commits on `devsandbox`: `5bcc8a1`, `5147dfe`, `e132bc4`.

#### Item 32 — duplicate emails: ROOT CAUSE FOUND + FIXED (`5bcc8a1`)
devsandbox and sandbox **share one Postgres DB**, and `main.py` starts the APScheduler in every
container — so two `flush_pending_sends` loops raced on the same `pending_sends` rows with no
locking, and **both sent every queued email**. Fix: rows are claimed with
`SELECT … FOR UPDATE SKIP LOCKED`, deleted + committed *before* dispatch (at-most-once).

#### Item 17 — undo: ROOT CAUSE FOUND + FIXED (`5bcc8a1`)
The 5s bar was computed from server `undo_until` minus the **browser clock** — latency/skew ate
the window so Undo arrived after the flush. Fix: server holds emails **8s**, UI counts a fixed
**5s** on its own clock (≥3s guaranteed margin). Also: the 409 handler no longer claims "Send
cancelled" when the email actually went out (that lie invited manual re-sends → more duplicates),
and the cancelled notice auto-dismisses after 3s.

#### Phase A — multi-tenancy enforcement (`5147dfe`)
- `is_active` enforced at login **and** per-request in `get_current_user` (user + tenant;
  superadmins exempt from the tenant check)
- **Demo mode blocks outbound email** (Diederik's choice): reply/compose/forward return
  `{demo: true}` and the UI shows amber "Demo mode — email not sent"; the flush re-checks
  `is_demo` and logs the activity event with `demo_suppressed` instead of sending
- **go_live_at acts** (Diederik's choice: auto-activate + end demo): 60s scheduler job sets
  `is_active=true, is_demo=false` and **clears `go_live_at`** (one-shot) once the date passes
- WhatsApp webhooks (Twilio in inbox, Meta in chat) now slug-routed:
  `/api/v1/inbox/webhooks/{slug}/whatsapp`, `/api/v1/chat/webhooks/{slug}/whatsapp`;
  `resolve_tenant_uuid()` (first-tenant-in-DB) is **deleted** — no fallback misrouting remains

#### Phase B+C — client management + auth (backend complete, `e132bc4`)
- **Impersonation (item 23)**: `POST /admin/tenants/{id}/impersonate` mints a 1h JWT (`imp: true`
  claim) for the tenant's first active admin. Frontend done too: "View as" button per client row,
  amber banner with Exit, superadmin token stashed in sessionStorage.
- **Signed-token infra**: `auth/tokens.py` (purpose-scoped JWTs, no DB), `auth/invite.py`
  (7-day invite emails). New `APP_BASE_URL` setting for email links — **must be set in Railway**.
- **Auth flows (items 25-27)**: `POST /auth/register` (invite token → set own password →
  auto-login), `POST /auth/forgot-password` + `/auth/reset-password` (1h token),
  `PATCH /auth/me/password`. Frontend pages live: `/register`, `/forgot-password`,
  `/reset-password`, "Forgot password?" on login, change-password card on Profile.
- **Team module (items 25/26)**: `GET /team/users`, `POST /team/invite` (admin/agent/viewer),
  `PATCH /team/users/{id}` (deactivate/role) — admin-gated, tenant-scoped. `/settings/team` page
  + sidebar "Team" link done.
- **Invite-based onboarding (item 21 backend)**: `create_tenant` password now optional → invite
  email instead; `extra_admin_emails` invited too. **Wizard UI not built yet.**
- **Password-gated deletes (item 24 backend)**: `POST /admin/tenants/{id}/delete` (FK-safe wipe
  of all 15 tenant tables) and `POST /admin/superadmins/{id}/delete` — root-owner
  (diederik1710@gmail.com) + password verify; can't delete self/own tenant/root owner. **UI not built yet.**
- **Superadmin invite (item 28 backend)**: `POST /admin/superadmins/invite` — closes the
  "superadmin without password" hole; invite-only path. **UI not built yet.**
- Login page now shows the backend's 403 detail ("Account deactivated" / "This workspace is inactive").

#### ⚠️ Deploy problem discovered (the session blocker)
GitHub pushes stopped triggering Railway builds, and a manual `railway up` produced a SUCCESS
deployment that still runs old code. Details + probes in "▶ Next session" item 1.

#### Notes
- PR #14 (Michiel + cloud agent) landed mid-session: per-tenant email routing by `inbound_email`,
  chat WS by slug, flush interval 1s→5s. Session-16 work is rebased on top of it.
- `pnpm install --ignore-workspace` in `apps/app/frontend` gives a local `node_modules` for
  `npx tsc --noEmit` (frontend isn't a pnpm workspace package; lockfile left untracked).

---

### Session 15 follow-up — 2026-06-08

After session-15 fixes deployed, Diederik reported the reply was now **white-screening** and
sidebar order was **still wrong**. Both needed further digging — first-pass fixes were each
necessary but not sufficient.

#### Reply-to-email — the real chain of bugs (4, all fixed)

1. **Manual `Content-Type: multipart/form-data` header** — overrode axios's auto-`boundary=`.
   Removing it was correct but not enough, because:
2. **The shared `api` axios instance has a default `Content-Type: application/json`**
   (`api/client.ts:6`) that axios merges into *every* request. **Fix:** `headers: { 'Content-Type': undefined }`.
3. **The white screen** — FastAPI returns `detail` as an *array* on a 422. Old catch handler
   rendered it directly in JSX → React throws, tree unmounts → blank page. **Fix:** stringify
   before storing in `sendError`.
4. **Missing DB grant on `pending_sends`** — RLS migration `c3d4e5f6a7b8` only covered tables
   existing at that moment; `pending_sends` was created later. **Fix:** migration `c9d0e1f2a3b4`
   grants access directly + `ALTER DEFAULT PRIVILEGES` so all future tables are auto-granted.

All four pushed: `d39b56a` (axios + white-screen + sidebar-order-v2), `a6a58f2` (grant migration).

#### Sidebar order — the real fix (moved server-side)

The session-14 toggle-order fix only normalized arrays *when re-saved*. **Real fix:**
`/api/v1/tenant/config` (`main.py:69-77`) now sorts `enabled_modules` by canonical `ALL_MODULES`
order server-side. Fixes every tenant immediately — **no per-tenant action required**.

#### ⚠️ Deploy hazard: concurrent migrations on shared DB

Pushing to both branches simultaneously caused Railway to start both deploys at the same instant —
both migration runs raced on the same `GRANT` statement, throwing
`asyncpg.exceptions.InternalServerError: tuple concurrently updated`.

`sandbox`'s migration won and committed (SUCCESS); `devsandbox`'s crashed mid-GRANT (FAILED,
container stuck on old build). Since the DB change already committed, `devsandbox` just needs a
manual redeploy.

**Going forward:** when a push includes a migration with raw DDL/`GRANT`/`ALTER`, push to one
branch, wait for that deploy to finish, *then* push to the other.

#### Verify after `devsandbox` redeploy

1. Send a reply from a draft → 200 OK, no white screen, undo bar appears with 5s countdown + Undo
2. Refresh sidebar → Inbox, Contacts, Tickets, Activity, Billing, Live Chat

---

### Session 15 — 2026-06-08

Triage of session-14 features. Diederik reported: reply broken, undo bar not appearing,
attachments not working, sidebar wrong order.

#### Reply-to-email — found and fixed
`handleSendReply()` manually set `headers: { 'Content-Type': 'multipart/form-data' }` which
overrides axios's auto-boundary. Removed the manual header.

**This is also why the undo bar didn't appear** — `handleSendReply` never reached the success
branch. One bug, two symptoms.

#### Module/sidebar order — fixed
`SuperAdminPage.tsx` toggle functions were appending modules in click order. Fixed to always
rebuild the array by filtering canonical `ALL_MODULES` list.

~~**After deploy, open "Edit modules" for your tenant and click Save once.**~~ **SUPERSEDED** —
moved server-side in session 15 follow-up. No manual action needed.

#### Attachments gap found
Session 14 shipped attachments for reply flow only. **Compose modal (`InboxQueue.tsx`) has no
attachment code** — logged as ROADMAP item 18.

Also found: attachment-replies bypass undo queue (needs `attachments_json` column on
`pending_sends`) — logged in ROADMAP item 17.

#### Quick fixes
- Removed "Back" / "← Back to Inbox" buttons from Draft Ticket panel
- AI Briefing rewritten to return keywords instead of a paragraph (`ai_scanner.py:generate_context_summary`)

---

### Session 14 — 2026-06-05 (Phase 3 items 15–18)

**Item 18 — Modules order:** `ALL_MODULES` changed from `set` to `list`; `Sidebar.tsx` builds nav
dynamically from `config.enabled_modules` order.

**Item 15 — Language badge:** `DraftReview.tsx` shows blue badge "Reply in Dutch" when detected
language is not English. `schemas.py`: added `detected_language: Optional[str]` to `DraftTicketOut`.

**Item 17 — Undo send:** Migration `b8c9d0e1f2a3` creates `pending_sends` table. `service.py`:
`queue_send`, `cancel_send`, `flush_pending_sends`. `send-reply` now queues and returns
`{queued: true, undo_until: ISO}`. APScheduler flushes every 1s. `DraftReview.tsx`: floating
"Yippie" bar at bottom-right with 5s progress + Undo button.

**Item 16 — Attachments:** Migration `b8c9d0e1f2a3` adds `attachments_json TEXT` to
`inbound_messages`. `email_poller.py`: `_fetch_email_data` extracts attachment metadata. New
download proxy endpoint. `DraftReview.tsx`: received attachments shown + file picker in reply panel.

**Bug fix:** `email_poller.py` fixed `ai_scan` check from `"aitools"` to `"ai"`.

---

### Session 13 — 2026-06-05

**aitools → ai cleanup:** Migration `f5a6b7c8d9e0` strips `aitools` from all tenant
`enabled_modules` arrays.

**Inbound email isolation:** Root cause: devsandbox and sandbox share one DB, so emails from one
poller appeared in both environments.
- Migration `a6b7c8d9e0f1`: adds `inbound_to VARCHAR(255)` to `inbound_messages`
- `ingest_email()` stores Resend `to` address; `list_drafts()` filters by `INBOUND_EMAIL`

**One-time SQL if old rows need backfill:**
```sql
UPDATE inbound_messages
SET inbound_to = 'sb-support@getyippie.com'
WHERE resend_email_id IN (
  'd5e4248a-0f43-4ab9-9890-132643bf382f',
  '1a09a11d-b419-44c0-b2e2-a72fa7be8756'
);
```

---

### Session 12 — 2026-06-05 (Phase 3 Inbox UX)

**Inbound email isolation:** `config.py`: added `INBOUND_EMAIL`. `email_poller.py` filters by `to`
field matching `INBOUND_EMAIL`.

**Items 9–14 shipped:**
- Item 9: Scroll-only layout (`flex flex-col h-full overflow-hidden`); compose modal `max-w-3xl`, textarea `rows=14`
- Item 10: `reviewMutation.onSuccess` invalidates `['draft', id]` instead of navigating away
- Item 11: `DeptReminderModal` shown when approving without department
- Item 12: `bin` and `spam` added to `DraftStatus` enum (migration `e4f5a6b7c8d9`); `POST /inbox/drafts/bulk-action`
- Item 13: Filter pills All / Approved / Rejected / Forwarded / Bin on Processed tab
- Item 14: Green dot in sidebar pulses blue when fetching, solid emerald when idle

**INBOUND_EMAIL Railway setup (done):**
1. Resend: `dev-support@getyippie.com` → webhook `https://devsandbox.getyippie.com/api/v1/inbox/webhooks/email`
2. Resend: `sb-support@getyippie.com` → webhook `https://sandbox.getyippie.com/api/v1/inbox/webhooks/email`
3. Railway Dev Sandbox: `INBOUND_EMAIL=dev-support@getyippie.com`
4. Railway Sandbox: `INBOUND_EMAIL=sb-support@getyippie.com`

---

### Session 11 — 2026-06-05 (AI module + migration fixes)

**AI modularisation:** New `ai` module toggleable per tenant. `email_poller.py` checks for `'ai'`
before scanning. `inbox/router.py` gates `suggest-reply`/`improve-reply`/`compose/suggest` behind
`require_module("ai")`. Generate + Improve buttons hidden in `DraftReview.tsx` when `ai` not in modules.

**Migration fixes:** `is_active` column already existed; old `op.add_column` wasn't idempotent.
Final migration `d3e4f5a6b7c8` uses `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` — idempotent.

---

### Session 10 — 2026-06-05 (Phase 2 complete)

**Backend:** `TenantCreate` schema: `is_demo: bool = False`. Added `list_superadmins()`,
`toggle_superadmin_active()`. Migration `c2d3e4f5a6b7`: adds `is_active` to `users`.

**Frontend:** `SuperAdminPage.tsx` rewritten: filter tabs (All/Active/Demo/Inactive), status pill,
bulk select + action bar. `SuperadminsSettingsPage.tsx` (new): `/settings/superadmins` with
password-required deactivation.

---

### Session 9 — 2026-06-05 (Phase 2 + email body debugging)

**Phase 2:** `Tenant` model got `is_active`, `is_demo`, `go_live_at`, `inbound_email` (migration
`a9b8c7d6e5f4`). New admin endpoints: `POST /admin/tenants/{id}/users`,
`POST /admin/promote-superadmin`, `GET /admin/resend-check`. `App.tsx`: amber demo-mode banner.

**Email body:** Root cause — Resend's `email.received` webhook intentionally omits the body.
Body must be fetched separately via `GET https://api.resend.com/emails/receiving/{id}`.
Webhook now just acknowledges (200). `email_poller.py`: APScheduler job every 30s fetches list
→ fetches body → ingests. Fixed blocking with parallel fetches + `coalesce=True`.

**Key reminder:** Claude can deploy to Railway via CLI — use `railway link` + `railway up`.

---

### Session 8 — 2026-06-05 (code quality pass)

- `config.py`: `ai_model` setting (was hardcoded in 5 places)
- `ai_scanner.py`: switched to `AsyncAnthropic`; extracted `_client()`, `_model()`, `_strip_fences()` helpers
- `auth/dependencies.py`: `_require_role()` factory replaces duplicate role-check bodies
- `admin/service.py`: `_tenant_to_dict()` helper replaces 3 copies of Tenant column comprehension
- `inbox/router.py`: `asyncio.gather` for parallel compose emails
- `InboxQueue.tsx`: `allContacts` query gated on `enabled: open` — no longer fetches 1000 contacts on every page load

---

### Session 7 — 2026-06-04 (UI overhaul + email system + bug fixes)

**Full Tailwind UI conversion** (`078795e`) — 13 pages: LoginPage, ContactList, ContactDetail,
ContactNew, TicketList, TicketDetail, TicketNew, InboxQueue, ActivityFeed, InvoiceList, ChatPage,
DepartmentsPage, SuperAdminPage.

**Compose email** (`509e7df`): "Compose" button → modal with multi-contact picker, BCC send, AI
suggestion panel. `POST /api/v1/inbox/compose` + `POST /api/v1/inbox/compose/suggest`.

**Email fixes:**
- Webhook 403 (`7ed5004`): webhook endpoints moved to `webhook_router` mounted without auth
- AI scan fallback (`f5e482e`): if scan fails, draft uses raw subject/body instead of NULL
- Resend payload fix (`9936773`): reads from `payload["data"]` — Resend wraps inbound fields inside `data`

**Environment-aware Clients tab** (`dc42746`): hidden on `sandbox` and `production`.

---

### Session 6 — 2026-06-04

**`require_admin` RESET ROLE fix** (`7739e86`): Settings page (Departments) broken because
`app_user` lacked GRANT on `departments`. Extended RESET ROLE fix to `require_admin`.

**`create_tenant` serialization fix** (`9c05af4`): "Failed to create client" shown even though
client was created. `TenantOut` requires `user_count: int` but ORM object had none. Fixed by
returning a dict with `user_count: 1`.

---

### Session 5 — 2026-06-04 (Phase 1 complete)

**Environment isolation:** Dev Sandbox now uses Sandbox's **public** Postgres URL
(`acela.proxy.rlwy.net:26574`). Deleted `PORT` env var from Dev Sandbox (was overriding Railway
port routing). Both environments share one Postgres DB and deploy cleanly.

**Startup chain:** `promote_superadmin.py` catches all exceptions (never exits non-zero).
`require_superadmin` calls `RESET ROLE` after the check.

**Phase 1: COMPLETE.**

---

### Session 4 — 2026-06-04

`ENVIRONMENT` env vars set for all four Railway environments. `mailer.py` completely rewritten
to call Resend API (removed all Mailgun references). `config.py`: added `resend_api_key`,
`resend_from`. Resend domain `getyippie.com` verified; inbound webhooks configured for
production and sandbox.

---

### Session 3 — 2026-06-04

**Auth role refresh:** `useAuth.ts` added `refreshUser()` — calls `GET /api/v1/auth/me` on
every app mount so role is always fresh from DB after `promote_superadmin.py` runs.

ROADMAP.md added to repo.

---

### Session 2 — 2026-06-04

**Inbox UI redesign** (`a003edf`): Tailwind CSS v3 + lucide-react icons. DraftReview page
rebuilt as 2×2 card grid. Sidebar redesigned.

**Credential protection hardening:** `seed.py` three idempotency guards (skip if tenant slug
exists, email exists, or any superadmin exists). `admin/service.py`: duplicate-email check +
`TENANT_SAFE_FIELDS` safelist.

**sandbox / devsandbox merged** to single unified branch.

**getyippie.com UI prompt** written to `apps/web/UI_PROMPT.txt` (redesign not yet built).

---

## Reference

### Deploy workflow

```
git push origin devsandbox   # → deploys devsandbox.getyippie.com
git push origin sandbox      # → deploys sandbox.getyippie.com (keep in sync, shared DB)
```

⚠️ **When a push includes a new migration** (especially with raw `GRANT`/`ALTER`/DDL): push to
one branch, **wait for that deploy to finish**, then push to the other. Plain code-only pushes
are fine to batch since they don't touch the DB.

### Monday review workflow

1. Build in `devsandbox` branch
2. Push to `sandbox` to sync both Railway envs
3. `/code-review ultra` + `/security-review` + `/verify`
4. If approved: merge `sandbox → production`

| Skill | When |
|---|---|
| `/code-review ultra` | Every PR — deep multi-agent review |
| `/security-review` | Before every production push |
| `/verify` | Confirm feature works end-to-end in sandbox |
| `/frontend-design` | Building or redesigning UI pages |
| `/ui-ux-pro-max` | Dashboards, settings, onboarding |
| `/tailwind-css-patterns` | Consistent Tailwind across all pages |

### Architecture

One shared Railway deployment at `app.getyippie.com` serves all clients, isolated by `tenant_id`.

**Stack:** FastAPI + SQLAlchemy 2 (async) + PostgreSQL 16 + Alembic | React 18 + Vite + nginx
(served from same container) | Railway (hosting) | Cloudflare (DNS/proxy) | Resend (email)

**Multi-tenant model:**
- Every DB table has `tenant_id UUID NOT NULL`
- `set_tenant_context(db, user.tenant_id)` runs `SET LOCAL app.current_tenant_id` per-request (Postgres RLS)
- Module gating is per-request from DB: `Tenant.enabled_modules` (ARRAY column) read on each request
- `GET /api/v1/tenant/config` is dynamic — returns logged-in user's tenant config from DB

**Role hierarchy:**
```
superadmin  → Diederik only — all API access, admin panel
admin       → client company admins
agent       → support staff
viewer      → read-only
```

**Deployment:** nginx (port 8080) serves Vite/React static files AND proxies `/api` and `/ws`
to uvicorn (port 8000 internal). Railway routes all traffic to port 8080.

### Environments

| Environment | URL | Branch | Purpose |
|---|---|---|---|
| production | app.getyippie.com | production | Main client-facing app |
| Development | dev.getyippie.com | same | Superadmin-only management |
| Commercial | getyippie.com | same | Next.js marketing site |
| Sandbox | sandbox.getyippie.com | sandbox | Staging before production |
| Dev Sandbox | devsandbox.getyippie.com | devsandbox | Feature development & testing |

`devsandbox` ↔ `sandbox` share **Sandbox DB**. `dev` ↔ `app` share **Production DB**. Never cross them.

**Promotion workflow:** `devsandbox → sandbox → production (app + dev)`

### Repo structure

```
obsidian-vault/                     ← git repo root
  yippie/                           ← Turborepo monorepo
    apps/app/                       ← THE main platform
      backend/app/
        auth/                       ← JWT auth, dependencies (require_admin, require_superadmin)
        core/                       ← models.py (User, Tenant, UserRole), schemas.py
        modules/                    ← contacts, tickets, billing, activity, inbox, chat, admin, departments
        config.py                   ← Settings (env vars)
        database.py                 ← async SQLAlchemy session, set_tenant_context (RLS)
        main.py                     ← FastAPI app factory
      backend/migrations/versions/  ← Alembic migrations
      backend/seed.py               ← Creates initial tenant + superadmin (idempotent)
      backend/promote_superadmin.py ← Upgrade existing admin → superadmin
      frontend/src/api/client.ts    ← API base URL = '/api/v1' (relative, nginx proxy)
      nginx.conf                    ← port 8080, /api → uvicorn:8000, / → index.html
      Dockerfile.railway
      railway.json                  ← start: alembic upgrade heads && seed && uvicorn & nginx
    apps/web/                       ← Next.js 14 marketing site (getyippie.com)
```

### Key API endpoints

- `POST /api/v1/auth/token` — login (email + password → JWT)
- `GET /api/v1/auth/me` — current user
- `GET /api/v1/tenant/config` — returns tenant name, enabled modules, branding (dynamic, from DB)
- `GET /api/v1/admin/tenants` — list all client companies (superadmin)
- `POST /api/v1/admin/tenants` — create new client
- `PATCH /api/v1/admin/tenants/{id}` — update client settings
- `GET /api/v1/admin/tenants/{id}/users` — list users for a client
- Full API docs: `https://app.getyippie.com/api/docs`

### Credentials & env vars

Set via Railway environment variables per environment:

| Var | Value |
|---|---|
| `ADMIN_EMAIL` | `diederik1710@gmail.com` |
| `ADMIN_PASSWORD` | **change from default `password`** |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM` | `support@getyippie.com` |
| `ANTHROPIC_API_KEY` | for AI scanning |
| `ENVIRONMENT` | `devsandbox` / `sandbox` / `dev` / `production` |
| `INBOUND_EMAIL` | `dev-support@getyippie.com` (devsandbox) / `sb-support@getyippie.com` (sandbox) |
| `DATABASE_URL` | devsandbox and sandbox **must share** the same Sandbox DB URL |

### Migrations in order

```
bfadac4990f3  initial schema
ca081fe1f74d  add matched_contact_id + context fields
ca4c445f94a2  add departments table
f43013171b86  add context fields to draft_tickets
a1b2c3d4e5f6  add department_id to tickets
b2c3d4e5f6a7  add detected_language to draft_tickets
40bd1ebcda20  add follow_up_at to draft_tickets
e1f2a3b4c5d6  add superadmin role to userrole enum
f2e3d4c5b6a7  add enabled_modules, primary_color, logo_url to tenants
a9b8c7d6e5f4  add is_active/is_demo/go_live_at/inbound_email to tenants
b1c2d3e4f5a6  add resend_email_id to inbound_messages
d3e4f5a6b7c8  add is_active to users + ai module to all tenants (idempotent)
e4f5a6b7c8d9  add bin/spam to DraftStatus enum
a6b7c8d9e0f1  add inbound_to to inbound_messages
f5a6b7c8d9e0  strip aitools from enabled_modules
b8c9d0e1f2a3  create pending_sends + attachments_json on inbound_messages
c9d0e1f2a3b4  grant app_user access to pending_sends + ALTER DEFAULT PRIVILEGES
d0e1f2a3b4c5  add attachments_json to pending_sends
e2f3a4b5c6d7  add per-user from_email
f4a5b6c7d8e9  add kind (reply|compose) to pending_sends
a5b6c7d8e9f0  add deleted_at to tickets (soft delete)
```

> `migrations/env.py` takes `pg_advisory_xact_lock(912021)` before migrating — concurrent
> deploys of the staging pair can no longer race DDL on the shared DB.
