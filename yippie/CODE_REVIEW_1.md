# Code Review 1 — 2026-06-23

**Scope:** Last 5 commits (`HEAD~5…HEAD`)  
**Method:** 9-angle multi-agent review + 1-vote verification + gap sweep  
**Commits reviewed:**
- `ad4ae1a` feat: onboarding automation — setup checklist, drip emails, first-login redirect
- `aac51e6` fix 6 code-review findings in WhatsApp/Evolution diagnostics
- `003ceea` fix: pass full @lid JID to Evolution API v2.3.5+ for privacy-mode contacts
- `7aebea4` style: UI consistency pass — unify primary buttons, modals, spacing, and brand colour
- `185d344` fix Evolution API v2 send format

---

## Findings (ranked by severity)

### 1. `find_open_session_for_phone` ignores `canonicalize=False` in @lid branch
**File:** `apps/app/backend/app/modules/chat/whatsapp_service.py` ~line 89  
**Severity:** HIGH — data corruption  
**Status:** CONFIRMED

The new @lid suffix-match branch unconditionally overwrites `session.whatsapp_phone` and `session.visitor_id`, while the existing standard suffix fallback correctly guards those writes with `if session and canonicalize and ...`. Any outbound call with `canonicalize=False` will still mutate the stored session phone, breaking future inbound message matching for that contact.

```python
# @lid branch — no canonicalize guard:
if session:
    session.whatsapp_phone = phone   # ← always writes
    session.visitor_id = phone

# Standard suffix fallback — correctly guarded:
if session and canonicalize and session.whatsapp_phone != phone:
    session.whatsapp_phone = phone
    session.visitor_id = phone
```

**Fix:** Wrap the two assignment lines in `if canonicalize:`.

---

### 2. @lid suffix LIKE match can tag the wrong session (cross-contact collision)
**File:** `apps/app/backend/app/modules/chat/whatsapp_service.py` ~line 77  
**Severity:** HIGH — wrong session gets LID  
**Status:** PLAUSIBLE

The suffix query uses `.like(f"%{suffix}")` with `.limit(1)` and no `ORDER BY`. The 8-digit suffix is scoped to the tenant, but two contacts in the same tenant with different country-code prefixes sharing the same 8 trailing digits (e.g. `+3112345678` and `+4912345678`) will cause the wrong session to be tagged with the incoming LID and have its `whatsapp_phone` permanently overwritten.

**Fix:** Add `ORDER BY created_at DESC` or, better, increase the suffix length to 12 digits to reduce collision probability.

---

### 3. Short @lid (< 8 digits) skips suffix match, splits conversation
**File:** `apps/app/backend/app/modules/chat/whatsapp_service.py` ~line 74  
**Severity:** MEDIUM-HIGH — conversation split  
**Status:** CONFIRMED

If an @lid JID's numeric prefix is fewer than 8 digits, the `len(digits) >= 8` guard fails and `find_open_session_for_phone` returns `None` immediately. A new `ChatSession` is created for a contact that already has an open one, splitting conversation history.

**Fix:** Lower the minimum to 6, or fall through to the standard digit-suffix fallback rather than returning `None`.

---

### 4. `['setup-closed-ticket']` query key is never invalidated by ticket-closing mutations
**File:** `apps/app/frontend/src/components/SetupChecklist.tsx` ~line 31  
**Severity:** MEDIUM — onboarding gate stuck  
**Status:** CONFIRMED

`SetupChecklist` uses `queryKey: ['setup-closed-ticket']` to detect the first closed ticket. Every ticket-closing mutation across the app (`TicketDetail`, `TicketList`, `ActionsModal`, `DraftReview`) invalidates `['tickets']` or `['ticket', id]` — none invalidates `['setup-closed-ticket']`. The "Handle your first ticket" gate stays unchecked for up to 5 minutes (staleTime) after the ticket is actually closed.

**Fix:** Either add `queryClient.invalidateQueries({ queryKey: ['setup-closed-ticket'] })` to every ticket-status mutation, or change the SetupChecklist query to use a key that existing mutations already sweep (e.g. derive from `['tickets']`).

---

### 5. Day-3 drip slot consumed silently when setup is already complete
**File:** `apps/app/backend/app/modules/tickets/automation/sla_escalation.py` ~line 200  
**Severity:** MEDIUM — drip email never sent, slot permanently burned  
**Status:** CONFIRMED

When `send_day3` is True but `missing` is empty (tenant finished setup within 3 days), the `if missing:` block is skipped — no email is sent — but `"day3"` is still appended to `drip_sent` and committed. The slot is consumed with no email having gone out and no log entry indicating a skip.

```python
if send_day3:
    if missing:           # only sends when there are incomplete steps
        ...send_email...
    drip_sent = [*drip_sent, "day3"]          # ← always runs
    tenant.onboarding_drip_sent = drip_sent   # ← always runs
```

**Fix:** Either send a "you're all set!" email for the completed case, or log a skip explicitly. If intentional, the marker update should move inside `if missing:` (and not consume the slot when no email goes out).

---

### 6. `ticket_done` gate counts soft-deleted closed tickets
**File:** `apps/app/backend/app/modules/tickets/automation/sla_escalation.py` ~line 168  
**Severity:** MEDIUM — wrong gate value in drip email  
**Status:** CONFIRMED (from gap sweep)

