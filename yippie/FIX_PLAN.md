# Fix Plan — Combined Code Reviews 1, 2 & 2b

**Source:** CODE_REVIEW_1.md (onboarding/WhatsApp audit) + CODE_REVIEW_2.md (broad security audit) + agent deep-dive  
**Date:** 2026-06-23  
**Total findings:** 30 (4 critical, 10 high, 16 medium/low)

---

## Phase 1 — Ship before anything else (blockers)

These are runtime crashes or security holes exploitable by anyone right now.

### F1. Fix NameError in widget chat history restore
**File:** `apps/app/backend/app/modules/chat/router.py:1162`  
`resolve_tenant_uuid(db)` is called but never imported → every widget history restore throws `NameError`.
```python
# Change to:
tenant_id = await resolve_tenant_by_slug(db, tenant_slug)
```

### F2. Fix stored XSS in campaign template editor
**File:** `apps/app/frontend/src/modules/inbox/pages/InboxQueue.tsx:417`  
`innerHTML` set without sanitisation → XSS from any admin-created template.
```tsx
// Change to:
templateEditorRef.current.innerHTML = DOMPurify.sanitize(templateHtml ?? '')
```

### F3. Lock `/chat/reset` to admin only
**File:** `apps/app/backend/app/modules/chat/router.py:760`  
Any authenticated user can permanently delete all chat history + disconnect WhatsApp.
```python
# Change CurrentUser dependency to AdminUser
```

### F4. Lock campaign launch + delete to admin
**File:** `apps/app/backend/app/modules/marketing/router.py:75,126`  
Any agent can launch a broadcast or delete campaigns.
```python
# Change CurrentUser to AdminUser on both endpoints
```

### F5. Move hardcoded personal emails to Settings
**Files:** `public/router.py:29`, `public/router.py:128`, `promote_superadmin.py:7`  
Personal Gmail/iCloud addresses hardcoded as ROOT_OWNER and demo bypass.
```python
# Move to Settings, no defaults, raise at startup if unset:
ROOT_OWNER_EMAIL: str  # was "diederik1710@gmail.com"
DEMO_BYPASS_EMAILS: set[str]  # was {"diederik1710@icloud.com"}
```

---

## Phase 2 — Security hardening (before go-live)

### F6. Sign unsubscribe tokens with HMAC
**File:** `apps/app/backend/app/modules/admin/router.py:202`  
Token is `base64url(contact_id)` — no HMAC, no expiry, forgeable.
```python
# Use create_signed_token(contact_id, tenant_id, expires_in=30*86400)
# Verify with verify_signed_token() on unsubscribe endpoint
```

### F7. Authenticate WhatsApp webhooks (both Evolution and Twilio paths)
**Files:** `apps/app/backend/app/modules/chat/router.py:1077`, `apps/app/backend/app/modules/inbox/router.py:688`  
Both webhook endpoints accept events from anyone — forged events can inject fake messages into agent inboxes and live chats.
```python
# Evolution (chat/router.py:1077):
sig = request.headers.get("X-Evolution-Signature", "")
expected = hmac.new(settings.evolution_webhook_secret.encode(), body, "sha256").hexdigest()
if not hmac.compare_digest(sig, expected):
    raise HTTPException(403)
# Twilio (inbox/router.py:688): use twilio.request_validator.RequestValidator
```
Add `EVOLUTION_WEBHOOK_SECRET` + `TWILIO_AUTH_TOKEN` to Railway env vars.

### F8. Fix rate limiter to use real client IP
**File:** `Dockerfile.railway` (uvicorn start command)  
`request.client.host` is always `127.0.0.1` behind nginx — demo rate limit is effectively global.
```dockerfile
# Add flags to uvicorn command:
--proxy-headers --forwarded-allow-ips 127.0.0.1
```

