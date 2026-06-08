# Yippie — Roadmap
**Updated:** 2026-06-08 (session 14)

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
- ✓ Reply-to-email bug fixed — wrong `Content-Type` header on the FormData request was
  silently breaking every reply send (and hiding the undo-send bar behind it)
- ✓ Module order normalization — `enabled_modules` now always saved in canonical
  `ALL_MODULES` order so the data-driven sidebar renders consistently
- ✓ "Back" buttons removed from Draft Ticket panel
- ✓ AI Briefing rewritten to return short keywords instead of a paragraph — testing
  this format with Diederik

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

### 8c. Status column labels (pending)
- Clients tab status column should show "Active" / "Inactive" / "Demo" as text labels clearly — verify pill text is readable and consistent across all views

---

## Phase 3 — Inbox UX

### 9. Inbox layout: scroll-only email list, larger compose
- Email list column scrolls; header + tabs stay fixed
- Compose modal: make wider/taller, textarea gets more space

### 10. Stay in email window after approve/reject ✓ DONE (mostly)
- After approve or reject: don't navigate away — shipped session 12
- Show a confirmation state in the Draft Ticket panel ("✓ Approved — ticket #123 created")
- "Back" / "← Back to Inbox" buttons removed from the panel entirely (session 14) —
  Diederik felt they "didn't make sense" once the agent stays on the page after acting;
  exit is via sidebar nav now
- **Still open — new asks from Diederik:**
  - Add a clear "✗ Rejected" overlay/state on the ticket panel mirroring the existing
    "✓ Approved" treatment (`DraftReview.tsx` ~line 630, the `context_summary`/AI
    Insights block in the processed view) — right now a denied draft has no equivalent
    visual confirmation
  - "Undo approve / reject" from the mail window — needs a backend endpoint to revert
    `draft_ticket.status` (and the ticket it created, if approved) plus a button in the
    processed view

### 11. Department/SLA reminder on approve — needs redesign
`DeptReminderModal` exists (`DraftReview.tsx`) and offers "Approve without department" /
"Go back and set department". Diederik's new asks to fold into a redesign:
- Let the agent pick **department AND SLA directly from the popup**, instead of bouncing
  back to the form to set them
- Add an explicit **"No department"** option and a **"No SLA"** option in the route
  picker itself — currently you can leave both empty with no signal either way
- **Also trigger this popup when a department IS picked but no SLA is set** — Diederik
  hit this directly: "i was able to select a department without sla, without
  notification. this should also open up the popup"

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

### 15. Language-matching replies ✓ DONE
- Shipped in `7967bac`: badge in the reply panel header shows "Reply in {language}"
  when `draft.detected_language` is set and ≠ English (`DraftReview.tsx`, ~line 729)
- Verified the code path looks correct — no issues found

### 16. Reply to email in inbox — was BROKEN, now FIXED (session 14)
**Root cause found and fixed:** `handleSendReply()` (`DraftReview.tsx` ~line 347) built
a `FormData` body for `POST /inbox/drafts/{id}/send-reply` but manually set
`headers: { 'Content-Type': 'multipart/form-data' }`. Doing this with axios overrides
its auto-generated `boundary=...` parameter, so the backend's FastAPI multipart parser
couldn't read `reply_text`/`attachments` — every reply attempt failed before send.
**Fix:** removed the manual header; axios sets `Content-Type` (with correct boundary)
automatically for `FormData`. This was very likely also why the undo-send bar "didn't
appear" (item 17) — the request never succeeded, so the success branch that shows the
bar never ran. Both complaints traced to the same one-line bug.

### 17. Undo send ✓ DONE — but verify after the item-16 fix lands
Shipped in `7967bac`: floating "Yippie" bar with 5s progress + Undo button
(`DraftReview.tsx` ~line 896), backed by a `pending_sends` queue
(`queue_send`/`cancel_send`/`flush_pending_sends` in `service.py`, flushed every 1s by
`email_poller.py`). This looked fully wired up in code — it almost certainly wasn't
showing because every send was failing (see item 16). **Re-test in sandbox after the
fix deploys** — if it now appears and works, mark this fully done.

**Known secondary bug (not fixed yet):** replies **with attachments** bypass the undo
queue entirely — `router.py` (~line 140) has a comment acknowledging `PendingSend` has
no `attachments` field, so attachment-replies send immediately and return a fake
`undo_until` timestamp in the past. On the frontend this makes `duration` ≈ 0, so the
progress-bar math (`(now - start) / duration`) produces `NaN`/`Infinity` — the bar can
get stuck instead of completing cleanly. Proper fix: add an `attachments_json` column to
`pending_sends` (migration), thread attachments through `queue_send`/`flush_pending_sends`
so attachment-replies get the same 5s undo window as plain-text ones.

### 18. Attachments — partially built; gaps found (session 14)
Shipped in `7967bac` for the **reply** flow only:
- Reply panel: file picker + chips showing filename + remove button
  (`DraftReview.tsx` ~line 778 — "Attach" button + `{f.name}` shown next to it ✓)
- Inbound messages: attachment list + download proxy via Resend
- Backend: `attachments_json` column, `mailer.py` sends via Resend's attachment API

**Gaps Diederik is hitting:**
- **Compose modal has no attachment support at all** — `InboxQueue.tsx` has zero
  attachment code (no Paperclip/Attach/FormData). This is very likely what "attachments
  not working when i upload from yippie" refers to — the only place to attach a file
  today is the *reply* panel inside an open draft, not the main Compose flow
