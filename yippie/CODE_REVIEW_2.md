# Code Review 2 — 2026-06-23

**Scope:** Broader codebase audit — security, auth, multi-tenant isolation, scheduler safety  
**Method:** Static analysis of production routes, services, and frontend rendering

---

## 🔴 CRITICAL

### 1. Widget chat history crashes at runtime
**`chat/router.py:1162`** — `resolve_tenant_uuid(db)` is called but never imported. Every widget history restore throws `NameError`.

**Fix:** `tenant_id = await resolve_tenant_by_slug(db, tenant_slug)`

---

### 2. WhatsApp webhook is unauthenticated
**`chat/router.py:1077`** — `POST /chat/webhooks/{tenant_slug}/whatsapp` accepts JSON from anyone. No HMAC / secret header check.

**Fix:** Verify `X-Evolution-Signature` with `hmac.compare_digest` against an env-var secret.

---

### 3. Hardcoded personal emails in production code
- **`public/router.py:29`** — `ROOT_OWNER_EMAIL = "diederik1710@gmail.com"` (hardcoded)
- **`public/router.py:128`** — `DEMO_BYPASS_EMAILS = {"diederik1710@icloud.com"}` — bypasses all demo throttling
- **`promote_superadmin.py:7`** — `EMAIL = os.getenv("ADMIN_EMAIL", "diederik1710@gmail.com")` — silent fallback

**Fix:** Move all three to `Settings` with no default; raise at startup if unset in production.

---

### 4. Stored XSS via campaign template HTML
**`InboxQueue.tsx:417`** — `templateEditorRef.current.innerHTML = templateHtml ?? ''` — no DOMPurify sanitisation. `ProfileSettingsPage.tsx:396` correctly uses DOMPurify; this path doesn't.

**Fix:** `templateEditorRef.current.innerHTML = DOMPurify.sanitize(templateHtml ?? '')`

---

## 🟠 HIGH

### 5. Unsubscribe token is forgeable
**`admin/router.py:202`** — Token is `base64url(contact_id.bytes)` — no HMAC, no expiry, no rate limit. Anyone who knows (or guesses) a contact UUID can unsubscribe that contact.

**Fix:** Sign with HMAC using `create_signed_token` (already in `tokens.py`), include `tenant_id` + expiry.

---

### 6. Rate limiter always reads `127.0.0.1` (nginx proxy IP)
**`public/router.py:247`** — `request.client.host` is always the nginx loopback. The per-IP demo rate limit is effectively shared across all users — anyone can exhaust the global limit.

**Fix:** Add `--proxy-headers --forwarded-allow-ips 127.0.0.1` to the uvicorn start command in `Dockerfile.railway`.

---

### 7. Table names f-interpolated into raw SQL
**`admin/service.py:261,291`** and **`public/router.py:205`** — `text(f"DELETE FROM {table} WHERE ...")` — SQL injection footgun. Currently table names come from internal constants, but one bad refactor exposes this.

**Fix:** Use SQLAlchemy ORM `delete(Model).where(...)` per table.

---

### 8. Campaign launch/delete available to any agent (not just admin)
**`marketing/router.py:75,126`** — `DELETE /campaigns/{id}` and `POST /campaigns/{id}/launch` use `CurrentUser`, not `AdminUser`. Any agent can mass-email the contact list or delete campaigns.

**Fix:** Change dependency to `AdminUser`.

---

## 🟡 MEDIUM

### 9. Contact import: no file size cap or MIME validation
**`contacts/router.py:197`** — `await file.read()` with no size check. nginx's 30 MB limit is the only guard. A malicious ZIP-bomb `.xlsx` can exhaust process memory.

**Fix:** Add `if len(content) > 10_000_000: raise HTTPException(413)` + MIME type allowlist check.

---

### 10. `reply_from_email` / aliases stored without domain validation
**`auth/router.py:219`** — Any string is accepted and becomes the `From:` header on outbound email. A user could set an arbitrary email as their sender address.

**Fix:** Apply `_validate_from_email` domain check when persisting these fields.

---

### 11. Impersonation sessions carry no audit trail
**`admin/router.py:114`** — `imp=True` JWT claim is never checked in `get_current_user`. No log entry on mint or use. A superadmin acting as a tenant cannot be attributed after the fact.

**Fix:** Log an activity event on impersonation mint; optionally block password changes from `imp` sessions.

---

### 12. `/chat/reset` has no admin gate
**`chat/router.py:760`** — Permanently deletes all chat history + disconnects WhatsApp. Any authenticated user (including agents) can call it.

**Fix:** Add `AdminUser` dependency.

---

### 13. WebSocket visitor `session_id` unvalidated
**`chat/router.py:1204`** — Any string is accepted as `session_id`, allowing a visitor to connect to another visitor's session with a known ID.

**Fix:** Validate `session_id` is a UUID before accepting the WebSocket connection.

---

## ✅ Verified clean

- Alembic: single head `ob1c2d3e4f5g`
- Booking `confirm_booking()`: uses `with_for_update()` — race-safe
- DB pool: correctly sized by environment
- `seed.py`: fully idempotent (3 guards)
- `SECRET_KEY` default triggers startup warning
- nginx: gzip, `X-Real-IP`, `client_max_body_size 30m`, immutable asset caching all correct
- Tenant isolation: all service queries filter on `tenant_id`
- CORS origins: locked to specific `getyippie.com` domains
- No `console.log` in frontend source