### F9. Replace f-string SQL with ORM delete()
**Files:** `admin/service.py:261,291`, `public/router.py:205`  
Table names interpolated into `text(f"DELETE FROM {table}...")` — one bad refactor = SQL injection.
```python
# Replace with:
await db.execute(delete(ContactLabel).where(ContactLabel.tenant_id == tenant_id))
# etc., one statement per model
```

### F_NEW1. Add tenant_id filter to `purge_old_deleted_contacts`
**File:** `apps/app/backend/app/modules/contacts/service.py:226`  
The hourly purge job issues `DELETE FROM contacts WHERE deleted_at < cutoff` with **no `tenant_id` filter** — it hard-deletes soft-deleted contacts from every tenant simultaneously with no per-tenant audit.
```python
# Change to scoped delete per tenant, or add:
.where(Contact.tenant_id == tenant_id)
# Called from scheduler with the tenant context it should be purging
```

### F_NEW2. `ticket_id` set on chat session with no cross-tenant validation
**File:** `apps/app/backend/app/modules/chat/router.py:565`  
`PATCH /chat/sessions/{id}` accepts any UUID as `ticket_id` without checking the ticket belongs to the caller's tenant (contrast: `contact_id` at line 569 does validate). An agent can link a session to any ticket in the system.
```python
ticket = await db.get(Ticket, body.ticket_id)
if not ticket or ticket.tenant_id != current_user.tenant_id:
    raise HTTPException(404)
```

### F10. Validate session_id UUID in WebSocket
**File:** `apps/app/backend/app/modules/chat/router.py:1204`  
Any string accepted — visitor can hijack another known session.
```python
try:
    uuid.UUID(session_id)
except ValueError:
    await websocket.close(code=1008)
    return
```

---

### F_NEW3. Add `max_instances=1, coalesce=True` to all scheduler jobs
**File:** `apps/app/backend/app/modules/tickets/automation/sla_escalation.py:21`  
All 5 jobs (SLA escalation, auto-close, purge, drip, demo expiry) lack these flags. On a rolling Railway deploy both the old and new worker run simultaneously, risking double escalations, duplicate drip emails, and double purges. The email poller correctly uses both flags.
```python
@scheduler.scheduled_job("interval", hours=1, id="escalate_overdue_tickets",
                          max_instances=1, coalesce=True)
```

## Phase 3 — WhatsApp reliability (this week)

These cause wrong message routing or conversation splits.

### F11. Guard @lid suffix-match with `canonicalize` flag
**File:** `apps/app/backend/app/modules/chat/whatsapp_service.py` ~line 89  
`session.whatsapp_phone` overwritten even when `canonicalize=False`.
```python
if session:
    if canonicalize:           # ← add this guard
        session.whatsapp_phone = phone
        session.visitor_id = phone
    return session
```

### F12. Increase LIKE suffix length to reduce collision risk
**File:** `apps/app/backend/app/modules/chat/whatsapp_service.py` ~line 76  
8-digit suffix can match the wrong open session when two contacts share trailing digits.
```python
# Change:
suffix = digits[-8:]
# To:
suffix = digits[-12:]   # 12 digits makes collision astronomically unlikely
```

### F13. Handle short @lid (< 8 digits) gracefully
**File:** `apps/app/backend/app/modules/chat/whatsapp_service.py` ~line 74  
`len(digits) < 8` returns `None` immediately, creating a duplicate ChatSession.
```python
# Lower threshold or fall through to standard suffix fallback instead of return None
if len(digits) >= 6:
    suffix = digits[-min(8, len(digits)):]
    ...
```

---

## Phase 4 — Onboarding correctness (this sprint)

### F14. Fix day-3 drip: update marker only when email is sent
**File:** `apps/app/backend/app/modules/tickets/automation/sla_escalation.py` ~line 200  
Slot consumed even when `missing=[]` (no email sent). Move the marker update inside `if missing:`, or send a "you're all set" email for the completed case.