The `ticket_done` check queries `Ticket.status == TicketStatus.closed` without filtering `Ticket.deleted_at.is_(None)`. A ticket that was closed and then deleted still satisfies the gate, so the drip email omits the "Handle your first ticket" step even though no visible closed ticket exists for that tenant.

**Fix:** Add `Ticket.deleted_at.is_(None)` to the WHERE clause.

---

### 7. `SetupChecklist` double-dismiss on SPA remount
**File:** `apps/app/frontend/src/components/SetupChecklist.tsx` ~line 69  
**Severity:** MEDIUM — duplicate PATCH /auth/me calls  
**Status:** CONFIRMED

The `useEffect` that fires the 3-second auto-dismiss timer has no `dismissMutation.isPending` or `dismissMutation.isSuccess` guard. On SPA remount (user navigates away and back within 3 seconds of completing all gates), a second `dismissMutation.mutate()` is queued, firing two `PATCH /auth/me` calls.

**Fix:** Add `!dismissMutation.isPending && !dismissMutation.isSuccess` guard before the `setTimeout`.

---

### 8. Onboarding drip emails are plain-text; all other emails use HTML template
**File:** `apps/app/backend/app/modules/tickets/automation/sla_escalation.py` ~lines 197, 220  
**Severity:** MEDIUM — inconsistent, unbranded emails  
**Status:** CONFIRMED

`send_email` accepts an `html=` parameter. Every other outbound scheduled email in the codebase (marketing drips, demo-expiry notices, booking confirmations) calls `render_email_html(...)` and passes the result as `html=`. The `onboarding_drip` function calls `send_email(to=..., subject=..., body=body)` with only a plain `body=` string — Resend delivers these as unstyled plain text with no Yippie branding.

**Fix:** Wrap the body text in `render_email_html(body, subject)` and pass `html=html` to `send_email`.

---

### 9. `setup_checklist_dismissed` can be reset to `false` by any client
**File:** `apps/app/backend/app/auth/router.py` ~line 249  
**Severity:** LOW-MEDIUM — dismissed checklist can reappear unintentionally  
**Status:** CONFIRMED (from gap sweep)

`PATCH /auth/me` with `{"setup_checklist_dismissed": false}` re-enables the checklist for a user who already dismissed it. Any client that POSTs back a cached user snapshot (where the field was `false` before dismissal) will silently undo the dismissal.

**Fix:** Only allow `setup_checklist_dismissed` to transition `false → true`. Add a guard: `if body.setup_checklist_dismissed is True:` (drop the `else` / `False` case).

---

### 10. `evolution_send_test` returns HTTP 200 on validation error instead of 4xx
**File:** `apps/app/backend/app/modules/admin/router.py` ~line 378  
**Severity:** LOW (dormant — UI hardcodes `instance: 'default'`)  
**Status:** CONFIRMED

Instance name validation failure returns `{"error": "invalid instance name"}` with status 200 instead of raising `HTTPException(400)`. The frontend's `onSuccess` handler treats any 200 as success, displaying the raw JSON with no toast or alert.

**Fix:** Replace `return {"error": ...}` with `raise HTTPException(status_code=400, detail="invalid instance name")`.

---

### 11. `ticketQuery` fires unconditionally for all authenticated users
**File:** `apps/app/frontend/src/components/SetupChecklist.tsx` ~line 31  
**Severity:** LOW — wasted API call  
**Status:** CONFIRMED (from gap sweep)

`teamQuery` is correctly gated with `enabled: isAdmin`. `ticketQuery` has no `enabled` guard, so it fires `GET /tickets?status=closed&limit=1` for every authenticated user on every mount, even if `tour_completed` is false or the checklist has already been dismissed. The data is thrown away when the component returns null.

**Fix:** Add `enabled: !!user && user.tour_completed && !user.setup_checklist_dismissed` to `ticketQuery`.

---

### 12. `onboarding_drip` fetches all tenants in SQL, filters by date in Python
**File:** `apps/app/backend/app/modules/tickets/automation/sla_escalation.py` ~line 129  
**Severity:** LOW — efficiency, scales poorly  
**Status:** CONFIRMED

The scheduler job loads every active non-demo tenant to apply a date-window filter in Python. On 500+ tenants this hydrates all ORM objects for a query that should return 0–2 rows.

**Fix:** Add a SQL-level filter:
```python
Tenant.created_at >= now - timedelta(days=8),
Tenant.created_at < now - timedelta(days=3),
```

---

## Summary Table

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | HIGH | whatsapp_service.py | @lid branch ignores `canonicalize=False` |
| 2 | HIGH | whatsapp_service.py | 8-digit LIKE suffix can match wrong session |
| 3 | MED-HIGH | whatsapp_service.py | Short @lid (< 8 digits) splits conversation |
| 4 | MED | SetupChecklist.tsx | `setup-closed-ticket` queryKey never invalidated |
| 5 | MED | sla_escalation.py | Day-3 slot consumed when no email sent |
| 6 | MED | sla_escalation.py | `ticket_done` counts soft-deleted tickets |
| 7 | MED | SetupChecklist.tsx | Double-dismiss on SPA remount |
| 8 | MED | sla_escalation.py | Drip emails sent as plain text (no HTML template) |
| 9 | LOW-MED | auth/router.py | `setup_checklist_dismissed` can be reset to false |
| 10 | LOW | admin/router.py | Validation error returns HTTP 200 |
| 11 | LOW | SetupChecklist.tsx | `ticketQuery` fires for non-eligible users |
| 12 | LOW | sla_escalation.py | Full table scan for narrow date window |
