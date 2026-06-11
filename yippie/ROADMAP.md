# Yippie — Roadmap
**Updated:** 2026-06-11 (session 28 — deadline-indicator redesign: per-tenant severity dots on Tickets nav)
**Repo:** github.com/DBrinkman1710/obsidian-vault
**Branch:** `sandbox` / `devsandbox`

---

## 🧭 How this roadmap is organized

Open work is grouped into **three tiers** by size/complexity, and each tier is mapped to the
Claude model to build it with:

| Tier | Nature of work | Model |
|---|---|---|
| 🟣 **Tier 1** | Big, complicated & creative | **Fable** |
| 🔵 **Tier 2** | Medium | **Opus** |
| 🟢 **Tier 3** | Quick & easy fixes / wins | **Sonnet** |

Item numbers (`[11]`, `[38c]`, …) are kept so each item still maps to its history in the
**Session log** (Appendix A). Finished work is collapsed under **✅ Done**; full architecture /
environment / deploy reference lives in **Appendix B**.

> **Note (2026-06-11):** the tiers were reconciled against the actual `apps/app` code. A batch of
> items previously listed as open turned out to be shipped (impersonation, bulk bin/spam, retention
> scheduler, `is_active`/`go_live_at` enforcement, per-tenant webhook routing, undo-send polish,
> attachment chips, response-template backend, …) and were moved to **✅ Done**. Only verified-open
> work remains in the tiers below.

---

## ▶ Next session — start here

**Bugs still open — needs code (session 27 verification):**