### F15. Filter soft-deleted tickets in `ticket_done` gate
**File:** `apps/app/backend/app/modules/tickets/automation/sla_escalation.py` ~line 168`
```python
# Add to query:
Ticket.deleted_at.is_(None),
```

### F16. Use HTML template for drip emails
**File:** `apps/app/backend/app/modules/tickets/automation/sla_escalation.py` ~lines 197, 220`
```python
# Wrap body before each send_email call:
html = render_email_html(body, subject)
await send_email(to=admin.email, subject=subject, body=body, html=html)
```

### F17. Add SQL-level date filter to onboarding_drip
**File:** `apps/app/backend/app/modules/tickets/automation/sla_escalation.py` ~line 129`
```python
# Add to WHERE clause:
Tenant.created_at >= now - timedelta(days=8),
Tenant.created_at < now - timedelta(days=3),
```

---

## Phase 5 — Frontend onboarding polish

### F18. Invalidate `['setup-closed-ticket']` from ticket mutations
**Files:** `TicketDetail.tsx`, `TicketList.tsx`, `ActionsModal.tsx`, `DraftReview.tsx`  
Add `queryClient.invalidateQueries({ queryKey: ['setup-closed-ticket'] })` alongside existing `['tickets']` invalidations in every mutation that closes a ticket.

### F19. Guard `ticketQuery` with `enabled` flag
**File:** `apps/app/frontend/src/components/SetupChecklist.tsx`
```tsx
enabled: !!user && !!user.tour_completed && !user.setup_checklist_dismissed,
```

### F20. Prevent double-dismiss on SPA remount
**File:** `apps/app/frontend/src/components/SetupChecklist.tsx`
```tsx
useEffect(() => {
    if (allDone && !dismissMutation.isPending && !dismissMutation.isSuccess) {
        const t = setTimeout(() => dismissMutation.mutate(), 3000)
        return () => clearTimeout(t)
    }
}, [allDone, dismissMutation.isPending, dismissMutation.isSuccess])
```

---

## Phase 6 — Minor hardening

### F21. One-way `setup_checklist_dismissed` field
**File:** `apps/app/backend/app/auth/router.py`  
Only allow `false → true`, not `true → false`.
```python
if body.setup_checklist_dismissed is True:  # drop else/False case
    current_user.setup_checklist_dismissed = True
```

### F22. Add domain validation to `reply_from_email`
**File:** `apps/app/backend/app/auth/router.py:219`  
Apply `_validate_from_email()` before persisting.

### F23. Log impersonation events
**File:** `apps/app/backend/app/modules/admin/router.py:114`  
Write an activity log row on impersonation token mint; block `PATCH /auth/me/password` from `imp` sessions.

### F24. Add MIME + size check to contact import
**File:** `apps/app/backend/app/modules/contacts/router.py:197`
```python
content = await file.read()
if len(content) > 10_000_000:
    raise HTTPException(413, "File too large")
if file.content_type not in {"text/csv", "application/json", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}:
    raise HTTPException(415, "Unsupported file type")
