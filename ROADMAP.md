# Yippie — Coding Advisor Plan & Roadmap

## Context

Diederik runs Yippie, a multi-tenant SaaS customer service platform. He wants:
1. A clear workflow for sandbox-based development
2. A Monday code review ritual before pushing to production
3. A prioritized, dependency-aware order for his roadmap
4. Clarity on which skills to use for which tasks

This is not an implementation plan — it is a working structure and roadmap.

---

## Environment Architecture (how it should work)

```
devsandbox branch → sandbox branch → production (app + dev envs)
     ↑                    ↑                  ↑
  Build features     Staging/QA         Live for clients
```

| Env | URL | Purpose |
|---|---|---|
| **dev** | dev.getyippie.com | Superadmin control plane — manage all client tenants |
| **production** | app.getyippie.com | Client-facing live app |
| **sandbox** | sandbox.getyippie.com | Staging (mirrors prod before release) |
| **devsandbox** | devsandbox.getyippie.com | Feature development & testing |

**Key rule:** dev = superadmin only. Clients never log into dev. Clients get their own isolated tenant in the shared `app.getyippie.com` deployment.

---

## Monday Review Workflow

Every week follows this cycle:

1. **Mon–Fri:** Work in `devsandbox` branch (local + devsandbox.getyippie.com)
2. **Sunday:** Open a PR: `devsandbox → sandbox`
3. **Monday:** Code review session with Claude Code
   - Run `/code-review ultra` on the branch
   - Run `/security-review` before any production push
   - Run `/verify` to confirm the feature works end-to-end
4. **Monday (if approved):** Merge `sandbox → production`

### Skills for Monday review

| Skill | When to use |
|---|---|
| `/code-review ultra` | Deep multi-agent review of the branch — finds bugs, security issues, architecture problems |
| `/security-review` | Before every production push — auth, RLS, injection, permissions |
| `/verify` | Confirm a specific feature works in the live sandbox app |
| `/frontend-design` | When building or redesigning UI pages |
| `/ui-ux-pro-max` | Comprehensive UI/UX for dashboards, settings, onboarding |
| `/tailwind-css-patterns` | Consistent Tailwind styling across all pages |

---

## Codebase Health Summary (current state)

### What works well
- FastAPI backend — clean async, all CRUD endpoints present
- Multi-tenant isolation via `tenant_id` + PostgreSQL session variable
- Inbox module — most complete feature (AI scanning, review workflow, send reply)
- Superadmin UI (`/superadmin/clients`) — list, create, update tenants
- Chat module — WhatsApp + live chat via WebSocket
- Auth + role hierarchy — superadmin/admin/agent/viewer implemented in backend

### What is broken or incomplete
- **Activity tab** — UI exists but may have display/data bugs (needs verification)
- **Settings page** — Only shows departments. Profile/account settings missing. Superadmin has lost access in dev.
- **Ticket detail page** — 99 lines, read-only. No status change, no comment composition, no assignment UI
- **Contact detail page** — Read-only, no edit form despite API supporting PATCH
- **Styling inconsistency** — Inbox/Sidebar use Tailwind; other pages use raw inline styles

### What is completely missing
- User registration / team invite flow
- Function to deactivate a client (no `is_active` on Tenant model)
- Multiple admin users per client app
- Email notification system (agent alerts, customer status change)
- Mass email / mail-all system
- Mail domain (custom sending domain per tenant)
- Demo/offline mode per client with superadmin go-live toggle
- Client data import (Klantenbestand migratiesysteem)
- Separate webhook routing between dev/sandbox and production (currently they share)

---

## Prioritized Roadmap (dependency order)

### Phase 1 — Fix Environment Isolation (do this first — everything else depends on it)

**Why:** Your devsandbox and app share the same inbound email webhook URL. When you test email in devsandbox, it creates real records in production's DB. You need isolated environments before building anything new.

