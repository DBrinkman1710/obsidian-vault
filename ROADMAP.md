# Yippie — Roadmap
**Updated:** 2026-06-05 (session 9)

---

## What's done

- ✓ Resend email system (inbound + outbound)
- ✓ Email poller (30s, body fully populated)
- ✓ is_active / is_demo / go_live_at / inbound_email on Tenant
- ✓ Multiple admin users per client
- ✓ Promote superadmin (password-protected)
- ✓ Demo banner for clients in demo mode
- ✓ SuperAdminPage: toggles, add admin, go-live, demo, promote, diagnostic

---

## Phase 1 — Critical bugs (do first, blocking everything)

### 1. devsandbox ↔ app isolation bug
**Symptom:** Emails tested in devsandbox appear in app (production).
**Cause:** `DATABASE_URL` in devsandbox points at the production DB instead of the sandbox DB.
**Fix:** Railway → Dev Sandbox env → Variables → confirm `DATABASE_URL` = sandbox Postgres URL (not production). These must be different Postgres instances.

### 2. Dev settings page broken
**Symptom:** Superadmin at dev.getyippie.com can't reach settings.
**Cause:** `require_admin` dependency may be running under `app_user` role (restricted PG role), or sidebar hides Settings for superadmin.
**Fix:** Debug `Sidebar.tsx` settings visibility + `auth/dependencies.py` RESET ROLE path for superadmin.

### 3. Activity tab broken
**Fix:** Debug data loading in `ActivityFeed.tsx` + verify API response shape.

### 4. Remove web from sandbox + devsandbox builds
**Fix:** In Railway dashboard → sandbox + devsandbox services → Settings → Watch Paths → exclude `apps/web`. Or configure `railway.json` in sandbox branch to only build `apps/app`.

---

## Phase 2 — Client management extensions (SuperAdminPage)

Items build on what was shipped in session 9.

### 5. Client list filter + demo tick in create modal
- Filter bar in SuperAdminPage: All / Active / Demo / Inactive
- Tick "Start as demo" in CreateClientModal (sets `is_demo = true` on create)
- Status pill per row (Active / Demo / Inactive) — already have Active/Inactive toggle, add Demo

### 6. Bulk status change
- Checkbox per client row + "Select all"
- Action bar appears when ≥1 selected: set Active / Demo / Inactive
- `PATCH` each in parallel

### 7. Hide own environment + account
- Filter out the Yippie tenant (slug = `yippie` or the seeded slug) from the client list
- Filter out own email from the superadmin list so neither can be made inactive by accident

### 8. Scoped superadmin management in settings
- `/settings/superadmins` page (superadmin only)
- List: name, email, active toggle
- Add new superadmin: name + email (invite or direct create)
- **Scope:** superadmins added here are only superadmin in the DB they're in (devsandbox superadmins ≠ production superadmins — this is already how the DB works, just needs clear UI)
- Protect deactivation with password confirmation

---

## Phase 3 — Inbox UX

### 9. Inbox layout: scroll-only email list, larger compose
- Email list column scrolls; header + tabs stay fixed
- Compose modal: make wider/taller, textarea gets more space

### 10. Stay in email window after approve/reject
- After approve or reject: don't navigate away
- Show a confirmation state in the Draft Ticket panel ("✓ Approved — ticket #123 created")
- Only auto-navigate back to inbox after BOTH the ticket action AND the reply are sent
- New "Done — back to inbox" button the agent clicks when they're finished

### 11. Department reminder on approve without route
- When agent clicks Approve with no department selected: modal pops up
- "No department set — add follow-up or approve anyway?"
- Options: set department + SLA days now, or approve without route, or cancel
- Also add "No SLA" option (no follow-up date)

### 12. Select + delete / spam mails
- Checkbox per draft card in InboxQueue
- Action bar: Delete selected / Mark as spam
- Deleted mails → new `DraftStatus.bin` (soft delete, visible in new Bin tab)
- Spam → `DraftStatus.spam` + call Resend API to block the sender address

