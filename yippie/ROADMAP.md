# Yippie — Roadmap
**Updated:** 2026-06-11 (pre-session-25 bugs added; session 24 — verification outcomes filed; session 23 — Performance Step 3; session 22b — dept/SLA race fix, reply language, deadline badges, invite URL)
**Repo:** github.com/DBrinkman1710/obsidian-vault
**Branch:** `sandbox` / `devsandbox`

---

## ▶ Next session — start here

### 🐞 Bugs confirmed in session-24 verification (fix first, in this order)

1. **Compose + attachment send broken** — sending a compose mail that has an attachment
   fails. The undo queue path in `queue_send` / `ComposeModal` likely does not correctly
   handle the `FormData` multipart body when attachments are present (same class of bug as
   the reply `Content-Type` chain from session 15). Fix and verify live.

2. **Reply attachment not delivered** — attaching a file to a reply and sending it results
   in the recipient not receiving the attachment. Check `mailer.py` Resend attachment
   payload and the `pending_sends` flush path for the reply kind.

3. **Inbound attachment arrives empty** — a mail with an attachment lands in the Yippie
   inbox but the attachment is empty/zero-byte. Check `email_poller.py` `_fetch_email_data`
   attachment extraction and the Resend receiving API response shape.

4. **"Email sent" bar persists after compose** — the undo/sent bar does not auto-dismiss
   after compose send completes. The reply path already auto-dismisses; apply the same
   logic to the compose path in `ComposeModal` / `InboxQueue.tsx`. (Extends item 47.)

### 🆕 New items from session-24 verification (implement after bugs)

5. **Inbox: sticky select-all + pagination (9 per page)** — the select-all button should
   be position-fixed/sticky so it stays on screen while scrolling the mail list. Replace
   the current scroll/load-more with paginated pages of 9 mails; add a next/prev arrow
   control. Backend `GET /inbox/drafts` already accepts `skip`/`limit`; wire the frontend.

6. **Tickets list: match inbox UI** — bring `TicketList` in line with the inbox layout:
   same card style, sticky select-all, same 9-per-page pagination with next/prev arrows,
   same action bar for bulk operations.

7. **Ticket deadline dot redesign** (replaces the glowing number from session 22):
   - **Red dot with count** — tickets due same day, tomorrow, or overdue.
   - **Orange dot with count** — tickets due in 2 days.
   - Dot sits in the Tickets sidebar nav item (replacing the current pulsing badge).
   - **Per-tenant thresholds** — the red and orange day-thresholds are configurable in
     Settings → (new) Notifications section. Default: red ≤1 day, orange = 2 days.
     Backend: two new `Tenant` columns (`deadline_red_days INT DEFAULT 1`,
     `deadline_orange_days INT DEFAULT 2`); returned in `GET /api/v1/tenant/config`;
     `GET /tickets/deadline-count` accepts the thresholds (or reads them from the tenant).

8. **Hotkeys on/off toggle** — add a "Keyboard shortcuts" toggle to Profile settings
   (`/settings/profile`). Persisted per user (`users.hotkeys_enabled BOOL DEFAULT true`).
   Frontend reads the setting from the user object and conditionally registers/skips the
   `keydown` listeners. Superadmins and admins see this toggle; agents too.

### 🐞 Additional bugs reported (pre-session-25 — fix alongside items 1–4 above)

9. **Outbound from-address wrong in ndugu environment** — mail sent from the ndugu tenant
   goes out as `sb-support@getyippie.com` instead of the ndugu tenant's own address. Same
   class as the session-18c klimaatexamen fix: check `pending_sends.from_email` snapshot for
   that tenant and whether the tenant's `inbound_email` / `RESEND_FROM` is correctly set.

10. **Settings page broken** — one or more `/settings/*` routes are inaccessible or throwing
    an error in sandbox/devsandbox. Identify which tab is broken and the root cause.

11. **Client page: 6 buttons per row** — currently showing ~6 actions inline per client row;
    should expose only **View as**, **Set demo**, and **Edit**. Move the **Inactive/Active
    toggle**, **Copy email**, and **Delete** actions inside the Edit modal as tabs or action
    sections. Extends item 38c.

12. **Dev sandbox sidebar colour reset** — the devsandbox sidebar has lost its original
    distinct colour (environment indicator). Restore it; check `Sidebar.tsx` or the CSS
    variables applied per environment.

13. **Compose modal: Send/Quit buttons shift on send** — in the sandbox compose modal,
    pressing Send causes the Send and Quit buttons to visually jump/shift position. The
    button layout must remain stable while the undo bar is rendering.

### ▶ Session 22 manual steps (Diederik) — still pending