Items:
- [ ] **Fix devsandbox ↔ app email link** — Add `ENVIRONMENT` env var to each Railway env. Register separate inbound email routes per environment (different POST URLs pointing to each Railway env). The backend already has `/api/v1/inbox/webhooks/email` — just configure your inbound email provider to route to each env's own URL.
- [ ] **Set up Sandbox Railway environment** — New env in Railway dashboard, connect to `sandbox` branch, add fresh Postgres, `sandbox.getyippie.com` domain.
- [ ] **Fix dev settings access for superadmin** — Sidebar shows Settings only to `admin+`. Debug why superadmin at dev.getyippie.com can no longer reach it.
- [ ] **Remove web from sandbox/dev branches** — `apps/web` (Next.js) does not need to be in `sandbox` or `devsandbox`. Options: (a) monorepo ignore pattern so Railway only builds `apps/app`, or (b) delete `apps/web` from those branches. Web has its own separate Railway env anyway.

### Phase 2 — Superadmin Power Tools (dev.getyippie.com as control plane)

Items:
- [ ] **Make client inactive** — Add `is_active: bool = True` to Tenant model + migration. `PATCH /admin/tenants/{id}` already exists — add `is_active` to allowed fields. Add toggle in SuperAdminPage.
- [ ] **Multiple admin users per client** — Add `POST /admin/tenants/{id}/users` endpoint (create additional admin for a tenant). Add "Add Admin" button to client detail in SuperAdminPage.
- [ ] **Make more superadmins from dev** — Add `POST /admin/promote-superadmin` endpoint, protected by `require_superadmin`. Add form in SuperAdminPage that asks for Diederik's password before promoting.
- [ ] **Demo/offline mode per client** — Add `is_demo: bool` and `go_live_at: datetime | null` to Tenant model. Superadmin can toggle "go live" per client. Clients in demo mode see a banner. Their data stays isolated; only visibility flag changes.

### Phase 3 — User Registration & Auth (client onboarding via dev)

Items:
- [ ] **User registration / invite flow** — Admin creates invite (generates a signed token). User receives email with link to `/register?token=xxx`. Sets own password. Gets assigned role. Backend: `POST /admin/invite`, `POST /auth/register` (token-gated).
- [ ] **Repair settings page** — Add `/settings/profile` route (update name, email, password). Admin sees: profile + departments + team members. Superadmin additionally sees: all tenants link.
- [ ] **Role enforcement in UI** — Admin can edit settings; agent/viewer cannot see Settings in sidebar. Currently backend enforces this — make frontend sidebar and routes match.

### Phase 4 — Email System (Resend)

**Provider:** Use [Resend](https://resend.com) for all outbound email. Replace the existing Mailgun-based `core/mailer.py` with a Resend client (`resend` Python SDK or direct HTTPS). Update `config.py` to swap `MAILGUN_API_KEY`/`MAILGUN_DOMAIN` for `RESEND_API_KEY` and `RESEND_FROM` env vars.

**Note on inbound email:** The current inbox webhook at `inbox/router.py:mailgun_webhook` receives customer emails routed by Mailgun. Resend does support inbound email routing too — when the time comes, this webhook can be adapted for Resend's inbound format (they POST a JSON payload vs Mailgun's form-encoded). This can be done as part of this phase or kept as Mailgun-inbound + Resend-outbound initially.

Items:
- [ ] **Replace mailer.py with Resend** — Rewrite `apps/app/backend/app/core/mailer.py` to use Resend API (`POST https://api.resend.com/emails`). Update `config.py`: remove `mailgun_*` settings, add `resend_api_key` and `resend_from`. Update Railway env vars accordingly.
- [ ] **Mail domain (Maildomain)** — Add `sending_domain` field to Tenant. Allow admin to configure their own verified sending domain via settings (must be verified in Resend dashboard). Backend uses `{from}@{tenant.sending_domain}` as the From address.
- [ ] **Email notifications** — New backend module `notifications/`. Trigger on: ticket status change, new ticket assigned, ticket comment added. Send via Resend. Agent/admin can opt out per notification type.
- [ ] **Mass email (Mail all systeem)** — `POST /admin/tenants/{id}/broadcast` — send an email to all contacts of a tenant. Superadmin-only. Uses Resend batch send. Needs rate limiting and opt-out tracking.

### Phase 5 — UI Repairs

