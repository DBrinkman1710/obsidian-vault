# HANDOFF — [DEPT-ROUTING] (session 67)

Department inbox routing + shared/personal inbox toggle.

## What was built

### Backend
1. **Email routing on arrival** — already wired through `inbox/service._create_draft`: the
   poller passes the inbound recipient (`inbound_to`), which is matched against
   `Department.email` (note: the field is `email`, NOT `inbound_email`) for the tenant.
   A match sets `DraftTicket.forwarded_to_department_id`. This was pre-existing; verified.
2. **Dept carries onto the Ticket** — when a routed draft is approved, the created
   `Ticket.department_id` now falls back to the draft's `forwarded_to_department_id`
   if the reviewer didn't override it (`review.department_id or draft.forwarded_to_department_id`).
3. **Inbox filtering** — `GET /inbox/drafts`:
   - `?department_id=<id>` — already supported (filters on `forwarded_to_department_id`).
   - `?personal=true` — **new**: returns only drafts explicitly assigned to the current
     user (`DraftTicket.assigned_to == current_user.id`), regardless of department.
     Backed by a new `assigned_to` filter param on `service.list_drafts`.
4. **User dept preference** — new `users.personal_inbox` BOOLEAN (default `false`).
   Exposed on `UserOut` and `UserSelfUpdate`; settable via the existing `PATCH /auth/me`.

### Frontend (`InboxQueue.tsx`)
- `GET /departments/my` is now always fetched (was gated on `?dept=` being present).
- Renders an **All** tab + one **"Shared [Dept Name] Inbox"** tab per department the user
  belongs to. Selecting one navigates to `/inbox?dept=<id>`, which adds `?department_id=<id>`
  to every draft query.
- New **"Personal work inbox"** toggle in the filter row, wired to `PATCH /auth/me`
  (`{ personal_inbox }`). When on and not viewing a specific department, draft queries add
  `?personal=true`. The preference persists per user and is reflected on load.
- `User` type in `useAuth.ts` gained `personal_inbox?: boolean`.

## Files changed
- `apps/app/backend/app/core/models.py` — `User.personal_inbox` column
- `apps/app/backend/app/core/schemas.py` — `UserOut.personal_inbox`
- `apps/app/backend/app/auth/router.py` — `UserSelfUpdate.personal_inbox` + apply in `PATCH /me`
- `apps/app/backend/app/modules/inbox/router.py` — `?personal=true` on `GET /drafts`
- `apps/app/backend/app/modules/inbox/service.py` — `assigned_to` filter in `list_drafts`; dept fallback on ticket create
- `apps/app/backend/migrations/versions/dr1e2f3a4b5c_add_personal_inbox_to_users.py` — **new migration**
- `apps/app/frontend/src/auth/useAuth.ts` — `personal_inbox` on User type
- `apps/app/frontend/src/modules/inbox/pages/InboxQueue.tsx` — dept tabs + personal toggle

## Migration
- **`dr1e2f3a4b5c`** — `add_personal_inbox_to_users`.
  Adds `users.personal_inbox BOOLEAN NOT NULL DEFAULT FALSE`.
  Also a **merge migration**: its `down_revision` is the tuple
  `('f7g8h9i0j1k2', 'rbac_001', 'dept_members_001')` — the three heads that were open
  before this work. After it, the tree has a single head again.

Apply with:
```bash
cd apps/app
docker compose exec backend alembic upgrade heads
```

## Known issues / follow-ups
- **Migration not run live** — Docker was not available in this environment, so the
  migration was authored but not applied. The revision chain was validated offline
  (single head: `dr1e2f3a4b5c`). Run `alembic upgrade heads` on next boot.
- **Backend tests not run** — same reason (no Docker). Frontend type-checks clean
  (`tsc -b --noEmit` passes).
- `DraftTicket.assigned_to` is generally set at review time, so the `?personal=true`
  view will mostly surface already-reviewed/assigned items. If product wants pending
  drafts pre-assigned to a user, that assignment step is separate and not part of this work.
- The existing `mailbox=personal` mode (mail to the user's own `inbound_email` address)
  is left intact and is independent of the new `personal_inbox` assignment-based view.

## How to test
1. `cd apps/app && docker compose up --build` then `docker compose exec backend alembic upgrade heads`.
2. As a superadmin, ensure the `departments` module is enabled for a tenant, create a
   department with `email = finance@<tenant>.getyippie.com`, and add an agent as a member.
3. Simulate inbound mail to that address (or send a real one) and confirm the resulting
   draft has `forwarded_to_department_id` set to that department.
4. Log in as the member agent → Inbox shows a **"Shared Finance Inbox"** tab; clicking it
   filters to that department's drafts (`?dept=` in the URL, `?department_id=` on the API).
5. Approve a routed draft → the created ticket has `department_id` set.
6. Toggle **"Personal work inbox"** on → the default view filters to drafts assigned to you
   (`?personal=true`); reload the page and confirm the toggle state persisted (`GET /auth/me`
   returns `personal_inbox: true`).
