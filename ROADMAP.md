# Yippie — Roadmap
**Updated:** 2026-06-05 (session 10)

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

## Access roles

| Role | Access |
|---|---|
| Superadmin | dev.getyippie.com + all client apps |
| Admin | Own client app only (can edit settings) |
| User | Own client app only (cannot edit settings) |

**Environments:** live = `app.getyippie.com` + `dev.getyippie.com`; sandbox = `sandbox.getyippie.com` + `devsandbox.getyippie.com`

---

## Phase 1 — Critical bugs ✓ DONE

- ✓ devsandbox ↔ app DB isolation fixed
- ✓ Dev settings page access restored
- ✓ Activity tab repaired
- ✓ Web removed from sandbox/devsandbox builds

---

## Phase 2 — Client management extensions (SuperAdminPage)

Items build on what was shipped in session 9.

### 5. Client list filter + demo tick in create modal ✓ DONE
- Filter tabs (All/Active/Demo/Inactive) with per-tab counts
- `is_demo` checkbox in CreateClientModal
- Unified status pill per row (Active/Demo/Inactive)
- TODO (Phase 6): switch from admin_password field to invite-email flow

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
- TODO (Phase 6): "Add superadmin" button with password-verify popup → invite email flow

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

### 15. Language-matching replies
- Reply subject and body must match the language of the received email
- Remove current default-to-English behavior; detect inbound mail language and use it for AI-generated replies

### 16. Attachments
- Received mails: display + download any attachments inline
- Compose modal: attach files (drag-and-drop or file picker)
- Reply modal: attach files to outbound replies

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

### 19. Delete client with password protection
- Deleting a client + their environment requires password confirmation (diederik1710@gmail.com)
- Wipes all tenant data after confirmation; irreversible

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

## Phase 9 — Email templates

### A. Resend email templates
- Register reusable templates in Resend dashboard; backend references them by template ID
- Fallback to inline HTML for templates not yet in Resend

### B. Mail templates in settings
- `/settings/templates` page — accessible to admins and superadmins
- Fields: name, subject, body, tags
- Full CRUD: create, edit, delete

### C. Template insertion for users
- "Insert template" button in compose modal and reply modal
- AI recommends a template based on the content of the received email
- User can edit the selected template or request AI improvement before sending

---

## Phase 8 — Polish & advanced

- **Per-tenant custom domain** (`acme.getyippie.com` → shared Railway service)
- **PostgreSQL RLS** — row-level security policies as defense-in-depth
- **getyippie.com 502 fix** — Cloudflare proxy toggle for Railway domain verification
- **Billing/plans per client** — Tenant gets a `plan` field, gating advanced features
- **Mobile web** — responsive layout for sandbox + devsandbox first, then promote to live
- **diederik@getyippie.com** — Diederik's personal account for live environments (app + dev)
- **Sandbox email address** — sandbox receives/sends from `sb-support@getyippie.com`; live uses `support@getyippie.com`
- **Personalized user emails** *(architecture question)* — per-user domain email (e.g. `joost@klimaatexamen.nl`) linked to Resend; shared inbox (`support@domain.com`) + personal inbox per agent; needs routing + inbox filtering design
- **Customer data + AI briefing** *(architecture decision)* — define where full contact history is stored (Contact model? Thread model?); AI briefing must pull complete history when a customer has many interactions

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