1. **Set `CLIENT_BASE_URL` in Railway** — fixes invite links pointing to wrong URL:
   - Dev Sandbox env: `CLIENT_BASE_URL=https://sandbox.getyippie.com`
   - Development env: `CLIENT_BASE_URL=https://app.getyippie.com`
   - (Sandbox and app envs don't need it — `APP_BASE_URL` is already the client URL)
2. **Verify dept + SLA saves correctly on approve** — open a draft, approve, pick a department and set a custom SLA. The created ticket should now have the department and the correct follow-up date.
3. **Verify reply subject language** — reply to a Dutch email; reply should have `Re: <original Dutch subject>`, not an English AI-generated one.

---

### 🐞 Reported after session-18 deploy — NEXT SESSION, in this order

1. ~~Compose/reply send broken~~ **FIXED + deployed same day** — session 18c's from-address
   snapshot did `from app.config import settings`, but `app.config` only exports
   `get_settings()` → ImportError on every `queue_send` (compose AND reply). One-line fix.
   **Verify compose + reply live in devsandbox before anything else.**
2. ~~klimaatexamen mail shows in both sandboxes~~ **HARDENED (session 19)** — findings:
   - The unique index on `resend_email_id` has existed since migration `b1c2d3e4f5a6`, so a
     true duplicate row (same mail in two tenants) **cannot persist**. If Diederik saw the mail
     on both URLs while logged in as the same/klimaatexamen user, that's the pair design (one
     shared DB; the inbox follows the login, not the URL) — explain, close.
   - Real gap fixed: when both containers raced past `find_by_resend_id`, the loser's
     `IntegrityError` aborted its **whole ingest batch** (other new mails dropped until the next
     poll). `email_poller.py` now catches the conflict per email, rolls back and skips —
     the roadmap's "on-conflict skip".
   - Still verify in the live DB if the report recurs: `SELECT resend_email_id, count(*),
     array_agg(tenant_id) FROM inbound_messages GROUP BY 1 HAVING count(*) > 1;`
3. ~~Welcome mail rework~~ **DONE (session 19)** — invite/create-password mail is back to
   short form (just the link, 7-day validity). New `send_welcome_to_inbox()` in
   `app/auth/invite.py` sends the introduction content to the tenant's `inbound_email` on
   creation (called from `create_tenant`, never blocks creation); the poller ingests it so
   it's the first draft the client sees. Note: only sent when the tenant has an inbound
   address at creation time.
4. ~~Add-admin/wizard email validation~~ **DONE (session 19)** — `GET /admin/check-email`
   (superadmin-gated, format + already-in-use) + debounced (500ms) inline field errors in
   CreateClientModal (admin email blocks Next; extra-admin email blocks Add) and AddAdminModal
   (blocks submit).

### 🆕 New from Diederik's checklist — 2026-06-10 (post-session 18)

**Bugs to investigate (after the numbered bug list above):**
- **New agent user arrived as admin** — *code-verified clean (session 19):* the whole chain
  Team page (sends `role: 'agent'`) → `POST /team/invite` → invite token `role` claim →
  `/auth/register` `UserRole(claims.get("role", "agent"))` is correct on this branch. Most
  likely cause: the user registered with an **older invite token** — the create-client wizard
  and Add-admin modal always mint `role=admin` tokens, and invite links stay valid 7 days, so
  clicking an earlier admin invite mail (or a pre-session-18 link) yields an admin account.
  Verify live: re-invite a fresh address as agent and register via that exact mail.
- **Personal inbox leaks across users** — *code-verified (session 19):* `mailbox=personal`
  without a personal `inbound_email` returns `[]` server-side, and the frontend shows the
  "no personal inbox address set" banner — the icloud account cannot display joost's personal
  mail from current code. Check live whether diederik1710@icloud.com actually has
  `users.inbound_email` set (e.g. to joost's address before the 409-uniqueness check landed),
  or whether the screenshot predates session 18. The batch-abort fix for bug 2 also removes
  one route for stray fallback ingestion.
- **Personal address only receives after first send** — "I can only receive on a personal mail
  after I have sent a mail from that personal mail using Yippie." Probably: the poller's
  routing map only contains the address once saved on the Profile (no send needed) — verify
  what saving vs sending actually changes, document or fix.
- ~~**Dept/SLA popup: SLA sticks to standard**~~ **FIXED (session 22)** — root cause was a React
  state race: `setFollowUpDays`/`setSelectedDeptId` are async, so `reviewMutation.mutate` fired
  before state updated. Fix: mutation now accepts dept+SLA directly (bypasses state). Also fixed:
  `DraftReview` schema now has `department_id` and passes it to `TicketCreate`.
- **Subject altered on receive** — the inbox shows the AI-suggested subject
  (`ai_suggested_subject`), not the raw email subject. By design for draft tickets. **DONE:**
  session 20 added "Subject: {original}" secondary line; session 21 added "· to {address}";
  **session 22 fixed item 44** — reply subject now uses `msg.subject` (original language),
  not the AI-suggested subject. Fully resolved.

**Design/feature requests (filed in phases):**
- **Department emails as shared inboxes** — a department can have its own address (e.g.
  klimaatexamen@getyippie.com as THE shared inbox; joost-klimaatexamen@ personal). General
  mail from that environment sends from the department address; only admins/superadmins can
  edit. → New design item, pairs with the departments module + item 40 matrix.
- **Auto-provision the client's shared support address on tenant creation** (like personal
  inboxes work) — wizard pre-fills `{slug}-support@getyippie.com` (partially exists in the
  create modal; make it the default end-to-end incl. Resend-side readiness).
- **Personal mail tied to login email + shared mail tied to company** — design decision for
  the email-identity model (Phase 13): personal inbound address derives from the user's login
  identity; shared address belongs to the tenant.
- **Move Departments onto the Team page** — one settings page: user list (large) + departments
  (smaller section) side by side.
- **Email signatures per user** — compose/reply appends the user's signature; editable on
  Profile. (New item.)
- **Remove the "Promote to superadmin" block from the Clients page** — superadmin management
  lives in Settings → Superadmins now.