### 13. Filter processed mails by status
- Add filter pills to Processed tab: All / Approved / Rejected / Forwarded / Bin

### 14. Glowing green dot in sidebar
- Move the live-fetch indicator from the inbox page header into the Sidebar nav item next to "Inbox"
- Pulse animation when `isFetching`; solid green when idle

---

## Phase 4 — Contact management

### 15. Multi-select contacts
- Checkbox per contact row
- Action bar when ≥1 selected:
  - **Compose** → pre-fills Compose modal with all selected emails
  - **Export CSV** → download name, email, company, phone, tags
  - **Delete** → soft delete with confirmation

---

## Phase 5 — Client onboarding control plane

### 16. Client onboarding wizard
Guided multi-step flow in SuperAdminPage when creating a new client:
1. Basic info (name, slug, admin credentials)
2. Modules toggle
3. Branding (color, logo)
4. Add additional admin users
5. Status: start as demo or go live immediately

### 17. Client environment management from dev
- From dev.getyippie.com, Diederik sees all client tenants
- Can activate / deactivate / set to demo from the list
- Clients created in dev automatically appear in app.getyippie.com (shared DB — already works)
- The "client app" is their isolated tenant in the shared deployment — no separate Railway env per client

### 18. Access all client environments from dev
- From SuperAdminPage, "Impersonate" button per client → logs in as their admin (generates short-lived token)
- Lets Diederik test/debug a client's environment without knowing their password

---

## Phase 6 — User management

### 19. Repair settings page
- `/settings/profile` — update name, email, password
- `/settings/team` — invite/manage users for this tenant (admin only)
- `/settings/departments` — already exists
- Sidebar: admin sees Profile + Team + Departments; superadmin also sees Superadmins link

### 20. User registration / invite
- Admin creates invite → signed token emailed via Resend
- `/register?token=xxx` → user sets password, gets assigned role
- Backend: `POST /admin/invite`, `POST /auth/register` (token-gated)

### 21. Forgot password
- `/forgot-password` → enters email → receives reset link via Resend
- `/reset-password?token=xxx` → sets new password
- Backend: `POST /auth/forgot-password`, `POST /auth/reset-password`

---

## Phase 7 — Data & communications

### 22. Klantenbestand migratiesysteem (contact CSV import)
- `POST /contacts/import` — multipart CSV upload
- Backend: validate, deduplicate by email, bulk insert
- Frontend: upload widget + results summary (imported / skipped / errors)

### 23. Mail-all system
- `POST /admin/tenants/{id}/broadcast` — superadmin only
- Sends to all contacts of a tenant via Resend batch
- Needs rate limiting + opt-out tracking

### 24. Demo environments (template data)
- Seed a template dataset per tenant in demo mode
- Superadmin can "Reset to demo" — wipes real data, restores template seed
- Protected with extra confirmation

---

## Phase 8 — Polish & advanced

- **Per-tenant custom domain** (`acme.getyippie.com` → shared Railway service)
- **PostgreSQL RLS** — row-level security policies as defense-in-depth
- **getyippie.com 502 fix** — Cloudflare proxy toggle for Railway domain verification
- **Billing/plans per client** — Tenant gets a `plan` field, gating advanced features

---

## Monday review workflow

1. Build in `devsandbox` branch
2. Sunday: PR `devsandbox → sandbox`
3. Monday: `/code-review ultra` + `/security-review` + `/verify`
4. If approved: merge `sandbox → production`

| Skill | When |
|---|---|
| `/code-review ultra` | Every PR — deep multi-agent review |
| `/security-review` | Before every production push |
| `/verify` | Confirm feature works end-to-end in sandbox |
| `/frontend-design` | Building or redesigning UI pages |
| `/ui-ux-pro-max` | Dashboards, settings, onboarding |
| `/tailwind-css-patterns` | Consistent Tailwind across all pages |