```

### F_NEW4. Lock `DELETE /tickets/templates/{id}` to admin
**File:** `apps/app/backend/app/modules/tickets/router.py:87`  
Uses `CurrentUser` — any agent can delete templates.
```python
# Change dependency to AdminUser
```

### F_NEW5. Remove dead legacy email webhook
**File:** `apps/app/backend/app/modules/inbox/router.py:671`  
`POST /webhooks/email` does nothing (poller owns ingestion) but still accepts unauthenticated POSTs and returns 200. Dead surface area.
```python
# Delete the route entirely
```

### F25. Return 400 (not 200) for invalid Evolution instance name
**File:** `apps/app/backend/app/modules/admin/router.py:378`
```python
raise HTTPException(status_code=400, detail="invalid instance name")
```

---

## Summary by priority

| Phase | Items | When |
|-------|-------|------|
| 1 — Blockers | F1–F5 | Before next sandbox deploy |
| 2 — Security hardening | F6–F10, F_NEW1–F_NEW3 | Before go-live |
| 3 — WhatsApp reliability | F11–F13 | This week |
| 4 — Onboarding correctness | F14–F17 | This sprint |
| 5 — Frontend polish | F18–F20 | This sprint |
| 6 — Minor hardening | F21–F25, F_NEW4–F_NEW5 | Nice-to-have before go-live |

---

## Full finding index (30 total)

| ID | Sev | Phase | File | Issue |
|----|-----|-------|------|-------|
| F1 | CRIT | 1 | chat/router.py:1162 | NameError — resolve_tenant_uuid not imported |
| F2 | CRIT | 1 | InboxQueue.tsx:417 | Stored XSS — innerHTML without DOMPurify |
| F3 | CRIT | 1 | chat/router.py:760 | /chat/reset no admin gate |
| F4 | CRIT | 1 | marketing/router.py:75,126 | Campaign launch/delete open to agents |
| F5 | CRIT | 1 | public/router.py, promote_superadmin.py | Hardcoded personal emails |
| F6 | HIGH | 2 | admin/router.py:202 | Unsubscribe token forgeable (no HMAC) |
| F7 | HIGH | 2 | chat/router.py:1077, inbox/router.py:688 | WhatsApp webhooks unauthenticated |
| F8 | HIGH | 2 | Dockerfile.railway | Rate limiter reads nginx IP, not client IP |
| F9 | HIGH | 2 | admin/service.py:261, public/router.py:205 | Table names f-interpolated into raw SQL |
| F10 | HIGH | 2 | chat/router.py:1204 | WebSocket session_id unvalidated |
| F_NEW1 | HIGH | 2 | contacts/service.py:226 | purge_old_deleted_contacts no tenant_id filter |
| F_NEW2 | HIGH | 2 | chat/router.py:565 | ticket_id set with no cross-tenant validation |
| F_NEW3 | MED | 2 | sla_escalation.py:21 | Scheduler jobs lack max_instances=1/coalesce=True |
| F11 | HIGH | 3 | whatsapp_service.py:89 | @lid branch ignores canonicalize=False |
| F12 | HIGH | 3 | whatsapp_service.py:76 | 8-digit LIKE suffix — cross-session collision |
| F13 | MED | 3 | whatsapp_service.py:74 | Short @lid (< 8 digits) splits conversation |
| F14 | MED | 4 | sla_escalation.py:200 | Day-3 drip slot consumed when no email sent |
| F15 | MED | 4 | sla_escalation.py:168 | ticket_done counts soft-deleted tickets |
| F16 | MED | 4 | sla_escalation.py:197,220 | Drip emails plain-text (no HTML template) |
| F17 | LOW | 4 | sla_escalation.py:129 | Full table scan — no SQL-level date filter |
| F18 | MED | 5 | SetupChecklist.tsx:31 | setup-closed-ticket queryKey never invalidated |
| F19 | LOW | 5 | SetupChecklist.tsx:31 | ticketQuery fires for non-eligible users |
| F20 | MED | 5 | SetupChecklist.tsx:69 | Double-dismiss on SPA remount |
| F21 | LOW | 6 | auth/router.py:249 | setup_checklist_dismissed can reset to false |
| F22 | MED | 6 | auth/router.py:219 | reply_from_email no domain validation |
| F23 | MED | 6 | admin/router.py:114 | Impersonation sessions no audit trail |
| F24 | MED | 6 | contacts/router.py:197 | Contact import no file size/MIME check |
| F25 | LOW | 6 | admin/router.py:378 | Validation error returns HTTP 200 |
| F_NEW4 | LOW | 6 | tickets/router.py:87 | DELETE templates open to any agent |
| F_NEW5 | LOW | 6 | inbox/router.py:671 | Dead legacy email webhook — unauthenticated surface |