- **Onboarding mails still carry devsandbox links** — confirms the invite-link base URL bug
  (Next session item 5 / Phase 13); client invites must use the client-facing URL.

### ⚡ Session 18 status update (read first)

- **Shipped + deployed:** from-address snapshot fix (wrong `dev-support@` sender bug),
  shared-inbox fallback fix (mail to dev-support@/sb-support@ was silently dropped since
  9eb8620), ONE personal email address on Profile (sets send + receive), welcome/introduction
  email on all invite paths. See session 18 log entry.
- **Manual steps for Diederik:**
  1. **Cloudflare DNS** — delete the bare `"v=DMARC1; p=none;"` TXT at `_dmarc.getyippie.com`
     (keep the one with the Cloudflare `rua=`); at `resend._domainkey.getyippie.com` keep only
     the DKIM key shown in the Resend dashboard, delete the other two. Multiple records at the
     same name = invalid DMARC/DKIM.
  2. **klimaatexamen tenant** — its `inbound_email` is NULL, so mail to
     `klimaatexamen-support@getyippie.com` is dropped. Needs a DB update or the per-client edit
     modal (item 38c); Claude can run the update on approval.
- **diederik@getyippie.com receiving WORKS** — both test mails are pending drafts in
  Inbox → Personal in devsandbox (tenant Yippie). Check the Personal tab.
- **Go-live checklist additions:** set `INBOUND_EMAIL` in both live Railway envs (currently
  unset; RESEND_FROM=support@ is already correct in both); production/Development/Commercial
  still trigger on stale branch `claude/modular-account-management-design-XrQwj`.

### Priority order

1. ~~Verify session-16 + session-17 work in devsandbox~~ **✅ VERIFIED by Diederik (2026-06-10 checklist)** — confirmed working: single email per reply (no more duplicates), undo send incl. compose, no more "could not undo — email may already be sent", delete ticket, delete client/superadmin with password gate, undo approve/reject, onboarding via dev app, demo environments, make-client-inactive, Sent/Spam/Bin views, shared + personal inbox. **Still to verify (left unchecked):**
   - "Send cancelled" / undo window **auto-dismisses** after undo (item 47)
   - `Cmd/Ctrl+Enter` sends in compose modal and reply panel (item 35)
   - Scroll-only inbox layout + larger compose (item 9)

2. **End-to-end test the auth flows in sandbox:** team invite → register link → login; forgot password → reset; impersonation (View as → amber banner → Exit); change own password (Profile page). `APP_BASE_URL` is now set in **all four** Railway envs (verified 2026-06-10) and the backend strips trailing slashes, so emailed links should work everywhere.

3. **Next development candidates (critical path A/B/C is complete):**
   - Item 11 — DeptReminderModal redesign (pick department AND SLA in the popup, "No department"/"No SLA" options)
   - Item 12 — select + delete/spam mails in InboxQueue (backend bulk-action endpoint exists)
   - Item 34 — ticket deadline reminder popup (≤24h before `follow_up_at`)
   - ~~Item 18 leftover~~ ✅ compose attachments + attachment-replies-through-undo-queue **verified by Diederik 2026-06-10** — only the chips dropdown/remove-`x` UX remains (item 45)

4. ~~Railway deploy blocker~~ **RESOLVED 2026-06-10** — both staging envs build the **`sandbox` branch**; ship with `git push origin devsandbox:sandbox`. `railway up` does NOT upload local code. Migrations are now also safe to deploy to both envs at once: `migrations/env.py` takes a Postgres advisory lock, so the two containers can't race DDL on the shared DB.

5. **Invite-link base URL bug** ✓ **CODE FIXED (session 22) — needs Railway env vars.**
   New `CLIENT_BASE_URL` config setting: invite links use this instead of `APP_BASE_URL` when set.
   Set in Railway: devsandbox → `CLIENT_BASE_URL=https://sandbox.getyippie.com`,
   dev → `CLIENT_BASE_URL=https://app.getyippie.com`. (See Phase 13.)

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

**Step 1 — Quick wins (~1 day, highest leverage): ✅ SHIPPED (session 19)**
1. ~~Add the missing composite indexes~~ DONE — migration `a9b0c1d2e3f4` adds
   `tickets(tenant_id, status, deleted_at)` + `tickets(tenant_id, assigned_to)`
   (idempotent; `draft_tickets(tenant_id, status)` already existed via `c8d9e0f1a2b3`).
2. ~~Inbox `refetchInterval` 10s → 5s + invalidate on send/compose~~ DONE —
   `InboxQueue.tsx` polls every 5s; compose invalidates `['drafts']` when the undo
   window elapses (and when undo arrives too late). Reply/review already invalidated.
3. ~~Nginx `gzip on` + cache headers~~ DONE — gzip for js/css/json/svg, hashed
   `/assets/` cached 1y immutable, `index.html` no-cache (`frontend/nginx.conf`).
   Note: Vite route code-splitting from Step 3 turns out to already be in place
   (per-page chunks in the build output) — skip that line of Step 3.

**Step 2 — Async ingest (~1 day): ✅ SHIPPED (session 22)**
- Ingest no longer calls the AI: `_create_draft` stores the raw email fields
  instantly with new column `draft_tickets.ai_status='queued'` (migration
  `b0c1d2e3f4a5`, idempotent + partial index on queued rows).