- ~~**Inbox select-all not sticky**~~ ✅ **DONE (session 27, PR #20)** — sticky select-all header.
- ~~**Inbox pagination**~~ ✅ **DONE (session 27, PR #20)** — 9 items/page with next/prev.
- ~~**Ticket list UI**~~ ✅ **DONE (session 27, PR #20)** — now matches the inbox layout.
- ~~**Deadline indicator redesign**~~ ✅ **DONE (session 28)** — the glowing count badge on the Tickets nav is replaced with a per-tenant severity dot:
  - 🔴 red dot: 1+ tickets overdue or due within `deadline_red_days` (today/tomorrow, default 1)
  - 🟠 orange dot: 1+ tickets due within `deadline_orange_days` (default 2), beyond the red window
  - No dot: everything is fine
  - Both thresholds are editable per tenant in **Settings → Departments → Deadline indicator**.
- ~~**Hotkeys on/off toggle**~~ ✅ **DONE (session 27, PR #20)** — per-user toggle in Profile (`users.hotkeys_enabled`).
- **Activity page not working** — code-audited session 28: backend (`/activity`, `/activity/stats`) + frontend + route registration all look correct; no code defect found. Most likely an empty-state (no logged events for that tenant) — **needs sandbox repro** with a specific error before any fix.

**Additional bugs reported (pre-session-28 — fix alongside the above):**
- ~~**Outbound from-address wrong in ndugu environment**~~ ✅ **DONE (commit `9414789`)** — `queue_send` now resolves `from_email` to `tenant.inbound_email` before the `RESEND_FROM` fallback.
- **Settings page broken** — one or more `/settings/*` routes are inaccessible or throwing an error. Code-audited session 28: all `/settings/*` routes (`profile`, `team`, `departments`, `superadmins`) are registered in `App.tsx` and the pages compile/build clean; no defect found. **Needs sandbox repro** — which tab, and the exact error.
- **Client page: too many buttons per row** — should expose only **View as**, **Set demo**, and **Edit** inline; the Inactive/Active toggle, Copy email, and Delete should live inside the Edit modal. Extends [38c].
- **Compose modal: Send/Quit buttons shift on send** — pressing Send causes the button row to jump/shift position; layout must stay stable while the undo bar is rendering.
- **Email sent popup still appears after compose send** — the "email sent" toast/bar should not appear at all (or auto-dismiss immediately) for compose; only the undo bar should be visible.

**Legacy open bugs (from before session 27):**
- **New agent arrived as admin** — code-verified clean session 19; most likely an older invite token. Re-test with a fresh invite.
- **Personal inbox leaks across users** — check whether `diederik1710@icloud.com` has `users.inbound_email` set to Joost's address; clear if so.
- **Personal address only receives after first send** — likely test confusion; saving Profile should be sufficient.

**Manual / ops (Diederik):**
- ~~Cloudflare: delete the duplicate bare DMARC TXT at `_dmarc.getyippie.com`; keep only the one DKIM key shown in Resend at `resend._domainkey.getyippie.com`.~~ ✅ **DONE (2026-06-11)** — single DMARC record with Cloudflare `rua=` reporting, single DKIM verified, SPF verified.
- klimaatexamen tenant `inbound_email` is NULL → use Clients → Edit → Info tab (now available via [38c]).
- Set `INBOUND_EMAIL` in both live Railway envs before go-live.

**Deploy reminder:** both staging envs build the **`sandbox`** branch — ship with
`git push origin devsandbox:sandbox`, `/verify` in sandbox, then promote. `migrations/env.py`
takes a Postgres advisory lock so the two shared-DB containers can't race DDL.

---

## ▶▶ Performance initiative — ✅ COMPLETE

Top-priority "make the tool faster" pass — **all four steps shipped** (sessions 19, 22, 23, 24):
composite indexes + 5s poll + nginx gzip/cache (Step 1); async ingest with on-demand Generate
(Step 2); loading skeletons + vendor chunking + consolidated draft query (Step 3); `pg_trgm`
search indexes + lazy compose contacts + pool tuning + dropped RLS role-switch (Step 4). Root
causes and file refs are preserved in Appendix A (sessions 22–24). No remaining performance items.

---

## 🟣 Tier 1 — Big, complicated & creative → **Fable**

The heavy lifts: brand-new modules, cross-cutting features, and the creative/marketing work.

### New modules (Phase 10)
- **Email tracking module** — `Fable` — *not built.* `emailtracking` module: opens/clicks/delivery per outbound mail via Resend webhooks (`email.opened/clicked/bounced`); per-email status in Inbox/Sent; superadmin enable/disable per tenant.
- **Calendar module** — `Fable` — *not built.* `calendar` module: agent calendar of `follow_up_at` deadlines + standalone events tied to a contact/ticket; per-tenant toggle.
- **Pipeline module** — `Fable` — *not built.* Client-defined pipeline stages; customers auto-labeled by stage (builds on `[38]`); time-per-stage tracking; stage-triggered automated emails; per-tenant toggle.

> The **AI module** is already built — see ✅ Done. It's the `ai` per-tenant flag that switches on the AI extras across inbox + tickets (summaries, generate mail, suggested/improved replies, compose suggestions, autofilled ticket fields). With it off, none of that runs.

### Email templates (Phase 9 — creative)
- **[Phase 9] Template UX + AI insertion** — `Fable` — *backend partially exists* (`ResponseTemplate` model + `GET/POST /templates` in the tickets module). Still to build: `/settings/templates` CRUD page, "Insert template" in compose/reply, **AI-recommended** template based on the received email, company-wide + personal templates, and (optional) Resend-registered templates by ID.

### Contacts — workflow & data model (big)
- **[36] Company grouping for contacts** — `Fable` — *partial:* `company` is only a string field on Contact. Build a real `Company` entity (name, domain, notes) contacts belong to; company badge + filter/group; composing to a company auto-selects all its contacts.
- **[38] Contact labels** — `Fable` — *partial:* a `tags` array exists on Contact but there's no label model, CRUD, or filtering. Build tenant-defined labels so each client embeds **their own** workflow (`potential client`, `process step 1`, `after sales`, `potential client: demo`); CRUD in settings; assign 1+ per contact; filter by label; bulk-label from multi-select (`[20]`). Foundation for the Pipeline module + demo flow.
- **[30] Mail-all / broadcast system** — `Fable` — *not built.* `POST /admin/tenants/{id}/broadcast` (superadmin), batch send to all tenant contacts via Resend; needs rate limiting + opt-out tracking.

### Demo provisioning (Phase 12 — cross-cutting)
- **[Phase 12] Demo-request → auto-provisioned demo** — `Fable` — *foundations exist* (demo mode blocks real sends; `go_live_job` scheduler flips demo→active). Still to build: public request-demo form → auto-create `is_demo=true` tenant in live → set-password invite → 7-day auto-inactivate expiry job → notify `diederik@` → save prospect as Contact labeled "potential client: demo" → open a 3-day follow-up ticket. Plus **build-first, invite-later** (create in demo with no admin; send invite from Settings when ready; then flip to live). Reuses `auth/invite.py`, `admin/service.py create_tenant`.

### Onboarding (big)
- **[21] Client onboarding wizard** — `Fable` — *partial* (a create flow shipped session 17). Full guided multi-step redesign: company+contact+admin email → modules → branding → extra admins → demo/go-live; invite email on creation.

### Architecture & infra
- **PostgreSQL RLS policies** — `Fable` — *partial:* `set_tenant_context` sets `app.current_tenant_id` and an `enable_rls` migration + `app_user` grants exist, but the actual row-level **policies aren't enforced yet**. Write + enable them as defense-in-depth.
- **Per-tenant custom domain** — `Fable` — *not built.* `acme.getyippie.com` → shared Railway service (subdomain/slug-based tenant routing; no public slug-config lookup before login).
- **Mobile web** — `Fable` — *not built.* Responsive layout (sandbox + devsandbox first).
- **Billing / plans per client** — `Fable` — billing module (invoices/subscriptions) exists; still need a `Tenant.plan` field that **gates advanced features**.
- **Customer data + AI briefing** *(architecture decision)* — `Fable` — define where full contact history is stored; the AI briefing (already running) must pull complete history.

### Marketing site — creative (Phase 11)
- **[Phase 11 A] Copy & branding** — ✅ **DONE (session 26).** Hero → "Take back the time that matters."; support-automation sub copy; "Start for free" / "Sign up" → "Request demo →" across hero, nav, CTA section, pricing cards; `NEXT_PUBLIC_DEMO_URL` env var (falls back to `APP_URL` until Phase 12 form is built). Logo replacement still open (need Diederik's current logo file).
- **[Phase 11 B] The Hour Counter (live ticker)** — ✅ **DONE (session 26).** `GET /api/v1/public/stats` (unauthenticated) in `apps/app/backend/app/public/router.py`; counts cross-tenant tickets × 15 min ÷ 60 + `BASE_HOURS_SAVED` (env, default 10 000). `HourCounter` client component on the marketing site fetches on mount, animates count-up with ease-out cubic over 2s, falls back to 10 000 on error. `getyippie.com` + `www.getyippie.com` added to CORS allowlist.
- **[Phase 11 C — Tier 1] On-page ROI calculator** — ✅ **DONE (session 26).** Five sliders (tickets/mo, min/ticket, staff, hourly cost, automatable %) → hours saved, € saved/month, payback vs €29/mo plan. Pure-frontend `ROICalculator` component between "How it works" and Pricing. `NEXT_PUBLIC_DEMO_URL` wired to its CTA.
- **[Phase 11 C — Tier 2] "Connect your inbox" ROI estimate** — `Fable` — *not built.* Pursue **CSV / mailbox-export upload first** (parsed in-browser, best privacy/effort); one-time IMAP/OAuth scan next; Gmail/Workspace metadata add-on last (flag the OAuth verification + restricted-scope security assessment cost up front). "We never read your email content."

---

## 🔵 Tier 2 — Medium → **Opus**

Standard feature builds — well-scoped, mostly with existing patterns/endpoints to reuse.

### Contacts & data import (none of these exist yet)
- **[29] Contact CSV import** — `Opus` — `POST /contacts/import` multipart; validate, dedupe by email, bulk insert; upload widget + results summary.
- **[40] Contact import — JSON + Excel** — `Opus` — extend `[29]` to also accept JSON and `.xlsx` with the same validate/dedupe/summary flow.
- **[37] Import users / staff from CSV** — `Opus` — `POST /admin/users/import` (own tenant) / `POST /admin/tenants/{id}/users/import` (superadmin); columns name/email/role; validate, dedupe, bulk-invite via Resend; upload widget in Settings → Team. (Platform users, not contacts.)
- **[20] Multi-select contacts** — `Opus` — checkbox per row + action bar (admins/superadmins): Compose (prefill emails), Export CSV, Label (`[38]`), Delete (soft, `[39]`). Backend bulk contact endpoints don't exist yet either.
- **[39] Contact soft-delete + retention** — `Opus` — add `contacts.deleted_at` (reuse the `tickets.deleted_at` pattern, session 17): retain 1 month, filter/restore within the window, scheduled purge after.

### Superadmin / client management
- **[38c] Per-client edit modal (UX redesign)** — ✅ **DONE (session 27).** "Edit modules" button replaced with "Edit" opening a 3-tab modal: Info (name, inbound_email, slug readonly), Modules (module toggles), Branding (primary_color, logo_url + preview). All fields patch via the existing `PATCH /admin/tenants/{id}`. Status buttons kept inline.
- **[38d] Manage client users from the edit modal** — `Opus` — *partial:* a separate `TenantUsersModal` already lists/adds users; the work is folding add/remove/inactivate into the unified `[38c]` Edit modal (reuse `GET /team/users`, `POST /team/invite`, `PATCH /team/users/{id}`).
- **[31] Demo environments (template data)** — `Opus` — *partial:* demo mode exists; still need a seed template dataset per demo tenant + a superadmin "Reset to demo" that wipes real data and restores the seed.

### Branding & marketing
- **Branding wiring into the app shell** — ✅ **DONE (session 27).** Sidebar background now reads `primary_color` from tenant config via inline style; the Yippie SVG mark always shows, client `logo_url` appears below it when set. Seed.py now syncs `primary_color` + `logo_url` from config on every deploy; all defaults updated to `#5BA4F5`.
- **[Phase 11 C — Tier 1] On-page ROI calculator** — ✅ **DONE (session 26)** — see Tier 1 entry above.

### Promotion & identity (Phase 13)
- **Promotion: devsandbox → sandbox → live** — `Opus` — push prototype 2.0 to `dev` + `app`; set `diederik@getyippie.com` (individual) + `support@getyippie.com` (shared) on `dev`; sandbox keeps `sb-support@`.
- **Send-from aliases + app tour** — `Opus` — single personal mailbox already shipped (`reply_from_email`/`inbound_email`); add a Profile setting for extra "send from" aliases; build a guided in-app tour after first login (welcome email already shipped).

---

## 🟢 Tier 3 — Quick & easy wins → **Sonnet**

Small, well-bounded changes — UX polish and config/ops one-liners.

### UX polish
- **[35-backlog] More hotkeys** — `Sonnet` — *only `Cmd/Ctrl+Enter` exists today.* Add `c` compose, `r` reply, `e` archive/process, `j`/`k` next/prev, `/` focus search, `Esc` close, `g i` go to inbox.
- **[43] Ticket deadline reminder toast** — `Sonnet` — *banners + sidebar badge already shipped (`[34]`);* add the small toast when a ticket nears `follow_up_at`.
- **[48] Clickable rows everywhere** — `Sonnet` — *mostly done* (inbox cards + contact rows open on full-row click); finish the convention on any remaining lists (e.g. tickets) and treat it as standing.
- **[8c] Status column labels** — `Sonnet` — show "Active"/"Inactive"/"Demo" as clear text labels in the Clients tab; allow changing status directly from that column.
- **[6c] Bulk delete clients** — `Sonnet` — add a Delete action to the existing bulk status bar (stays password-gated, `[24]`).
- **Spam → Resend sender block** — `Sonnet` — bulk "spam" already moves drafts to the spam status + retention; still add the call to block the sender in Resend (the one remaining piece of `[12]`).

### Config / ops one-liners
- **getyippie.com 502 fix** — `Sonnet` — Cloudflare proxy toggle (orange→grey→wait→orange) for Railway domain verification.
- **[Phase 13] Invite-link base URL** — `Sonnet` — code already done (`CLIENT_BASE_URL`); just set Railway env vars: devsandbox → `https://sandbox.getyippie.com`, dev → `https://app.getyippie.com`.
- ~~**[Phase 13] Deliverability cleanup**~~ ✅ **DONE (2026-06-11)** — single DMARC + single DKIM (verified) + SPF (verified). DNS is clean.
- **`diederik@getyippie.com` personal account on live** — `Sonnet` — make it the working primary address in the live pair (receiving already verified).
- **`INBOUND_EMAIL` in live Railway envs** — `Sonnet` — currently unset in both live envs; set before go-live.

---

## ✅ Done

**Foundations & infra:** Resend inbound+outbound email; 30s email poller; APScheduler jobs (poller 30s, enrichment 10s, pending-send flush 5s, retention 1h, SLA escalation 5m, auto-close 1h, go-live 60s); all four Railway environments healthy; full **Performance initiative** (Steps 1–4).

**Multi-tenant correctness:** **per-tenant webhook routing** by `inbound_email` + slug fallback (`core/tenant.py`, `email_poller.py`) — the old "route everything to tenant #1" stub is gone; **`is_active` login-blocking**, **`is_demo`** blocking real sends, **`go_live_at`** auto-activation scheduler (`go_live_job`, 60s); `set_tenant_context()` per request.

**Auth & client management:** critical path A/B/C complete — settings page (`[25]`), registration/invite (`[26]`), forgot/reset password (`[27]`), superadmin invite (`[28]`), delete client/superadmin password-gated (`[24]`), **impersonation / "view as" (`[23]`)** — `POST /admin/tenants/{id}/impersonate` 1-hr token + amber banner, client list filter + demo tick (`[5]`), bulk status change (`[6]`), company name in sidebar (`[7]`), hide own env (`[8a]`), scoped superadmin management (`[8b]`), separate add-admin + tenant-users modals.

**Inbox:** stay-in-window + undo approve/reject (`[10]`), DeptReminderModal with dept+SLA in popup (`[11]`), filter processed by status (`[13]`), language-matching replies (`[15]`), reply-to-email fixed across 4 stacked bugs (`[16]`), undo send incl. compose (`[17]`) + **undo-send UI polish/auto-dismiss (`[47]`)**, attachments incl. compose (`[18]`) + **attachment chips with x-to-remove (`[45]`)**, modules order at the source (`[19]`), duplicate-send fix (`[32]`), delete tickets (`[33]`), ticket deadline banners + **glowing sidebar badge (`[34]`/`[14]`)**, `Cmd/Ctrl+Enter` send (`[35]`), **scroll-only inbox + larger compose (`[9]`)**, Sent view (`[41]`), **Spam/Bin views + bulk bin/spam action (`[12]`)**, **Spam→Bin (10d) / Bin purge (20d) retention scheduler (`[42]`)**, reply-subject language (`[44]`), nice HTML outbound email (`[46]`), per-user email signatures.

**Email templates (backend):** `ResponseTemplate` model + `GET/POST /templates` in the tickets module (UI + AI insertion still in Tier 1).

**AI module:** the `ai` per-tenant flag (`require_module("ai")`, on for every tenant) switches on all the AI extras across **inbox + tickets** — incoming-mail scan that **autofills the ticket fields** (`ai_suggested_subject/description/priority/category`), the inbox **briefing/customer summary** (`generate_context_summary` → `context_summary`), and the **generate / suggest-reply / improve-reply / compose-suggest** actions. Turn the module off and none of it runs. (No separate nav page — it's the AI capability layer itself.)

> Full per-item detail, bug histories and commit refs are preserved in **Appendix A — Session log**.

---

## Open questions

- **Sandbox email routing** — `devsandbox` and `sandbox` share one Sandbox DB, so inbound to either `dev-support@`/`sb-support@` surfaces in both; the inbox follows the login, not the URL. Document as intentional, or split per `INBOUND_EMAIL` if true isolation is wanted.

---

## 📎 Appendix A — Session log

---

### Session 28 — 2026-06-11 (deadline-indicator redesign + next-session reconciliation)

Read ROADMAP + handoff, reconciled the session-27 "Next session" bug list against the actual
code: the inbox sticky select-all, inbox pagination (9/page), ticket-list layout, compose footer
stability, redundant sent popup, client-modal Actions tab, and per-user hotkeys toggle all
already shipped in **PR #20 (`3e86a8f`)**, and the ndugu from-address bug was already fixed in
`9414789`. Only the **deadline-indicator redesign** remained as concrete, well-specified work.

**Deadline indicator — per-tenant severity dots (this session):**
- **Backend** — migration `a7b8c9d0e1f2` adds `tenants.deadline_red_days` (default 1) +
  `deadline_orange_days` (default 2), idempotent `ADD COLUMN IF NOT EXISTS`. `Tenant` model +
  columns. New `tickets/service.py deadline_severity(red_days, orange_days)` buckets open/
  in-progress tickets: **red** = overdue or due within the red window, **orange** = due within
  the orange window beyond red; returns `{severity, count, red, orange}` (severity = most urgent
  non-empty bucket). `GET /tickets/deadline-count` now loads the tenant's thresholds and returns
  the bucketed result (old `{count}` key kept). New admin-gated
  `GET/PATCH /departments/deadline-settings` to read/update the two thresholds.
- **Frontend** — `Sidebar.tsx` replaces the red count badge on the Tickets nav with a coloured
  dot (red pulsing / orange) driven by `severity`, with a tooltip count; no dot when fine.
  `DepartmentsPage.tsx` gains a **Deadline indicator** card (two day-threshold inputs + Save,
  invalidates the deadline-count query on save). 60s Sidebar poll picks up changes.
- Verified: backend `py_compile` clean; frontend `tsc --noEmit` + `vite build` clean.

**Audited, no code defect found (need sandbox repro):** Activity page (`/activity` +
`/activity/stats` + route registration all correct — likely just an empty event log) and the
"Settings page broken" report (all `/settings/*` routes registered, pages build clean).

---

### Session 27 — 2026-06-11 (branding wiring, [38c] edit modal, attachment bugs, compose auto-dismiss)

**Branding wiring (commit `53ba33b`):**
- `Sidebar.tsx`: sidebar background now uses `config.branding.primary_color` via inline style (replaces hardcoded `bg-yippie #5BA4F5`). Yippie SVG mark always renders; client `logo_url` shown below it when set.
- Badge (`text-yippie`) → inline `style={{ color: config.branding.primary_color }}`.
- `config.py` default `primary_color` updated from `#2563EB` → `#5BA4F5` (matches Tailwind `bg-yippie`).
- `seed.py`: when seed tenant already exists, syncs `primary_color` + `logo_url` from config on every deploy.
- `schemas.py` + `SuperAdminPage EMPTY_FORM`: new-tenant default updated from `#5BB8E8` → `#5BA4F5`.

**[38c] Per-client edit modal (commit `53ba33b`):**
- `SuperAdminPage.tsx`: replaced `EditModulesModal` with a 3-tab `EditClientModal` (Info / Modules / Branding).
- Info tab exposes `name` and `inbound_email` per client — fixes the klimaatexamen NULL inbound_email without needing a direct DB update.
- Branding tab lets superadmin change `primary_color` and `logo_url` with live preview.
- Row button renamed "Edit modules" → "Edit".

**Attachment bug fixes (commit `c87f7fa`):**
- `email_poller.py`: stores attachment `content` (base64) inline in `attachments_json` at poll time. Resend has no separate attachment download endpoint — the old proxy was calling a non-existent URL and returning empty.
- `router.py`: `download_attachment` now serves from stored content directly; removed the phantom Resend API call. Dropped unused `httpx` import.
- `mailer.py`: Resend's attachments field only accepts `{filename, content}` — stripped the `content_type` key that was causing Resend to reject or silently drop attachments on outbound sends.
- `InboxQueue.tsx`: added `onError` + `sendError` state to `ComposeModal`; compose send failures now show a red error message.

**Compose auto-dismiss (commit `01c9352`):**
- `InboxQueue.tsx`: success screen auto-closes after 3s via `useEffect` timeout. Demo mode stays open (agent needs to read the suppression notice).

**Open from session 27 verification (→ Next session):**
- Inbox select-all sticky, pagination (9 per page), ticket list UI redesign, deadline indicator dots, configurable threshold in Settings, hotkeys toggle in Profile, activity page not working.

---

### Session 26 — 2026-06-11 (Phase 11A copy+branding, Phase 11C ROI calculator, Phase 11B Hour Counter)

All three marketing-site Tier-1 Fable items shipped in one session.

**Phase 11C — On-page ROI calculator (session 26, commit `307e22d`):**
- New `"use client"` component `ROICalculator` with five range sliders (tickets/mo 200,
  min/ticket 15, staff 2, hourly €35, automatable 60%). Live-computed outputs: hours saved,
  € saved/month, payback vs €29/mo plan ("Instant ROI" / "X days" / "X months"). Pure
  browser math, no data sent anywhere. Inserted between "How it works" and Pricing.
- Also fixed two pre-existing `next build` breakages: CSS Modules global-selector error in
  `page.module.css` (moved to `globals.css`) and `next.config.mjs` empty-string env fallback
  that caused `new URL("")` to throw during static prerender.

**Phase 11A — Copy & branding (session 26, commit `5504866`):**
- Hero title → "Take back the time that matters."; sub copy updated to the roadmap version.
- All primary CTAs ("Start for free", "Get started") → "Request demo →" pointing to
  `NEXT_PUBLIC_DEMO_URL` (falls back to `APP_URL` until Phase 12 form ships).
- Nav: added "Request demo →" as primary button alongside "Log in" link.
- New `.navLogin` CSS class for the muted "Log in" link style.
- Note: **logo replacement still open** — need Diederik to supply the current logo file.

**Phase 11B — Hour Counter (session 26, commit `5504866`):**
- `GET /api/v1/public/stats` — unauthenticated endpoint in new `apps/app/backend/app/public/`
  module. Counts `tickets WHERE deleted_at IS NULL` cross-tenant × 15 min ÷ 60 +
  `BASE_HOURS_SAVED` (env var, default 10 000). Returns `{hours_saved, tickets_automated}`.
  Mounted in `main.py` without auth dependencies.
- `HourCounter` client component on the marketing site: fetches on mount, animates count-up
  from 60% of target over 2s (ease-out cubic with RAF), falls back to 10 000 on error.
  Placed between the stats bar and Features.
- `getyippie.com`, `www.getyippie.com`, `localhost:3000` added to `cors_origins` default in
  `config.py` so browser fetch from the marketing site works without extra Railway env vars.

**Deployed:** both commits pushed `devsandbox → sandbox`.

**Remaining Phase 11 items:**
- Logo replacement (need the file from Diederik).
- Phase 11C Tier-2 "Connect your inbox" estimate (CSV upload → in-browser analysis).

---

### Session 25 — 2026-06-11 (outbound email quality: HTML layout + per-user signatures)

Performance done, remaining bugs are sandbox-verification-only → picked the
highest-leverage filed dev items: item 46 + email signatures (they pair: the
signature renders inside the HTML layout).

- **HTML email layout (item 46)** — new `app/core/email_html.py`:
  `render_email_html(body_text, tenant_name, primary_color)` wraps the plain
  text in a deliverability-safe inline-styled shell (tenant accent bar +
  name header, `<p>` paragraphs from blank-line splits, auto-linked URLs,
  "Sent with Yippie" footer). No template engine — one f-string until Phase 9.
  `send_email()` gained an optional `html=` param; `"text"` always sent too.
  Wired everywhere: `flush_pending_sends` (reply + compose; tenant fetched
  once per tenant_id — replaces the demo-only cache), `forward_draft`,
  invite mail, welcome-to-inbox mail, forgot-password mail.
- **Per-user email signatures** — `users.email_signature` (Text, migration
  `d1e2f3a4b5c6`, idempotent ADD COLUMN IF NOT EXISTS; single head after
  `c0d1e2f3a4b5`). `UserSelfUpdate`/`UserOut` + `/auth/me` PATCH handle it;
  Profile page has a signature textarea. Compose + reply textareas pre-fill
  `\n\n{signature}` (visible and editable — what you see is the text part);
  AI suggest-reply / forward / compose-suggest append the signature below the
  generated text. No double-append: the HTML renderer styles whatever text is
  in the body, signature included.
- Verified: backend `py_compile` clean; renderer output eyeballed (escaping,
  links, paragraphs); frontend `tsc --noEmit` + `vite build` clean.
- **For Diederik (sandbox):** set a signature on Profile → compose + reply
  should pre-fill it; received mail should be the new HTML layout (accent bar
  in tenant color) in Gmail/Apple Mail; invite + reset mails get clickable links.

### Session 24 — 2026-06-11 (Performance Step 4: trgm search, lazy compose, pool tuning, RLS role-switch dropped; API diagnostics compacted)

**Background task (concurrent):**
- **Compact API diagnostics bar** (`ff4903a`) — `ResendDiagnosticPanel` in
  `SuperAdminPage.tsx` now a single header row (icon · label · Copy all · Run check)
  with a collapsible `max-h-64` pre-block below; removed the explanatory paragraph.

**Performance Step 4 (commit `1e44346`):**
- **`pg_trgm` GIN indexes** — migration `c0d1e2f3a4b5` adds `pg_trgm` extension
  (idempotent) and GIN indexes on `contacts.full_name`, `email`, `company`
  (`gin_trgm_ops`). The existing `ILIKE '%term%'` query in `contacts/service.py`
  now uses the indexes instead of a seq-scan on every keystroke.
- **Lazy compose contacts picker** — `ContactSearchPicker` no longer fires the
  `limit=1000` query when the compose dropdown opens. "All contacts" button uses
  `useQueryClient().fetchQuery` on click (60s stale); shows "Loading…" while
  fetching; no unnecessary round-trip on compose open.
- **Explicit pool settings** — `database.py` now has `pool_size=5, max_overflow=10,
  pool_timeout=30`; was previously using SQLAlchemy defaults (same values, but now
  explicit and documented).
- **RLS role-switch dropped** — `set_tenant_context` simplified from 4+ SQL
  round-trips to 1. The `SAVEPOINT / SET LOCAL ROLE app_user / RELEASE` block is
  gone; `SET LOCAL app.current_tenant_id` kept as the hook for future RLS policies.
  Decision: defer RLS enforcement until policies are actively written.

**Code audit — items confirmed complete, no changes needed:**
- Item 11 (DeptReminderModal redesign) — fully done since session 20; modal always
  shows on approve when departments exist, has "No dept" + "No SLA" options.
- Items 12 (bulk select/delete/spam), 45 (attachment chips), 47 (undo auto-dismiss)
  — all confirmed in source; await sandbox verification by Diederik.

**Personal-address-receive-after-send bug** — code-verified correct: the poller
builds `get_inbound_email_map` from `users.inbound_email` on every 30s cycle;
saving the Profile address is sufficient to receive. No send is needed. The
phenomenon is most likely a timing/test confusion. Closing as no-fix.

**Deployed:** `git push origin devsandbox && git push origin devsandbox:sandbox`

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

## 📎 Appendix B — Reference

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