- The `pending_sends` gap from item 17 (attachment-replies skip the undo queue)
- **Action:** add the same file-picker + filename-chip UI to the Compose modal in
  `InboxQueue.tsx`, reusing the pattern already proven in `DraftReview.tsx` ~line 778-790,
  and wire it through the existing `send_email`/attachments backend support

### 19. Modules order matches sidebar ✓ DONE — root cause of "wrong order" found & fixed
Shipped in `7967bac`: `Sidebar.tsx` now renders nav items by iterating
`config.enabled_modules` in **DB order** (a deliberate "sidebar follows tenant config"
design). The catch: `enabled_modules` was being saved in *toggle-click order*, not a
canonical order — so each tenant's array (and thus its sidebar) ended up in a different,
arbitrary sequence. That's why Diederik saw "Contacts, Tickets, Inbox, Live Chat,
Billing, Activity" live instead of the `ALL_MODULES` order.
**Fixed (session 14):** `SuperAdminPage.tsx` `toggleModule`/`toggle` now always rebuild
the array by filtering the canonical `ALL_MODULES` list, so any save — including just
opening "Edit modules" and clicking Save without changing anything — persists modules in
the correct order. **Diederik: open Edit modules for your own tenant and click Save once
to normalize its `enabled_modules` order; the sidebar will then match.**

---

## Phase 4 — Contact management

### 20. Multi-select contacts
- Checkbox per contact row
- Action bar when ≥1 selected:
  - **Compose** → pre-fills Compose modal with all selected emails
  - **Export CSV** → download name, email, company, phone, tags
  - **Delete** → soft delete with confirmation

---

## Phase 5 — Client onboarding control plane

### 21. Client onboarding wizard
Guided multi-step flow in SuperAdminPage when creating a new client:
1. Company name + contact name + admin email
2. Modules toggle
3. Branding (color, logo)
4. Add additional admin users
5. Status: start as demo or go live immediately
- Admin email is promoted to admin role (not superadmin)
- After creation: invite email sent via Resend so admin can set their own password

### 22. Client environment management from dev
- From dev.getyippie.com, Diederik sees all client tenants
- Can activate / deactivate / set to demo from the list
- Clients created in dev automatically appear in app.getyippie.com (shared DB — already works)
- The "client app" is their isolated tenant in the shared deployment — no separate Railway env per client

### 23. Access all client environments from dev
- From SuperAdminPage, "Impersonate" button per client → logs in as their admin (generates short-lived token)
- Lets Diederik test/debug a client's environment without knowing their password

### 24. Delete client with password protection
- Deleting a client + their environment requires password confirmation (diederik1710@gmail.com)
- Wipes all tenant data after confirmation; irreversible

---

## Phase 6 — User management

### 25. Repair settings page
- `/settings/profile` — update name, email, **change own password** (important)
- `/settings/team` — invite/manage users for this tenant (admin only)
- `/settings/departments` — already exists
- Sidebar: admin sees Profile + Team + Departments; superadmin also sees Superadmins link

### 26. User registration / invite
- Admin creates invite → signed token emailed via Resend
- `/register?token=xxx` → user sets password, gets assigned role
- Backend: `POST /admin/invite`, `POST /auth/register` (token-gated)

### 27. Forgot password
- `/forgot-password` → enters email → receives reset link via Resend
- `/reset-password?token=xxx` → sets new password
- Backend: `POST /auth/forgot-password`, `POST /auth/reset-password`

### 28. Superadmin invite flow (from dev)
- "Create superadmin" panel in dev (below "Create client")
- Flow: password-verification popup (root owner confirms) → new window: name + email → invite email sent via Resend → new superadmin sets password via link
- Sandbox superadmins only have superadmin access in sandbox DBs, not live

---

## Phase 7 — Data & communications

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

## Phase 10 — Additional modules

### Email tracking module
- New `emailtracking` module — tracks opens, clicks, and delivery events per outbound email sent via Resend
- Webhook receives Resend tracking events (`email.opened`, `email.clicked`, `email.bounced`, `email.complained`)
- Stores events in DB linked to the outbound message; shows per-email status in Inbox and Sent views
- Superadmin can enable/disable per tenant from Clients tab in dev

### AI tools module
- New `aitools` module — exposes AI-powered utility tools to users inside the platform
- Examples: summarise contact history, auto-categorise tickets, draft department responses
- Superadmin can enable/disable per tenant via the Clients tab in dev (toggle in `enabled_modules`)
- Extensible: add new AI tools without rebuilding core platform

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

## Open questions (investigate, not yet actionable)

- **Superadmin without password** — second superadmin was created but never set a password, yet can log in. Investigate how promote-superadmin sets credentials; likely auto-generates a password. Document and fix so invite-email flow is the only path.
- **Sandbox email routing** — sending from diederik_test sends via `sb-support@getyippie.com`; replies go to sandbox connected to diederik1710@gmail.com. Document how the Resend routing/webhook is wired so this is intentional and not a side effect.

---

## Deploy workflow (app repo)

```
git push origin devsandbox   # → deploys devsandbox.getyippie.com
git push origin sandbox      # → deploys sandbox.getyippie.com (keep in sync, shared DB)
```

## Monday review workflow

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