- Background `enrich_drafts` job (10s, drains the queue in batches of 5) claims
  rows `FOR UPDATE SKIP LOCKED` (shared-DB safe), fetches contact/tickets/billing
  sequentially, then runs `scan_message` + briefing **concurrently** per batch
  with a 30s timeout; failure → `ai_status='failed'`, raw fields stay.
- **Diederik's Generate buttons**: `POST /inbox/drafts/{id}/generate` runs
  enrichment on demand — DraftReview shows "AI is analyzing…" (auto-polls 3s)
  with a **Generate now** button, the briefing block gets **Generate briefing**
  (also works as retry after a failure / regenerate), inbox cards show a pulsing
  "Analyzing…" badge while queued.
- Reviewing a still-queued draft drops it from the queue so agent edits are
  never overwritten after the fact; body re-fetch re-queues instead of scanning
  inline.

**Step 3 — Perceived speed: ✅ SHIPPED (session 23)**
- Loading skeletons (shared `shell/Skeleton.tsx`) replace the "Loading…" text on
  InboxQueue, TicketList, ContactList AND the DraftReview four-panel grid —
  pages render their shape instantly while data loads.
- Vendor `manualChunks` in `vite.config.ts`: react/router/react-query/axios/zustand
  in one 251 kB (83 kB gzip) chunk that survives deploys via the 1y-immutable
  asset cache; the entry chunk dropped to ~22 kB, so repeat visitors only
  re-download the small per-page chunks after a deploy. (Route splitting itself
  was already in place via `React.lazy`.)
- `get_draft_with_context()` consolidated from 5 sequential round-trips to ≤3:
  draft + inbound message + contact now come back in ONE joined query
  (`asyncio.gather` was a no-go — one AsyncSession can't run concurrent queries,
  same constraint session 22 hit; fewer round-trips is the actual lever).

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

#### 24. Delete client / delete superadmin — password protected ✓ DONE + VERIFIED (2026-06-10)
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

### 10. Stay in email window after approve/reject ✓ DONE + VERIFIED
- After approve or reject: don't navigate away — shipped session 12
- "Back" / "← Back to Inbox" buttons removed from the panel entirely (session 14)
- "✗ Rejected" red state box already existed (confirmed session 17)
- **Undo approve/reject** shipped session 17 (`ae1c80d`) — ✅ **verified by Diederik 2026-06-10**

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

### 17. Undo send ✓ DONE + VERIFIED (2026-06-10)

Shipped in `7967bac`: floating "Yippie" bar with 5s progress + Undo button (`DraftReview.tsx`
~line 896), backed by a `pending_sends` queue (`queue_send`/`cancel_send`/`flush_pending_sends`
in `service.py`). ✅ **Verified by Diederik 2026-06-10**: undo works for replies AND compose,
and the "could not undo — email may already be sent" message is gone.

**Bug history (all fixed + verified):**
- ~~Undo doesn't cancel in time~~ — fixed session 16: server holds 8s, UI counts 5s on its own clock.
- ~~Replies with attachments bypass the undo queue~~ — turned out already built (session 17 audit).
- ~~Undo only wired for replies, not compose~~ — compose undo shipped session 17 (`5543d29`), verified.