Items:
- [ ] **Fix activity tab** — Verify data loads correctly. Add date filtering. Fix any display bugs.
- [ ] **Ticket detail UI** — Add comment thread UI, status change dropdown, assignee picker, priority selector. All API endpoints already exist.
- [ ] **Contact detail edit mode** — Add edit form to ContactDetail. API supports `PATCH /contacts/{id}`.
- [ ] **UI consistency pass** — Convert remaining inline-style pages to Tailwind. Use `/tailwind-css-patterns` skill.

### Phase 6 — Client Onboarding & Data Migration

Items:
- [ ] **Client onboarding flow** — Guided wizard in SuperAdminPage: step 1 (basic info), step 2 (modules), step 3 (branding), step 4 (add admin users), step 5 (go live toggle).
- [ ] **Klantenbestand migratiesysteem** — CSV import for contacts. `POST /contacts/import` with CSV multipart upload. Backend validates, deduplicates by email, bulk-inserts. Frontend: upload widget + results summary.
- [ ] **Demo environments for clients** — Client gets a read-only copy of a template dataset. Superadmin can "reset to demo" which wipes their real data and restores demo seed data. Protected with extra confirmation.

### Phase 7 — Advanced / Polish

Items:
- [ ] **Per-tenant custom domain** — `acme.getyippie.com` pointing to shared Railway service. Requires custom domain verification flow + nginx SNI config.
- [ ] **PostgreSQL RLS** — Currently tenant isolation is app-level only. Add actual PG row-level security policies as defense-in-depth.
- [ ] **getyippie.com 502 fix** — Toggle Cloudflare CNAME proxy off for ~3min so Railway can verify.

---

## Answer to your architecture questions

**Q: Why are devsandbox and app linked?**
A: Your inbound email provider routes emails to ONE webhook URL. If both envs share the same receiving address, emails land in both DBs. Fix: use separate inbound email addresses per env, each routing to its own Railway URL (e.g. `devsandbox@mg.getyippie.com` → `devsandbox.getyippie.com/api/v1/inbox/webhooks/email`).

**Q: Why no access to dev settings?**
A: Most likely a role issue — your account in the dev DB may still be `admin` not `superadmin` (promote_superadmin.py may not have been run on dev). Or the Settings sidebar link is conditionally hidden for superadmin (bug — should show for all admin+).

**Q: Should web have its own branch?**
A: No. Keep `apps/web` in `main`/production. Remove it from `sandbox` and `devsandbox` (or configure Railway to ignore it for those builds). It's a marketing site and shouldn't be rebuilt with every feature deploy.

**Q: Can admins only access their own app?**
A: Yes, already enforced by backend (`require_superadmin` on admin endpoints). Frontend just needs to hide superadmin routes from admin role — the sidebar check already does this.

---

## Critical files to know

| Path | Purpose |
|---|---|
| `apps/app/backend/app/modules/admin/` | Superadmin CRUD — extend here for new superadmin features |
| `apps/app/backend/app/core/models.py` | All DB models — add `is_active`, `is_demo` here |
| `apps/app/frontend/src/modules/admin/SuperAdminPage.tsx` | Superadmin UI — extend for new admin tools |
| `apps/app/frontend/src/shell/Sidebar.tsx` | Nav routing — fix settings visibility here |
| `apps/app/frontend/src/App.tsx` | Route definitions — add new pages here |
| `apps/app/backend/app/core/mailer.py` | **Replace Mailgun with Resend here** — single outbound email function |
| `apps/app/backend/app/config.py` | Swap `mailgun_*` settings for `resend_api_key` + `resend_from` |
| `apps/app/backend/app/modules/inbox/router.py` | Inbound email webhook — separate per env; adapt payload format if switching to Resend inbound |
| `apps/app/backend/seed.py` | First-run seeding — don't break this |
| `apps/app/Dockerfile.railway` | Build config — used for all Railway deploys |

---

## Verification after each phase

- Phase 1: Open devsandbox, send test email → confirm it does NOT appear in production
- Phase 2: Log into dev.getyippie.com, create a new tenant, deactivate it, re-activate it
- Phase 3: Use invite flow to create a new agent user for a test tenant, log in as that user
- Phase 4: Trigger a ticket status change, confirm agent gets email notification
- Phase 5: Open activity tab, ticket detail, contact detail — confirm all UI is functional
- Phase 6: Import a CSV of 10 contacts, confirm they appear filtered by tenant only