**Still open (cosmetic, → item 47):** after a successful undo, the progress bar window should
**auto-dismiss** — Diederik re-filed this unchecked ("make email sent window disappear
automatically after undo send is done").

### 18. Attachments ✓ DONE + VERIFIED (2026-06-10) — NEW BUGS FOUND (session 24)
- Reply panel: file picker + chips (`DraftReview.tsx` ~line 778 ✓)
- Inbound messages: attachment list + download proxy via Resend
- Backend: `attachments_json` column, `mailer.py` sends via Resend attachment API
- ~~Compose modal has no attachment support~~ — already built (sessions 14-16 + PR #14;
  session-17 audit found the gap note was stale). ✅ **Compose attachments verified by
  Diederik 2026-06-10.**
- ~~Attachment-replies skipping the undo queue~~ — already built (see item 17)

**Still open (→ item 45):** attachment **chips dropdown** (list all attached files + `x` to
remove each) and reliable display of inbound attachments — Diederik re-filed unchecked.

**New bugs from session-24 verification (→ Next session bugs 1–3):**
- **Compose + attachment send fails** — sending compose mail with an attachment is broken.
- **Reply attachment not delivered** — recipient does not receive the file.
- **Inbound attachment arrives empty** — file shows in Yippie inbox but is zero-byte/blank.

### 19. Modules order matches sidebar ✓ DONE — fixed at the source, no manual action needed

### 32. Duplicate email sending ✓ FIXED + VERIFIED (2026-06-10)
- Root cause (session 16, `5bcc8a1`): devsandbox + sandbox share one DB and both containers ran
  `flush_pending_sends` with no locking — both sent every queued email. Fixed with
  `SELECT … FOR UPDATE SKIP LOCKED` + delete-before-dispatch (at-most-once).
- ✅ **Verified by Diederik 2026-06-10** ("im responding with 2 emails now" → checked off).

### 33. Delete tickets ✓ DONE + VERIFIED (2026-06-10)
- Shipped session 17 (`5815449`): soft delete via `tickets.deleted_at`, Delete button +
  confirm dialog on ticket detail, admin+ only, SLA jobs skip deleted tickets.
- ✅ **Verified by Diederik 2026-06-10.**

### 34. Ticket deadline reminder popup ✓ DONE (session 22) — REDESIGNED (session 24)
- TicketDetail shows amber/red banner when `sla_due_at` ≤24h or overdue
- TicketList shows colored SLA warning per card
- ~~Sidebar shows pulsing red badge on Tickets nav with count of near-deadline tickets~~ →
  **Redesigned (session 24):** no glowing number — instead a **red dot with count** for
  overdue/same-day/next-day, and an **orange dot with count** for 2-days-out. Thresholds
  are configurable per tenant in Settings → Notifications. See Next session item 7.
- `GET /tickets/deadline-count` backend endpoint needs to accept/use the per-tenant thresholds.

### 35. Hotkey for send — `Cmd/Ctrl + Enter` ✓ DONE (session 17)
- In both compose modal and reply panel: `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows) triggers send
- Should respect the same undo queue flow (item 17)
- **Backlog — more hotkeys:** `c` compose, `r` reply, `e` archive/process, `j`/`k`
  next/prev mail, `/` focus search, `Esc` close panel/modal, `g i` go to inbox
- **Hotkeys on/off per user** — new Profile toggle (session 24, → Next session item 8)

Shipped in `7967bac`. `Sidebar.tsx` renders nav items by iterating `config.enabled_modules`.
The catch was modules were saved in toggle-click order, not canonical order.

**Real fix (session 15 follow-up):** `/api/v1/tenant/config` (`main.py:69-77`) now sorts the
returned `enabled_modules` by canonical `ALL_MODULES` order server-side —
`['inbox', 'contacts', 'tickets', 'activity', 'billing', 'chat']`. Fixes every tenant
immediately — **no per-tenant action required**.

### 41. Sent mail view ✓ VISIBLE + VERIFIED (2026-06-10)
- ✅ Diederik confirmed he can **see sent mails** ("able to see send mails, spam and
  deleted mails" → checked off).
- Verify placement: the Sent tab should sit to the **right of Processed**.

### 42. Spam tab + bin/spam retention — views ✓ VERIFIED; retention still open
- ✅ **Spam and Bin views are visible and confirmed** by Diederik (2026-06-10).
- **Still open (retention + blocking):**
  - **Spam → Bin after 10 working days** (show a note explaining this).
  - **Bin emptied after 20 working days** (show a note explaining this).
  - Scheduler jobs perform both moves; spam senders also blocked in Resend (item 12).

### 43. Ticket deadline reminders (extends item 34) — REDESIGNED (session 24)
- Small pop-up/toast reminder when a ticket is close to its `follow_up_at`.
- **Sidebar badge redesign:** ~~glowing-red dot~~ → **red dot with count** (overdue /
  same-day / next-day) + **orange dot with count** (2 days out). No glow animation.
  Thresholds configurable per tenant. See Next session item 7.

### 44. Reply subject language (extends item 15) ✓ FIXED (session 22)
- Reply subject now uses `msg.subject` (original email's subject in original language)
  instead of `draft.ai_suggested_subject` (always English). Threading preserved.

### 45. Attachment chips UX (extends item 18)
- In compose and reply: a small **dropdown listing all attached files** plus an
  **`x`** to remove each. Inbound attachments should also reliably appear on
  received mail (verify item 18 backend end-to-end).

### 46. Outbound email formatting (nice HTML)
- Proper HTML email templates/layout for outbound mail so it looks polished
  (header, spacing, signature). Precursor to the full template system (Phase 9).
- **Header:** top of every outbound email shows both the **client's logo** (from
  `tenant.logo_url`) and the **Yippie logo** side by side (or client logo left,
  small "powered by Yippie" right). Fall back to the tenant name as text when no
  logo is set.

### 47. Undo-send UI polish (reconcile item 17)
- Replace "email sent" headline with **"Yippie"**; show "email sent" small + grey
  below; a **filling progress panel** to undo; window **auto-dismisses after undo**.
- Compose: pressing send **hides the compose window → shows the undo bar**; undo
  **returns to the editable compose draft**.
- Item 17 implements most of this and undo itself is ✅ **verified working (2026-06-10)** —
  remaining: the cosmetic deltas above + **auto-dismiss of the undo window after a
  successful undo** (re-filed unchecked).
- **"Email sent" bar persists after compose** — confirmed broken in session-24 verification;
  the compose path does not auto-dismiss after send. Fix tracked as Next session bug 4.

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
- **Glowing green dot in sidebar** (item 14) — pulse animation when `isFetching`; solid green when idle (cosmetic). Re-filed unchecked 2026-06-10: make the glow more obvious and place the dot **next to Inbox in the sidebar** for visibility
- **Per-tenant custom domain** (`acme.getyippie.com` → shared Railway service)
- **PostgreSQL RLS** — row-level security policies as defense-in-depth
- **getyippie.com 502 fix** — Cloudflare proxy toggle for Railway domain verification
- **Billing/plans per client** — Tenant gets a `plan` field, gating advanced features
- **Mobile web** — responsive layout for sandbox + devsandbox first
- **diederik@getyippie.com** — Diederik's personal account for live environments
- **Sandbox email address** — sandbox uses `sb-support@getyippie.com`; live uses `support@getyippie.com`
- **Personalized user emails** — ✅ v1 shipped (session 18, commit `9eb8620`): `users.inbound_email` (unique, @getyippie.com) set on the Profile page; Resend poller routes those addresses to the user's tenant; `GET /inbox/drafts?mailbox=shared|personal` filter; Shared/Personal switch in InboxQueue. ✅ **Shared + personal inbox confirmed working by Diederik (2026-06-10)** — but see the personal-inbox-leak and receive-after-send bugs in "New from Diederik's checklist". Remaining: client-domain white-label (verify e.g. `klimaatexamen.nl` in Resend, per-tenant `reply_from_email`), and per-draft privacy (any tenant agent can still open a personal draft by direct ID/URL)
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
- User can then edit the inserted template, or improve it with AI
- Templates are company-wide (per tenant); **users can also create personal templates**

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

### Pipeline module (added 2026-06-10)
- New `pipeline` module — client defines their own pipeline (the steps in their workflow)
- Customers are **automatically labeled** with their pipeline stage (builds on contact
  labels, item 38)
- Tracks **time spent per pipeline stage** per customer
- Automated emails / workflows per stage (e.g. customer enters "after sales" → follow-up
  mail goes out)
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
- **`diederik@getyippie.com` as primary Yippie address** — ✅ **receiving verified
  2026-06-10**: Resend receiving is domain-level (MX → SES inbound), individual addresses never
  appear in the Resend dashboard; mail to diederik@ is ingested and lands in Inbox → Personal.
  Remaining: make it the working primary address in the live pair.
- **One personal mailbox** — ✅ v1 shipped session 18: Profile now has a single "Personal
  email address" that sets both `reply_from_email` and `inbound_email`. Remaining: a setting
  to add extra **"send from"** aliases.

### Onboarding emails & tour
- **Introductory/welcome email on onboarding** — ✅ shipped session 18: the invite email is now
  a proper welcome mail (activate → set up email incl. personal address → tour of
  Inbox/Contacts/Tickets, admin extras) on all four invite paths (`auth/invite.py`). Plain text
  for now; nice HTML = item 46.
- **App tour for new clients** (deferred): guided in-app tour after first login.

### Deliverability
- **Invalid DMARC record — root cause found 2026-06-10 (manual Cloudflare fix):**
  - TWO DMARC TXT records at `_dmarc.getyippie.com` (`"v=DMARC1; p=none;"` and
    `"v=DMARC1; p=none; rua=mailto:…@dmarc-reports.cloudflare.net"`) — multiple records =
    invalid per RFC 7489; receivers treat it as no DMARC. Delete the bare one.
  - THREE DKIM keys at `resend._domainkey.getyippie.com` — a selector must hold one key.
    Keep only the value the Resend dashboard shows; delete the other two.
  - SPF (`send.getyippie.com`) and MX (root → SES inbound) verified correct.

---

## Open questions

- ~~Superadmin without password~~ **CLOSED (2026-06-10)** — checked off by Diederik; the invite-only superadmin path (item 28, session 16/17) closes the hole.
- **Sandbox email routing** — sending from diederik_test sends via `sb-support@getyippie.com`; replies go to sandbox connected to diederik1710@gmail.com. Document that this is intentional. **Same root cause for "reply to `dev-support@getyippie.com` also arrives in regular sandbox"** — `devsandbox` and `sandbox` share one Sandbox DB, so inbound to either address surfaces in both. Document as intentional (or split per `INBOUND_EMAIL` if true isolation is wanted).
- ~~Branding wiring~~ **ANSWERED (session 18):** `primary_color` / `logo_url` are stored on the tenant and returned by `/api/v1/tenant/config`, but **no frontend component applies them** — only the SuperAdminPage form references the fields. The selection currently does nothing. To-do: wire branding into the app shell (sidebar logo, accent color).

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

### Session 23 — 2026-06-11 (Performance Step 3: perceived speed)

The roadmap's named next step after session 22. All three Step 3 lines shipped:

- **Skeletons** — new `frontend/src/shell/Skeleton.tsx` (`Skeleton` primitive +
  `CardListSkeleton` + `TableSkeleton`). InboxQueue shows 5 card skeletons, TicketList 4,
  ContactList renders the real table header with skeleton rows, and DraftReview shows the
  four-panel grid as skeletons instead of a centered "Loading…".
- **Vendor chunk** — `vite.config.ts` `manualChunks.vendor` =
  react/react-dom/react-router-dom/@tanstack/react-query/axios/zustand → one
  251 kB (83 kB gzip) chunk whose hash only changes on dependency bumps; with nginx's
  1y-immutable `/assets/` caching (perf Step 1) repeat visitors skip it entirely after
  deploys. Entry chunk is now ~22 kB.
- **`get_draft_with_context` consolidation** — draft + InboundMessage + Contact fetched in
  one query via outer joins (`Contact.id == coalesce(matched_contact_id, contact_id)`);
  tickets + billing remain two small follow-ups only when a contact matched. 5 round-trips
  → ≤3 on the hot draft-open path (hit ~8× across inbox router endpoints). The roadmap's
  `asyncio.gather` idea was intentionally NOT used: one AsyncSession can't run concurrent
  queries (same constraint session 22 documented for batch enrichment).
- Verified: backend `py_compile` clean, frontend `tsc --noEmit` clean, production
  `vite build` clean with the expected chunk layout. Deployed devsandbox + sandbox.
- **Parallel-session note:** rebased on session 22b (below), which landed mid-session —
  code merged cleanly (22b's SLA badges + my skeletons coexist in TicketList).
- **Next perf step:** Step 4 — contact-search tsvector GIN index, paginate the compose
  contacts picker, pool tuning, RLS enforce-or-drop decision. Items 12/45/47 are
  code-verified done (session 22b) — sandbox verification by Diederik remains.

---

### Session 22b — 2026-06-11 (dept/SLA race fix, reply language, deadline badges, invite URL)

**Bugs fixed:**
- **Dept/SLA popup sticks to standard** — root cause: React state updates from the modal
  (`setFollowUpDays`, `setSelectedDeptId`) are async; `reviewMutation.mutate` fired before
  state committed, sending old (empty) values. Fix: mutation now accepts `{ action, departmentId,
  modalFollowUpDays }` directly from the modal callback, bypassing state. Second bug found and
  fixed simultaneously: `DraftReview` backend schema had no `department_id` field — added it and
  wired through to `TicketCreate` so the department is now actually saved on the ticket.
- **Reply subject language (item 44)** — reply subject was using `draft.ai_suggested_subject`
  (always English AI output). Fixed to use `msg.subject` (original email subject, correct
  language), which also keeps email threads coherent for the recipient's mail client.

**Features shipped:**
- **Ticket deadline badge in Sidebar** — `GET /tickets/deadline-count` endpoint (new, no
  migration) returns count of open/in-progress tickets with `sla_due_at` ≤24h. Sidebar queries
  every 60s and shows a pulsing red badge on the Tickets nav item.
- **TicketList + TicketDetail SLA warnings** — TicketList shows colored "⚠ Overdue" / "⚠ SLA
  due" text per card; TicketDetail shows an amber/red banner at the top. (Items 34/43.)
- **CLIENT_BASE_URL** — new config setting. Invite links use `client_base_url` (when set) instead
  of `app_base_url`. Fix for priority-5 invite-URL bug (devsandbox was minting devsandbox links).
  **Action for Diederik:** set `CLIENT_BASE_URL=https://sandbox.getyippie.com` in devsandbox and
  `CLIENT_BASE_URL=https://app.getyippie.com` in dev Railway envs.

**Code-verified as already done (no changes needed):**
- Items 12 (bulk select/delete/spam), 45 (attachment chips), 47 (undo auto-dismiss) — all
  confirmed complete in source; just need sandbox verification by Diederik.

---

### Session 22 — 2026-06-10 (Performance Step 2: async ingest + on-demand Generate)

The roadmap's top-priority next step. Inbound mail now appears in the inbox the moment the
poller sees it; AI runs behind it (or on click) instead of blocking ingestion.

- **Backend** — migration `b0c1d2e3f4a5` adds `draft_tickets.ai_status`
  (`queued`/`done`/`failed`, default `done` so existing rows are untouched) + a partial index
  on queued rows. `_create_draft` is now AI-free (raw subject/body[:500]/medium priority);
  `update_message_body` re-queues instead of scanning inline; `_build_context` split into
  `_context_inputs` (DB) + the AI call so batch enrichment can parallelize the AI half safely
  on one session (sessions can't run concurrent queries — DB reads stay sequential).
- **Enrichment job** — `enrich_drafts` every 10s in `email_poller.py`, drains the queue in
  batches of `ENRICH_BATCH_SIZE=5`, claims with `FOR UPDATE SKIP LOCKED` so the devsandbox and
  sandbox containers never double-enrich; locks roll back to `queued` if a container dies
  mid-batch; 30s `asyncio.wait_for` per batch item so a hung AI call can't pin locks. Only
  `status=pending` drafts are enriched; reviewing a queued draft flips it to `done` so the
  agent's edits aren't overwritten later.
- **On-demand** — `POST /inbox/drafts/{id}/generate` (gated on the `ai` module) enriches
  immediately; 502 if the AI fails (status stays `failed` for retry).
- **Frontend** — `ai_status` on `DraftTicketOut`; inbox cards show a pulsing "Analyzing…"
  badge (the 5s inbox poll updates it); DraftReview auto-polls every 3s while queued, shows
  an "AI is analyzing this email" banner with **Generate now** in the Draft Ticket form, and
  the AI Briefing block shows a generating state / **Generate briefing** button (doubles as
  regenerate for drafts whose briefing is missing or failed).
- Verified: backend compiles, frontend `tsc --noEmit` clean. Deployed devsandbox + sandbox.
- **Next perf step:** Step 3 — perceived speed (skeletons, `manualChunks`, parallelize
  `get_draft_with_context` reads), then Step 4 (contact search tsvector, pool tuning, RLS
  decision).

---

### Session 21 — 2026-06-10 (inbound_to diagnostics + deploy-log triage; sessions 19/20 ran in parallel)

- **"Deploy crash" report triaged — NOT a crash.** Railway tags all stderr as `[err]`; the
  pasted log was a normal healthy boot (migrations → seed skip → promote skip → uvicorn →
  health 200 → container Online). The trailing `[DB] RAW_URL` line after startup is the
  uvicorn worker lazily creating its engine on the poller's first tick
  (`database.py:34` prints on every engine build). Both staging health endpoints return ok.
- **Inbox cards now show "· to {address}"** — `list_drafts` also returns
  `InboundMessage.inbound_to`; `DraftTicketOut.inbound_to`; rendered next to the timestamp.
  This makes mailbox routing visible in the UI and is the live diagnostic for the
  personal-inbox-leak report (check what address joost's mail was actually routed to, and
  what the icloud account's cards say).
- **Independently re-derived and confirmed session 19's conclusions** on the dedup race
  (unique index since `b1c2d3e4f5a6`; on-conflict skip correct), agent-as-admin (chain clean;
  prime suspect = older 7-day admin invite link, not single-use), and personal-leak (only a
  set `users.inbound_email` on the icloud account can explain it).
- **Parallel work note:** sessions 19 and 20 shipped without log entries — session 19
  (PR #18 + cbfc7fc): perf Step 1 quick wins + next-session items 2/3/4 (welcome-mail rework,
  check-email validation, dedup hardening); session 20 (f7cff8d/5fee89e/5bc799a): SLA modal
  redesign, original-subject display, urgency badge, auto-dismiss sent state.
- **Workflow (Diederik):** save roadmap progress at ~90% context; after each phase → update
  roadmap, commit, deploy (`git push origin devsandbox` + `devsandbox:sandbox`), then he
  clears chat and starts the next phase.

---

### Session 18d — 2026-06-10 (checklist reconciliation — docs only, no code)

Diederik returned the refreshed checklist with a batch of items **checked off** and declared a
**scope freeze: no new tasks for the time being**. Roadmap reconciled accordingly; every
unchecked line was confirmed already tracked (sections, 18b reconciliation table, or session log).

**Marked verified by Diederik:** undo send incl. compose + the "could not undo" bug (item 17),
compose attachments (item 18), duplicate emails fixed (item 32), delete tickets (item 33),
delete client/superadmin with password gate (item 24), undo approve/reject (item 10),
Sent/Spam/Bin views visible (items 41/42 — retention rules still open), shared + personal
inbox (Phase 8), onboarding via dev app, demo environments, make-client-inactive, AI-functions
issue resolved, superadmin-without-password question closed.

**Still to verify (left unchecked by Diederik):** undo-window auto-dismiss after undo
(item 47), `Cmd/Ctrl+Enter` send (item 35), scroll-only inbox layout (item 9), fetching-dot
visibility (item 14).

**New nuances captured (only three — everything else was already filed):**
- Performance: explicit **Generate buttons for the AI summary and tickets** (on-demand AI
  instead of blocking generation during ingest) — added under Performance Step 2.
- Phase 9C: users can also create **personal templates** alongside company-wide ones.
- Item 14: fetching dot **next to Inbox in the sidebar**, more obvious glow.

---

### Session 18c — 2026-06-10 (email-correctness sprint: 4 fixes shipped, full routing diagnosis)

Diederik supplied his full to-do list and asked for answers to the email questions. Traced the
code, audited Railway + Resend + DNS + the staging DB live, shipped four fixes. Merged on top of
session 18b's checklist absorption (parallel PR #16).

#### Live diagnosis (staging DB + Resend feed + DNS + Railway)
- **diederik@getyippie.com receiving WORKS** — both test mails were in the Resend feed,
  ingested 07:56/08:01 into the Yippie tenant as pending drafts with
  `inbound_to=diederik@getyippie.com` → they are in **Inbox → Personal** in devsandbox.
  `users.inbound_email` was already set correctly. Resend receiving is domain-level (MX), so
  individual addresses never show in the Resend dashboard — that's normal.
- **klimaatexamen-support@ mail is dropped**: the klimaatexamen tenant's `inbound_email` is
  NULL (both test mails sit unrouted in the Resend feed). Manual fix needed (DB write was
  permission-denied this session) — or wait for the per-client edit modal (item 38c), the
  admin PATCH endpoint already accepts `inbound_email`.
- **Shared-inbox regression (new bug, FIXED)**: since 9eb8620, fallback routing resolves the
  container's `INBOUND_EMAIL` against `tenants.inbound_email` — no tenant has any support
  address set, so mail to dev-support@/sb-support@ was silently dropped (today's 07:48 test
  never ingested). Poller now falls back to the seed tenant (slug from `TENANT_ID`).
- **Railway audit**: Dev Sandbox = dev-support@, Sandbox = sb-support@ (RESEND_FROM +
  INBOUND_EMAIL each); both live envs RESEND_FROM=support@ ✓ but **INBOUND_EMAIL unset** —
  go-live checklist.
- **DNS**: two DMARC records + three DKIM keys = invalid (details under Phase 13 →
  Deliverability); SPF and MX correct.

#### Shipped (commit on `devsandbox`, deployed to both staging envs via `sandbox`)
- **From-address snapshot fix** — `queue_send` (`inbox/service.py`) now stores the effective
  from address at queue time. Root cause of "joost@klimaatexamen.nl in sandbox sends as
  dev-support@": rows with `from_email=NULL` were sent with the `RESEND_FROM` of whichever
  shared-DB container flushed them.
- **Shared-inbox fallback fix** — `email_poller.py` (above).
- **One personal email address** — Profile's two fields merged into one that sets both
  `reply_from_email` and `inbound_email` (`ProfileSettingsPage.tsx`); backend unchanged;
  extra send-from aliases remain Phase 13.
- **Welcome/introduction email** — `auth/invite.py` rewritten: activate → set up your email
  (incl. personal address) → tour of Inbox/Contacts/Tickets, admin extras, "Take back the
  time that matters" sign-off. All four invite paths (client onboarding, add-admin,
  superadmin, team) use it.
- **Roadmap**: this status update, pipeline module (Phase 10), branding + sandbox-routing
  open questions answered, Phase 13 items marked shipped/diagnosed.

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
