# Yippie — Roadmap
**Updated:** session d-20260622 — [V9]+[V10]+[V11] ✅ — `DepartmentsPage.tsx` deleted + `/settings/departments` route removed from `App.tsx` (had been re-introduced via merge after session 36); `ContactLabelsCard` added to Settings page (`LabelsPage.tsx`) — CRUD for contact labels via `GET/POST/PATCH/DELETE /contacts/labels`, colour-coded list with inline edit/delete + add form; no migrations; 2 files: `App.tsx` + `LabelsPage.tsx`; session b-20260622 — [TPL-CONSISTENT] ✅ — marketing campaign templates now appear in TemplatePicker (fetches `/marketing/campaigns` + per-campaign `/templates`, flattened with "Campaign" badge); Templates button in InboxQueue compose + toolbar and DraftReview reply gated by `marketingEnabled` (`config.enabled_modules.includes('marketing')`); sub-task 3 verified already correct (picker is inline dropdown, no navigation away from compose); `TemplatePicker.tsx` uses `useQueries` for parallel campaign-template fetch; `InboxQueue.tsx` + `DraftReview.tsx` updated; no backend changes, no migrations; session b-20260622 — [MODULE-RENAME]+[MODULE-INC]+[MODULE-CONSIST] ✅ — emailtracking removed from `ALL_MODULES` (already absent), sidebar clean; `CORE_FEATURES` in `plans.py` reduced to inbox/contacts/activity; `MODULE_PRICES` extended with chat/marketing/departments/billing; pricing page `CORE_FEATURES` → ["Inbox","Contacts","Activity"], `addOns` now covers all 8 paid modules, `featureOptions` updated; modules/page.tsx: emailtracking replaced with Marketing entry, Departments + Billing entries added, hero updated to "Twelve modules"; `web/src/lib/config.ts` updated; session c-20260622 — [BK-MULTISLOT] ✅ + [BK8] ✅ — multiple time slots per day in weekly booking grid (backend already correct; WeeklyGrid already supports multi-slot per day with + Add / × remove); BK8 per-send pipeline stage override: `stage_id_override` nullable UUID FK added to `booking_tokens` (migration `bk8_booking_token_stage_override`), `BookingTokenCreate` + `BookingTokenOut` schemas updated, `create_booking_token()` stores override, `confirm_booking()` uses override over global setting; `SendBookingModal` gains "Move to stage after booking" dropdown (fetches `/pipeline/stages`, sends `stage_id_override` in POST body); session 84 — Tier 3 batch 2 ✅ — [BK-HOURS-BUG] booking slots now honour tenant timezone: added `timezone` column to `calendar_settings` (migration `bk_tz_calendar_settings`, default Europe/Amsterdam), `get_available_slots()` uses `zoneinfo.ZoneInfo` for both legacy work-hour mode and weekly-slot mode, timezone selector in CalendarPage booking settings modal; [WEB-CENTER] consistent 1180px centering across inner marketing pages: added `.sectionInner {max-width:var(--maxw); margin:0 auto}` to `content.module.css`, applied wrapper in vs-zendesk/for-smbs/for-agencies/blog sections; [PLAN-STARTER] Starter capped at 3 users (was 5), €19/mo unchanged; `invite_user()` now enforces plan seat limit with 409 error; pricing page + web `config.ts` updated (also fixed founder user count 2→10); session 83 — Tier 3 parallel batch ✅ — [VS-ZD-FIX] ✓/✗ symbols replaced with Yes/No on vs-zendesk page; [COM-LOGO-VIS] logo-blue-bg-mark.svg raised to opacity 0.10 as foreground hero accent; [WEB-USE-NAV] "Use cases" nav link added (→ /for-smbs); [INBOX-UNREAD]+[INBOX-SHARED-CNT] badge `?? pending` fallback removed — badges now show true unread counts only (InboxQueue.tsx); [AUTH-LOGO-SIZE] logos enlarged to w-56 (224px) on LoginPage + BookingPage + MeetPage + BookingManagePage; [ROI-FIX]+[PRIVACY-FIX]+[ABOUT-COMP]+[BLOG-AUTHOR] verified already correct in HEAD — no changes needed; new roadmap items added this session: [TPL-CONSISTENT][BK-MULTISLOT][LIVECHAT-ROOT] (Tier 2), [INBOX-UNREAD][INBOX-SHARED-CNT][BK-HOURS-BUG][COM-LOGO-VIS][AUTH-LOGO-SIZE][PLAN-STARTER] (Tier 3); session 82A — Tier 3 batch ✅ — [BK-DATE] booking pages now offer slots for a configurable lookahead window (new `booking_window_days` column on `calendar_settings`, default 60, migration `bk8w_booking_window_days` which also merges the two open heads `a3b4c5d6e7f8`/`n4o5p6q7r8s9`); the three public slot endpoints in `public/router.py` use it instead of `max(booking_expiry_days, 14)` (which capped availability at ~2 weeks), plus a "How far ahead customers can book" selector in CalendarPage booking settings; [INBOX-SHIFT] added an empty-state hint ("Nothing assigned to you here.") inside the existing min-h-[200px] draft-list guard so the Assigned-to-me filter no longer reads as a blank box; [DEMO-BUG] `/api/request-demo` proxy now surfaces the real upstream failure detail (422 validation msg / 503 service / etc.) instead of always "Something went wrong" — verified RequestDemo/Questionnaire schema matches the form payload exactly; [BOOK-LOGO] BookingPage + MeetPage + BookingManagePage now use `/logo-lockup-onLight.svg` (matching LoginPage) instead of a stale inline hand-drawn SVG; [FOUNDER-PLAN] Founder plan raised to 10 users + 50% add-on discount (`module_discount: 0.5` in PLAN_LIMITS, new `module_discount_for_plan`/`module_prices_for_plan` helpers, tenant config now returns discounted module_prices); verified [EMAILTRACK-NAV]/[TK-NAV]/[CON-TABS]/[CON-DELETED]/[CON-PERMDEL]/[TEAM-DEPT] already resolved in current HEAD (session 78); session 81 — [LIVECHAT-SESSION-DEDUP] ✅ — fixed contacts ending up with two open WhatsApp sessions (one for receiving, one for sending). Root cause: the inbound webhook (`handle_incoming_webhook`) matched a session by exact canonical digits then an 8-digit-suffix fallback (bridging local `0612…` vs international JID `31612…` formats), but the outbound `_find_or_create_open_session` (Start conversation + Broadcast) did an exact match only — so when a customer messaged first (session stored as `31612…`) and an agent then started a conversation from the locally-formatted contact (`0612…`), a *second* session was created. Fix: extracted shared `normalize_phone()` + `find_open_session_for_phone()` (exact + suffix fallback, canonicalizes the stored number on match) into `whatsapp_service.py`; both the inbound webhook and the outbound find-or-create now call it, so a single session serves both directions. No migration — the existing `uix_chat_sessions_open_whatsapp` partial-unique index already blocks concurrent dup opens; 2 files: chat/whatsapp_service.py + chat/router.py; session 81 — [INBOX-ASSIGN] ✅ — bulk assign inbox drafts (Assign to me / Assign to… modal with Users+Departments tabs / Unassign); unread count badges on Shared+Personal mailbox tabs (9+ cap, 15s refresh); personal inbox cards slightly more compact; new backend endpoints GET /inbox/drafts/assignees + POST /inbox/drafts/bulk-assign (model_fields_set–aware null unassign); 3 files: router.py + service.py + InboxQueue.tsx; session 80 — [MERGE-MULTISELECT] ✅ — merge action in BulkBar when exactly 2 tickets selected (dialog to pick primary, existing POST /tickets/{id}/merge backend); contact now required on ticket creation (frontend validation); fixed duplicate Alembic revision a1b2c3d4e5f6 (renamed lowercase_contact_emails → a2b3c4d5e6f7 + merge head a3b4c5d6e7f8); commit 80bf147; session 79 — [RC1-PEEK] ✅ — context menu peek modals: "View contact" on CalendarPage + PipelinePage now opens ContactPeekModal (name/email/phone/company/labels/score + "Open full page →" new-tab link) instead of navigating away; "View ticket" on CalendarPage (event pills + deadline pills) opens TicketPeekModal (subject/status/priority/assignee/description preview); removed "Open ticket" from TicketList context menu + "Review draft" from InboxQueue context menu (both were redundant with row click); new components: `ContactPeekModal.tsx` + `TicketPeekModal.tsx`; commit c4ed718; session 78 — Tier 3 batch ✅ — [COM-NAV] nav inner row centred at 1180px; [CON-TABS] contacts tab first + trash tab removed; [CON-PERMDEL] error toast + admin-only button; [INBOX-SHIFT] min-h on draft list; [TK-NAV] sidebar z-index + min-w-0 fix; [CON-DELETED] removed include_deleted from search path; [TEAM-DEPT] dept checkboxes in EditUserModal + GET/PUT /team/users/{id}/departments; [LIVECHAT-BOOKING-EMAIL] email prompt modal in ActionsModal before booking dispatch; [LIVECHAT-PERF] 30s WS ping/pong heartbeat + react-window virtualised session list; [LIVECHAT-MEDIA] file picker + clipboard paste + image/doc send + migration lm7n8o9p0q1r; [SA-CLIENTS] ✅ — plan badge + AI donut + clickable users column in SuperAdminPage (session 78); 2026-06-21 (session 76: roadmap audit ✅ — code-verified all open items; marked done: [MERGE-TK] MergeModal confirmed in TicketDetail.tsx, [DEMO-WF1] _ensure_demo_pipeline_stage + _assign_stage confirmed in public/router.py, [WEB-PLANS2] Starter/Growth/Enterprise in pricing/page.tsx, [DEPT-MOD] 'departments' in ALL_MODULES, [P1] selectedStageId in ActivityFeed.tsx, [T1] DeleteUserModal in TeamSettingsPage.tsx, [AI-BTN1] fully done (session 73), [GOLIVE-CHECKLIST] GOLIVE.md exists, [LIVECHAT-QR] error state confirmed; updated [RC1] to reflect 5/8 pages wired (missing Pipeline/Calendar/Templates); session 75: [ALIASES+TOUR] ✅ — send-from aliases + first-login welcome tour; migration `ud1e2f3a4b5c` adds `send_from_aliases` JSONB + `tour_completed` bool to users; `UserOut`/`UserSelfUpdate`/`PATCH /auth/me` updated; Profile settings gains an "Send-from aliases" list UI (add/remove, saved as JSONB array); compose (InboxQueue) and reply (DraftReview) From selectors now show all personal addresses — reply_from_email + every alias as chips; refactored `usePersonalFrom: boolean` → `fromEmail: string | null` across both compose surfaces; `WelcomeTour.tsx` — 4-step overlay (Inbox/Contacts/Tickets/Profile) shown once after first login, each step has Show me (navigate + dismiss) + Next/Get started; dismissing marks `tour_completed = true` via `PATCH /auth/me`; commits 4de75e2 (build fix) + 0a355b3 (session 75); hotfix a76b2cf: sidebar pinned logo/footer + independent scroll zones — removed overflow-y-auto from aside, logo+reorder bar are shrink-0, module nav is flex-1 min-h-0 overflow-y-auto, settings nav is shrink-0 overflow-y-auto max-h-52, footer email+signout+collapse is shrink-0 pinned; hotfix 50ea225: run_migrations preflight fix — was incorrectly aborting when a merge parent was a brand-new pending migration rather than a stale one, killing every deploy after session 74; added pending-descendant check so alembic handles the natural ordering; session 74: [SIDEBAR-DND] ✅ — sidebar drag-and-drop reorder tied to user ID: `sidebar_order` JSONB column on User model + Alembic migration `sb1a2b3c4d5e` + merge head `tc2d3e4f5g6h`; backend: `UserOut` + `UserSelfUpdate` updated, `PATCH /auth/me` handler; frontend: `@dnd-kit/core+sortable+utilities` installed, `User` interface updated in `useAuth.ts`, Sidebar.tsx rewritten with `resolveOrder()` (user saved order filtered to enabled modules, new mods appended), right-click context menu "Reorder sidebar", `SortableModItem` wrapper with grip handle, Done/Cancel action bar, saves via `PATCH /auth/me` → `refreshUser()`; commit 3603f16; session 73: [WEB-PLANS2] ✅ — pricing page restructured from 4 flat tiers to 3 base plans (Starter/Growth/Enterprise); Founder moved to a dedicated banner above the grid (Limited offer callout with price, CTA); each plan card now lists 5 core features (Inbox/Contacts/Tickets/Activity/Billing) + user/scan limits; plansGrid changed to repeat(3,1fr) + max-width 900px; quiz PLAN_RANK updated to Starter/Starter/Growth/Enterprise (rank 0 no longer points to Founder); homepage pricing teaser updated to same 3-plan layout; [AI-BTN1] ✅ — interactive AI inbox demo on getyippie.com: POST /public/ai-demo backend endpoint (rate-limited, calls ai_scanner.scan_message, returns subject/description/priority/category); Next.js proxy at /api/ai-demo; InboxDemo.tsx client component on homepage (3 pre-filled example emails, textarea, spinner, live ticket result with priority badge + category badge + Approve/Edit mock actions); placed between "How it works" and ROI Calculator sections; [P1] ✅ VERIFIED DONE — stage filter chips already live in ActivityFeed.tsx (selectedStageId state + pipeline_stage_id param on /activity query); [T1] ✅ VERIFIED DONE — delete user button + DeleteUserModal already in TeamSettingsPage.tsx + DELETE /team/users/{id} endpoint + service.delete_user() with last-admin guard; commit pending; session 72: [MEET1] ✅ — public /meet/:slug booking page. GET /public/meet/{slug} returns available slots (reads CalendarSettings, reuses get_available_slots); POST /public/meet/{slug} takes name/email/slot_start/slot_end/message, finds-or-creates contact by email, validates no double-booking, creates CalendarEvent, moves contact to post_booking_stage if configured, fires _notify_customer_confirmed + _notify_agent_confirmed. New MeetPage.tsx at /meet/:slug — standalone 2-step UI (no auth shell): step 1 pick slot on calendar/time chips, step 2 enter name/email/optional message, confirm button. Route wired in App.tsx same pattern as /book/. Pricing page Talk to us / Book a call / Contact us buttons now point to ${NEXT_PUBLIC_APP_URL}/meet/default (env-aware: sandbox → sandbox.getyippie.com, production → app.getyippie.com automatically). DEMO_PATH/Request demo buttons unchanged. Commit be46ec8; session 71: [CO-CLICK] ✅ — company names in CompaniesTab clickable → switches to Contacts tab filtered by that company; companyFilter lifted to ContactsPage parent; onCompanyClick prop on CompaniesTab; dismissible chip + company badge filter toggle in ContactsTab; [WEB-LEGAL] ✅ — /terms page created (GDPR/AVG Dutch B2B SaaS ToS); Terms link added to SiteFooter; session 70: [BIZ-Q1] ✅ — 2-step qualifying questionnaire + inline module recommendation on `/request-demo`. Step 1 chips: team size / industry (radio) + current tools / pain points (multi, pain capped at 3); step 2 computes 2–4 recommended modules client-side (always AI Inbox + Tickets, plus industry/pain/tools signals, deduped + capped at 4, with emoji badge + one-line desc; falls back to top-4 if all skipped) then the contact form. New CSS classes in `request-demo.module.css` (step dots, chips, recommendation card). `apps/web/src/app/api/request-demo/route.ts` passes `questionnaire` through. Backend `public/router.py` gains a `Questionnaire` Pydantic model on `RequestDemo` and appends the answers + recommended modules to the follow-up Ticket description for the root-tenant agent; session 69: [MKTG1] ✅ — new `marketing` sidebar module (added to `ALL_MODULES`, `MODULES` registry, gated mount + Megaphone sidebar link + `/marketing` route). Migration `em1k2t3g4h5j` creates 5 RLS tenant-isolated tables: `campaigns` (status draft/scheduled/sending/completed, dispatch_channel email/whatsapp, ab_winner, segment_filter JSONB, dispatched_at), `campaign_templates` (A/B raw_html/raw_css variants, isolated via campaign join), `campaign_analytics` (per-recipient status sent/opened/clicked/replied + unique tracking_token + variant + reply_classification), `campaign_sequences` (drip steps), `contact_unsubscribes` (composite PK). Backend `modules/marketing/`: CRUD service+router (`/marketing/campaigns` CRUD, `/templates` upsert, `/launch`, `/schedule`, `/analytics`, `/sequences` CRUD, `/segments/preview`, `/unsubscribes`); `launch_campaign()` builds segment recipients (label/company/pipeline_stage/all), skips opt-outs, 50/50 A/B split, injects 1×1 open-pixel + unsubscribe footer, dispatches via Resend (email) or Evolution API (whatsapp, 5-10s anti-ban delay); `ab_pick_winner()` open-rate winner → held-back 50%. Public no-auth `/track/open/{token}` (1×1 GIF) + `/track/unsubscribe/{token}` (HTML page). APScheduler `scheduler.py`: minute job launches scheduled campaigns, 15-min A/B-winner job (2h after dispatch), hourly drip job (sends due steps to non-repliers, skips opt-outs). Reply tracking extends `emailtracking/webhooks.py` inbound branch → `marketing/replies.py` Claude-Haiku classify (Interested/Opt-out/Out of office/Other), marks replied + auto-unsubscribes opt-outs. Frontend `pages/marketing/`: two-panel `MarketingPage` + `CampaignDetail` 5 tabs — Design (GrapesJS + newsletter preset, A/B variant switcher, 3 starter templates), Audience (segment builder + live preview), Schedule (launch/schedule/A-B/channel toggles), Analytics (sent/open%/click%/reply%/opt-out + A/B bars + per-recipient table), Drip sequences; public `UnsubscribePage` at `/unsubscribe/:token`. Frontend builds clean; session 68: [SUPER-DASH] ✅ — superadmin cross-tenant activity Dashboard tab on `SuperAdminPage.tsx` + `GET /admin/stats?start&end&tenant_id=` (RLS-free grouped aggregates → per-tenant tickets open/closed/overdue, inbox_pending, contacts_created, active_users_today, ai_usage_today + summary); 5 stat cards, click-to-filter per-tenant table (overdue=red, at-risk=amber), 7d/30d/All toggle, tenant dropdown, 60s auto-refresh; [INSIGHT1] ✅ merged in; read-only, no migration; session 67: [DEPT-ROUTING] ✅ — inbound mail auto-routes to a department via `inbound_to`→`Department.email` match in `inbox/service._create_draft` (sets `forwarded_to_department_id`); approving a routed draft carries the dept onto the new `Ticket.department_id`; `GET /inbox/drafts` already supported `?department_id=`, added `?personal=true` (drafts assigned to the current user, any dept) via new `assigned_to` filter in `list_drafts`; `users.personal_inbox` boolean (migration `dr1e2f3a4b5c`, also merges the 3 open heads `f7g8h9i0j1k2`/`rbac_001`/`dept_members_001`) + `shared_inbox_disabled` on `UserOut`/`UserSelfUpdate` + `PATCH /auth/me`; InboxQueue.tsx renders an All + "Shared [Dept] Inbox" tab per `GET /departments/my` membership (drives `?dept=`), plus a persisted "Personal work inbox" toggle wired to `PATCH /auth/me` that adds `?personal=true` to draft queries in the default view; session 66: [RBAC1] ✅ — migration `rbac_001` creates `rbac_roles` + `rbac_user_roles` + `permissions_matrix` tables with `perm_subject_type`/`access_level_enum` enums + RLS; `check_module_access()` dependency applied to all module routes; `MutationGate` added to InboxQueue bulk actions, TicketDetail action bar + reply send, ContactsPage New/Import/bulk delete; session 65: [LIVECHAT-STATUS] ✅ — `msg_status` + `evolution_msg_id` on `ChatMessage`; migration `a1b2c3d4e5f6`; `message.update` webhook handler; `MsgStatusTick` component; [LIVECHAT-SESSION-ACTIONS] ✅ — `SessionContextMenu` right-click + checkbox multi-select + bulk action bar; `POST /chat/sessions/bulk`; [LIVECHAT-PHONE-NORM] ✅ — `_normalize_phone()` E.164 normalization in contacts service; amber warning chip in ContactDetail; [LIVECHAT-WIDGET-HISTORY] ✅ — `ws.onopen` fetches history via new public endpoint; `GET /chat/public/sessions/{visitor_id}/messages`; `greeted` flag prevents replay; session 64: [LIVECHAT-STATUS-MODEL] ✅ — `status` (open|assigned|solved|ticket) + `assigned_to` FK + `solved_at` on `ChatSession`; `hide_solved_chats_hours` on `Tenant` (default 72); auto-claim on session open; `/claim` + `/assign` + `/status` endpoints; Mine/Open/All filter tabs; notifications target assigned agent; LiveChat settings card in LabelsPage; migration `livechat_status_001_status_model`; [LIVECHAT-CANNED] canned `/` picker in reply box (reuses `GET /templates`); [LIVECHAT-NOTES] Notes tab + `sender_type="note"` on `ChatMessage`; [LIVECHAT-CREATE-CONTACT] "Create contact" button when session has no linked contact; [LIVECHAT-CONTACT-POPUP] clickable contact name → inline-editable modal; [LIVECHAT-HISTORY] collapsible previous-conversations panel; [LIVECHAT-TICKET] + [LIVECHAT-SESSION-DEDUP] verified already done; commit `92b3fc6`; session 63: [DEPT-MOD] ✅ — `'departments'` added to `ALL_MODULES`; `departments_router` moved from ungated core mount into `MODULES` registry (gated by `require_module`); sidebar `MODULE_MAP` entry + `ModuleGate`-wrapped route; hardcoded module lists in `SuperAdminPage` + `SuperadminsSettingsPage` updated; no migration; commit `309637b`; session 62: [KANBAN-STAGES] ✅ — `provision_default_stages()` (Lead/Qualified/Proposal/Won) seeded on `create_tenant()`; inline `KanbanStagesPanel` in LabelsPage (Settings) admin-only; commit `c43550b`; session 61: Tier 3 batch ✅ — [WEB-FAVICON] favicon icons metadata in layout.tsx; [WEB-NO-FEATURES] features/page.tsx deleted + SiteNav/SiteFooter/sitemap cleaned + /features→/modules redirects; [WEB-LOGO-BG] logo-blue-bg-mark.svg as hero bg (opacity-[0.04]); [TK-CONTEXT] CustomerPanel cache key deduped + loading skeleton; [PROF-LAYOUT] gap-8 + w-96 two-column fix on ProfileSettingsPage; [LABEL-INLINE] LabelPicker inline ＋ New label form with color swatches; [LIVECHAT-QR-ICON] always-visible QR panel → QrCode icon button + modal; [LIVECHAT-EVOLUTION-LICENSE] Apache 2.0 attribution in QR modal; commit 54dad09; session 60: [BILLING2] billing page upgrade ✅ — Add Invoice modal (contact typeahead, line items, status, due date); debounced search; row checkboxes + bulk Delete/Export; KvK/Btw on Tenant model + Organisation Settings + SuperAdmin edit modal; GET /billing/invoices/export (CSV/XLSX with KvK/Btw header rows); DELETE /billing/invoices/bulk; new InvoiceStatus values (pending/received/not_sent); migration a0b1c2d3e4f5; commit 2d0146c; session 59: [TK-COCKPIT] ticket detail 3-column cockpit ✅ — compact status/priority dropdowns replace pill buttons; SLA banner + Snooze 24h/Escalate; Reply/Internal Note tabs; CustomerPanel context scan card; `POST /tickets/{id}/snooze` backend; commit 694ec59; session 58: [SENT2] sent mail body ✅ — `body TEXT` on outbound_emails (migration c9d0e1f2g3h4), flush_pending_sends stores reply_text, tracking-path Sent cards open SentMailModal instead of broken DraftReview link; [ACT3] activity pagination ✅ — 10/page with Prev/Next, limit raised to 500, stage filter resets page; [SIDE1] sidebar fixed overlay ✅ — sidebar now `fixed left-0 top-0 z-40`, main gets `md:ml-14` so content x never shifts on collapse/expand; [TK4] verified already done in TicketDetail.tsx; session 57: [ACT2] activity page fixed ✅ — `ContactPipelineEntry.id` AttributeError in `get_kpis()`, fix + hardened ActivityFeed error state; [P2] stage changes as activity events ✅ — moved into `_assign_stage()`; [CAM-SIMP] button actions → pipeline_stage only ✅; [BK2] + New booking button in panel + gear ⚙ → settings modal ✅; [BK3] propose dates already shipped in BK1 ✅; sent mails fix — `sentEvents` query now always enabled, falls back when outboundEmails empty; added [BK5] smart scheduling to ROADMAP; session 56: [TK5] "Waiting for customer" display rename ✅ — `waiting` enum value relabelled + amber badge in TicketList + TicketDetail (frontend-only, no migration); [EMPTY1] inbox empty state + button spinners ✅ — "All Caught Up" component with rotating fun-facts (2min interval) on pending tab; spinners on DraftReview approve/send, TicketDetail status+comment, ContactDetail save; commit 0e7dbc0; [TAG-RM] tag UI removed ✅ — no DB tables existed; removed legacy tags input from DraftReview new-contact form + ContactDetail; [UI1] UI consistency audit ✅ — button hierarchy (primary/secondary/danger/ghost), all modals → max-w-lg, card styles normalized; 10 files across tickets/contacts/admin/booking/calendar/inbox/superadmin; commit ecf87a7; [OPT1] optimistic UI updates ✅ — ticket status, draft approve/reject, contact labels, pipeline stage, ticket comments all update instantly with rollback + sonner toast on error; commit 89a7ff4; session 55: [BK1] booking system ✅ — `calendar_settings` + `booking_tokens` tables (migration v2w3x4y5z6a7); booking module backend (GET/PATCH /booking/settings, POST /booking/send, GET/DELETE /booking/tokens, public GET+POST /public/booking/{token}); public `/book/:token` BookingPage (propose accept/decline + open slot picker); SendBookingModal shared component; "Send booking link" on ContactDetail + TicketDetail; Kanban multi-select checkboxes + bulk action bar; Calendar page Bookings slide-over panel + collapsible booking settings section; commit 38c9c6d pushed to devsandbox — pending sandbox verification; session 54: [TE3] campaign-button action types ✅ — added direct-link actions **open website** / **send mail** / **call phone** alongside the existing label + pipeline-stage tracked actions; new `CampaignButton.action_value` field; `build_direct_action_href()` in email_html.py builds mailto:/tel:/https hrefs (no token, no DB row) that flow through `token_map` so both the Unlayer `inject_button_tracking` path and the plaintext `render_campaign_buttons_html` path use them; TemplatesPage button-actions panel gained the 3 new options + a url/email/tel value input; [Cal1] verified already shipped (commit 367ac95) — `_notify_contact` + `notify_contact` opt-out flag on create/update, change-detection on contact-link/start-time, branded Resend invitation email; session 53: [KAN-RN] + [SIDE-COL] done — "Pipeline"→"Kanban" display rename across 5 frontend files; collapsible icon-only sidebar with localStorage persistence; session 52: Billing/plans ✅ — Tenant.plan SaaS tiers (free/starter/pro/enterprise), migration u1v2w3x4y5z6, plans.py PLAN_FEATURES map, require_feature 402 gate, PlanGate frontend, superadmin plan selector; session 51: [I1] inbox search ✅ — debounced search across Pending/Processed/Sent, persists across tabs, `?q=` on drafts + outbound, GET /inbox/trending, migration t0u1v2w3x4y5 pg_trgm indexes, Sent 9/page, Processed pills→dropdown; session 50: [S1] multi-signature per user ✅ + [S2] signature image upload ✅ — user_signatures table, migration s9t0u1v2w3x4, base64 inline images; session 49: Tier 3 batch — [TE4] AI tip hint ✅, [35-backlog] hotkeys j/k/r/e ✅, [43] deadline toast ✅, [48] clickable rows ✅; ROADMAP cleanup — [30] broadcast ✅, Mobile web ✅, [C1] ✅, [C2] ✅, [V1] ✅, [36b-5] ✅, [T1] ✅; session 48: [Phase 12] demo provisioning ✅ DONE — POST /public/request-demo creates is_demo tenant + invite + root-tenant Contact + Ticket; demo_expiry_check hourly job deactivates 7-day-old demos + emails ADMIN_EMAIL; /request-demo frontend page; broadcast spam fix: List-Unsubscribe + List-Unsubscribe-Post headers on bulk mail; session 47: pipeline stage save fix + sent mail delivery dates; session 46: [BR1] ✅ DONE — brand colour picker in Settings (BrandingSection card + PATCH /team/branding) + reset-to-default in SuperAdmin Clients Branding tab; [36b-8] ✅ DONE — DepartmentsPanel widened to w-80; [BR1] branding colour picker added to roadmap; removed broadcast button; session 45: [C1] compose rich template ✅ DONE — campaignButtonsJson now propagates through InboxQueue TemplatePicker → ComposeInitialState → ComposeModal; session 44: PostgreSQL RLS policies ✅ DONE — migration n4o5p6q7r8s9 adds tenant_isolation on 8 unprotected tables; session 43: [TK1] tickets multi-select + bulk delete ✅ DONE, [36b-3] company filter verified done; 2026-06-13: [36b-8] Team/Departments panel layout reopened; [C1] compose rich template not loaded into editor added; [T1] template editor popup reopened (not live in sandbox); [TK1] tickets multi-select + delete, [UI1] full UI consistency audit added; [36b-5] companies multi-select reopened (not live in sandbox); session 42: Tier 1 checklist reconciliation — [21] onboarding wizard marked ✅ DONE (fully built), RLS description corrected to list 6 missing tables; session 41: [T1] template editor full-screen modal; session 40: [36b-7] clickable sent cards, [36b-5] companies multi-select+bulk, [36b-2] contact inline edit modal, fixed rich template html_body not sent on compose, Platform Modules now shows Calendar+EmailTracking; session 39: Tier 3 batch [36b-9] sidebar Settings active-state bug, [36b-1] contact bulk action order, [36b-4] companies search bar, [V8] DeptModal TemplatePicker; session 38: Calendar module — monthly grid, events + sla_due_at deadlines, contact/ticket typeahead; session 37: Phase 9C tracked-click tokens, T2 campaign buttons as Unlayer blocks, emailtracking module; post-36b: bulk action order, inline edit popups, company dropdown/search/multi-select, XLSX fix, Sent UI, departments polish, sidebar active-state bug [36b-1–9]; session 36b — contacts import/export/multi-select [29][40][20]; session 36 Tier 3 batch V2 V3 V5 V6 V7 V9-V11 TE1 TE2)
**Repo:** github.com/DBrinkman1710/obsidian-vault
**Branch:** `sandbox`

---

## 🧭 How this roadmap is organized

Open work is grouped into **three tiers** by size/complexity, and each tier is mapped to the
Claude model to build it with:

| Tier | Nature of work | Model |
|---|---|---|
| 🟣 **Tier 1** | Big, complicated & creative | `Opus` |
| 🔵 **Tier 2** | Medium | `Sonnet` |
| 🟢 **Tier 3** | Quick & easy fixes / wins | `Haiku` |

Item numbers (`[11]`, `[38c]`, …) are kept so each item still maps to its history in the
**Session log** (Appendix A). Finished work is collapsed under **✅ Done**; full architecture /
environment / deploy reference lives in **Appendix B**.

---

## ⚠️ How to maintain this file — read before editing

This file has **four independent places** where item status is recorded. They must all agree. When an item ships, update **all four** — missing even one is how drift happens.

| Section | Role | What to do when an item ships |
|---|---|---|
| **Line 1 header** | Running session log — updated every session | Prepend `[ITEM-ID] ✅ — one-line summary` at the start |
| **Go-live scope** (lines ~35–70) | Checkbox list for pre-launch items | Change `- [ ]` to `- [x]` and append `✅ session N` |
| **"New items collected" blocks** (▶ Next session section) | Where items are first written down | Strike through with `~~text~~` and add `✅ DONE (session N)` |
| **Tier 1 / 2 / 3 body** (the main open-work sections) | Authoritative per-item spec | Strike through the bullet and add `✅ DONE (session N) — one-line summary` |

**The most common mistake:** updating the header + go-live scope but forgetting the Tier body entry, or vice versa. The Tier body entries are the authoritative source — if they still say "not built", Claude Code will treat the item as open regardless of what the header says.

**Before starting a session**, scan for items the user says are done and verify the code before marking them. `grep` for the key symbol/function/component name — if it exists, it's done.

**When in doubt about status**, the code is the truth. The roadmap is a summary, not a source of truth.

> **Note (2026-06-11):** the tiers were reconciled against the actual `apps/app` code. A batch of
> items previously listed as open turned out to be shipped (impersonation, bulk bin/spam, retention
> scheduler, `is_active`/`go_live_at` enforcement, per-tenant webhook routing, undo-send polish,
> attachment chips, response-template backend, …) and were moved to **✅ Done**. Only verified-open
> work remains in the tiers below.

---

## 🎯 Go-live scope — 2026-06-28

Everything below must be done **before** going live. Items not listed here are deferred to after launch.

**Prep (do first):**
- [x] [GOLIVE-CHECKLIST] Write `GOLIVE.md` ✅ session 60 — 9-section checklist at `/yippie/GOLIVE.md`; covers Railway env vars, DNS, Resend, first deploy, smoke tests, post-deploy ops

**Tier 3 / ops (quick):**
- [x] [LIVECHAT-QR] Fix WhatsApp QR code ✅ already working (session 59 webhook fix); QR moved behind icon button (session 61)
- [x] [LIVECHAT-EVOLUTION-LICENSE] Evolution API attribution notice ✅ session 61 — Apache 2.0 notice inside QR modal
- [x] [CO-CLICK] Companies clickable → contact list ✅ session 60
- [x] [36b-6] XLSX import fix ✅ session 60
- [x] [V4] Profile: narrow email/signature box ✅ session 60
- [ ] [PRIV1] Railway private DB URL (env var, no code)
- [ ] [Phase 13] Set invite-link base URL env vars
- [ ] Set `INBOUND_EMAIL` + `diederik@getyippie.com` in live Railway envs

**Tier 2 (features):**
- [x] [BILLING2] Billing page upgrade ✅ session 60
- [x] [MERGE-TK] Merge Tickets ✅
- [x] [TK-COCKPIT] Ticket detail 3-column cockpit ✅ session 59
- ✅ [AI-BTN1] Generate buttons instead of auto-AI (inbox part DONE) + demo tool on getyippie.com ✅ DONE (session 73)
- ✅ [WEB-PLANS2] 3 base plans + module add-ons on getyippie.com ✅ DONE (session 73)
- [x] [GRAPES1] Replace Unlayer with GrapesJS ✅
- [x] [DEPT-MOD] Make Departments a proper module ✅ session 63
- [x] [BK5] Smart scheduling — weekly availability grid ✅ (verified built end-to-end)
- [x] [BK6] Customer counter-propose dates ✅ (verified built end-to-end)
- [x] [BK7] Booking confirmation: customer edit/cancel link ✅ (verified built end-to-end)
- [x] [DEMO-WF1] Demo-request → Kanban "Demo requested" stage ✅
- [x] [KANBAN-STAGES] Customisable Kanban stages per tenant ✅
- ✅ [P1] Stage filter on Activity page — verified already built (session 73)
- ✅ [T1] Delete users from team — verified already built (session 73)
- ✅ [SIDEBAR-DND] Sidebar drag-and-drop reorder per user ✅ DONE (session 74)
- ✅ Send-from aliases + in-app tour after first login ✅ DONE (session 75)

**Deferred (after June 28):**
[CUSTOM1], [B2X1], Per-tenant custom domain, [Phase 11C T2] "Connect your inbox", [LANG1], [WEB-CONS1], Customer data + AI briefing, [AI-MOD1] Self-hosted AI module, [SALES-MOD1] Sales module (website tracking tag), [TRACK1] Track & trace module, [EMBED1] Lead capture embed widget

**Post-launch build order:**

| Priority | Item | Effort | Why |
|---|---|---|---|
| 1 | [EMBED1] Lead capture embed widget | Low | Immediate value, reuses Phase 12 pattern, works day one — turns every client's website into a Kanban funnel |
| 2 | [SALES-MOD1] Sales module | Medium | High differentiation once adopted; feeds behavioral data into AI context |
| 3 | [TRACK1] Track & trace | Medium | High value for commerce clients; depends on clients connecting their shop/Sendcloud |
| 4 | [AI-MOD1] Cloud LLM | High | Biggest long-term moat — but only compounds with volume. At 5 tenants it's a cheaper Anthropic replacement. At 50+ tenants with real conversation history it becomes defensible. Build last, after data exists to train on. |
| 5 | [CLUSTER1] Issue cluster generator | Medium | Depends on [AI-MOD1]. Groups open tickets by theme to surface recurring problems — turns raw volume into actionable insight for agents and content teams. |
| 6 | [JARVIS1] Quick-capture assistant | High | Sticky daily-use differentiator — reduces context switching for agents; personal reminders + contact/ticket notes from one hotkey; AI routing uses Anthropic API early, upgrades when [AI-MOD1] ships |

**The differentiation:** No SMB competitor combines behavioral tracking ([SALES-MOD1]) with a learning, tenant-aware AI ([AI-MOD1]). Intercom has AI but it's stateless and expensive at scale. Zendesk has tracking but it's disconnected from the AI. The combination is the moat — build [SALES-MOD1] first so the data is already accumulating when [AI-MOD1] is ready to consume it.

**[AI-CTRL] Cloud LLM control panel** — `Sonnet` — *post-launch. Superuser only.* A dedicated page in the superadmin UI (`/superadmin/cloud-llm`) listing every Cloud LLM feature. Each tool has: an on/off toggle (globally or per-tenant), a description of what it does, and a "Test" button that runs the feature against a selected tenant with sample data and shows raw output. Accessible only to superusers (same guard as `SuperAdminPage`). Ships new features dark — toggle them on per-tenant as they're validated. Depends on [AI-MOD1].

**[AI-MOD1] Self-hosted AI module** — `Opus` — *post-launch.* Replace the Anthropic API key with a self-hosted open-source LLM (Llama 3 70B or Qwen 2.5 72B) running on Digital Ocean. Unlike the stateless Anthropic API, the self-hosted model accumulates context: fine-tuned over time on real tenant conversations, fed full customer + tenant memory without per-token cost pressure, and queryable against the existing RLS-isolated Postgres on Railway. Two context scopes: (1) tenant context — what the client's business does, their product, tone, config; (2) customer context — who this end-user is, full conversation history, behavioral data. Serving stack: Ollama (dev) → vLLM (production); memory layer: pgvector on existing Railway Postgres; LiteLLM proxy to make model swapping transparent. Data collected from day one (conversation transcripts, outcomes, behavioral events) must be in a clean, labeled format ready for fine-tuning. This is the core product moat: more tenants → more training data → smarter model → better product.

**[CLUSTER1] Issue cluster generator** — `Sonnet` — *post-launch, depends on [AI-MOD1].* Uses the cloud LLM (or Anthropic API as an interim fallback) to automatically group open tickets and livechat sessions by theme (e.g. "billing questions", "delivery issues", "password reset"). Surfaces as a "Top issues this week" card on the Activity page or a dedicated Insights tab: cluster name, ticket count, and example subjects per group. Agents see recurring problems at a glance — useful for proactive FAQ/docs, campaign targeting, and detecting incidents early. Implementation: periodic batch job reads open ticket subjects/descriptions, embeds them (pgvector), runs k-means or LLM-summarised clustering, writes cluster summaries to a `ticket_clusters` table (tenant-scoped, RLS-isolated). Frontend: widget on ActivityFeed + optional `/insights` route. Depends on [AI-MOD1] for cost-effective embeddings at scale; Anthropic API works as a fallback for early tenants.

**[JARVIS1] Quick-capture assistant** — `Opus` — *post-launch.* A `⌘K` / `Ctrl+K` hotkey (configurable per user) opens a **small floating popup** — same size and style as the ticket notification toast — anchored bottom-right (or bottom-center). Not a full modal overlay. Single free-text input with a context chip; the AI classifies intent and routes the action based on what was typed plus the current page context (which contact, ticket, or page the agent is on). No page switching required.

**Four entry points:** (1) Global hotkey anywhere in the app. (2) Right-click on a contact row → "Add note". (3) Right-click on a ticket row → "Add note". (4) Context menu on contact/ticket detail pages.

**Action types the AI routes to:**
- **Personal reminder** — "Remind me at 12:00 to follow up with Jan" → `user_reminders` row (`user_id`, `tenant_id`, `body`, `remind_at`); APScheduler minute-job fires a WebSocket in-app toast at the scheduled time; dismissible.
- **Contact note** — when a contact is in context or named, appends a `quick_note` `activity_event` to that contact's timeline.
- **Ticket note** — when a ticket is in context, adds an internal note to that ticket.
- **Customer context query** — "What do we know about this customer?" or "What's Jan's history?" → AI pulls the contact's full context (tickets, recent activity, chat history, pipeline stage, notes) and returns a brief summary card inline in the popup. No page navigation needed. The AI uses the **tenant's own context** (what the business does, their products, common issues) to frame the answer — each tenant's Jarvis knows their domain.
- **Quick inline edit** — after a context query, the popup surfaces editable fields (phone, company, pipeline stage, labels) so the agent can update the record without leaving the page. Changed fields save via existing PATCH endpoints; success reflected with a mini confirmation.
- **Quick search / navigate** — "Find Jan Brinkman" or "Open ticket 142" → navigates to the correct page.

**Context injection:** the popup passes `{context_type: "contact" | "ticket" | "none", context_id}` to the backend. AI skips disambiguation when context is obvious — typing "add note: interested in Growth plan" while viewing a contact immediately attaches the note.

**Tenant context (the AI knows your business):** `POST /quick-capture` includes the tenant's business context (fetched once from `Tenant.description` / product catalogue / common ticket themes) in the system prompt. Janssen's AI knows Janssen sells garden furniture; Acme's AI knows Acme does SaaS billing. This is what makes it feel like *their* Jarvis rather than a generic assistant.

**User configuration:** a small settings icon in the popup header opens a compact preferences panel (stored in `users.jarvis_prefs` JSONB): configurable hotkey, toggle which action types are enabled (reminder / contact note / ticket note / context query / inline edit), default context mode. Saved via `PATCH /auth/me`.

**DB:** `user_reminders` (id, user_id, tenant_id, body, remind_at, dismissed_at, created_at) RLS-isolated. `users.jarvis_prefs` JSONB (migration). Contact/ticket notes reuse `activity_events` with `event_type="quick_note"`.

**Frontend:** `QuickCapturePopup.tsx` — compact floating card (≈ ticket notification width), bottom-right, shadow, rounded, context chip, type-ahead suggestions (recent contacts, open tickets), Enter to submit, Escape to close, gear icon for preferences. `useQuickCapture()` hook in `App.tsx`. Right-click menus on `ContactsPage.tsx` + `TicketList.tsx` + detail pages.

**Backend:** `POST /quick-capture {body, context_type, context_id}` → Claude Haiku classifies intent, extracts entities, executes action, returns `{action_taken, summary, inline_data?}` where `inline_data` carries editable fields for the context-query path. Anthropic API now; swap to [AI-MOD1] when available. Gated via `[AI-CTRL]`; counts against AI usage.

**The vision:** this is the Jarvis layer — one always-available input that understands where you are, who you're looking at, and what your business does. Phase 1: notes, reminders, customer context. Phase 2: natural-language queries ("how many open tickets does Acme have?"), task delegation ("create a follow-up ticket for Jan in 3 days"). Phase 3: multi-step workflows and proactive nudges. All from the same small popup.

**[EMBED1] Lead capture embed widget** — `Sonnet` — *post-launch. Optional per tenant.* Clients generate a snippet in their Yippie settings and paste it on their own website. When a visitor clicks the button, a small branded modal appears (name, email, optional message field). On submit: a Contact is created in the tenant's Yippie environment (or matched if the email already exists) and automatically placed into a pre-configured Kanban stage. Use cases: "Request a demo", "Get a quote", "Book a callback", "Join the waitlist" — the button label and target stage are both configurable per tenant. Implementation: `POST /public/embed/{tenant_slug}` (unauthenticated, rate-limited); snippet generator in Settings → Integrations that outputs a `<script>` tag + optional `<a>` button; snippet carries a signed `tenant_slug` + `stage_id`. No iframe required — lightweight JS that injects a modal. Same pattern as `POST /public/request-demo` (Phase 12) but white-labelled per tenant.

**[SALES-MOD1] Sales module — website tracking tag** — `Opus` — *post-launch. €20/month add-on.* A lightweight JS snippet (`<script>`) that clients embed in their frontend (commerce or SaaS). Fires events (page views, clicks, purchases, feature usage, checkout abandonment) to a dedicated ingest endpoint, stored in Postgres under the tenant's RLS partition. This behavioral data feeds directly into [AI-MOD1]'s customer context — the AI knows what a customer *did* before they asked a question ("browsed checkout 3× before contacting support"). The combination is the differentiator vs Intercom/Zendesk. Ingest: thin FastAPI endpoint or Cloudflare Worker for edge latency. Tag: CDN-hosted JS or npm package to minimize client dev friction. Must handle GDPR/CCPA consent signals from day one. Optional: basic behavioral dashboard (customer timelines, top drop-off pages before support tickets) to make the €20 feel like a standalone product.

**[TRACK1] Track & trace module** — `Opus` — *post-launch. Commerce clients only.* Lets B2C commerce clients connect their order/shipment data so customers can track orders directly inside the Yippie-powered support experience.

**Carrier strategy — aggregator-first (scalable):** Integrate with **Sendcloud** (Dutch company, Eindhoven) as the single middleware layer. One API covers PostNL, DHL, DPD, GLS, UPS, Hermes, and 80+ carriers via a normalized status schema + webhooks. Adding carriers or expanding to BE/DE/FR requires zero extra code. Never integrate with individual carrier APIs directly.

**Integration model:** Client's shop (Shopify, WooCommerce, or custom) sends a fulfillment webhook to Yippie when an order ships — payload includes `order_id`, `tracking_number`, `carrier`. Yippie queries Sendcloud's tracking endpoint to fetch current status + event history, then subscribes to Sendcloud webhooks for push updates on every scan. Works regardless of whether the client is on Sendcloud themselves — only the tracking number is needed.

**DB schema (per tenant, RLS-isolated):**
```
shipments: tenant_id, order_id, tracking_number, carrier, status, last_scan_location, estimated_delivery, events JSONB, customer_contact_id, created_at, updated_at
```
`events JSONB` = array of `{timestamp, location, description}` — the full scan timeline from pickup to delivery.

**Surfaces as:**
1. Order timeline card in CustomerPanel on TicketDetail — agent sees full shipment history without leaving the ticket
2. AI reads shipment context automatically — knows order status, last scan, ETA before the customer says anything
3. Optional: public self-service order status page (`/track/:order_id`) branded per tenant

**NL-first launch:** PostNL + DHL via Sendcloud. Expand to other carriers and countries as demand grows — no architecture changes needed.

---

## ▶ Next session — start here

**Bugs still open — needs code (session 27 verification):**

- ~~**Inbox select-all not sticky**~~ ✅ **DONE (session 29)** — sticky select-all header.
- ~~**Inbox pagination**~~ ✅ **DONE (session 29)** — 9 items/page with next/prev.
- ~~**Deadline indicator redesign**~~ ✅ **DONE (session 29)** — two numeric count badges (red + orange) on the Tickets nav; backend uses per-tenant thresholds.
- ~~**Inbox fetch dot**~~ ✅ **DONE (session 29)** — grey when idle, solid green when fetching, no glow.
- ~~**Hotkeys on/off toggle**~~ ✅ **DONE (session 27)** — per-user toggle in Profile.
- ~~**Activity page blank**~~ ✅ **DONE (session 42)** — rebuilt `ActivityFeed.tsx`: stat cards now show real activity counts (today/this week/all time) via new `service.get_activity_stats()`; event rows humanized with actor name, colored module dot, clickable links to tickets/inbox drafts; typed `ActivityEventOut` interface (no more `any`). Removed `ticket_service` proxy from `/activity/stats`. Tickets now emit `ticket_created`, `ticket_status_changed`, `ticket_assigned`, `ticket_commented` events via `activity_service.log_event` in `tickets/router.py`. `list_events()` LEFT JOINs users table to resolve `actor_name`.
- ~~**Attachments**~~ ✅ **DONE** — forward carries attachments, pickers enforce 10/25 MB caps; verified in sandbox.

**New items collected (session 30 — 2026-06-11):**

- **Inbox: duplicate select-all** — two "select all" controls present; keep only the upper one, remove the lower.
- **Inbox: add Sent tab** — inbox currently shows Pending + Processed tabs; add a Sent tab (sent mail already has a backend view `[41]`, surface it here alongside the others).
- **Client info page: remove Inactivate + Delete** — these actions already live in the Actions tab of the edit modal; remove them from the Info tab to avoid duplication.
- **Client actions: remove "Copy email"** — copy-email belongs in the Info tab, not the Actions dropdown; remove it from Actions.
- **Multi-signature support** — each user can have multiple named signatures; Profile shows a list with a "+" button to add more; existing single-signature field becomes the first entry. See Tier 2.
- **Signature image upload** — users can embed an SVG, PNG, or JPEG image in their signature. See Tier 2.
- **Delete users from team (admins + superusers)** — Team page should allow admins and superusers to remove users, not just inactivate them. See Tier 2.
- **Departments → Team page** — move the Departments section from its own page onto the Team page, side-by-side with the team list; make the department bar narrower to fit. See Tier 3.
- **Profile layout: password next to signature** — the password-change block should sit beside the signature box in a two-column layout; shrink the password box width to match. See Tier 3.

**New items collected (session 34 — 2026-06-12):**

- ~~**[V1] Sent inbox not showing mails**~~ ✅ **DONE (session 42)** — Activity module repaired (see above); Sent tab's `/activity?limit=500` call now returns inbox events correctly.
- **[V2] All contacts button in compose broken** — "All contacts" button in ComposeModal's ContactSearchPicker does not populate the recipient list. Was made lazy in session 24 (fetchQuery on click); the click handler may be wired incorrectly. See Tier 3.
- **[V3] Compose: default From = personal mail when in personal inbox** — When the user is viewing their personal inbox and opens ComposeModal, the From field should pre-select their personal address (`user.inbound_email`). User can switch it manually. See Tier 3.
- **[V4] Profile: narrow email/signature box** — The signature card is currently flexible-width; make it slightly narrower so the Change Password card (280 px) sits comfortably beside it without cramping. See Tier 3.
- **[V5] Profile: signature inside email box** — Move the signature textarea into the same card as the personal email address field, rather than a separate card below. See Tier 3.
- **[V6] Team page: align departments panel top with team list** — DepartmentsPanel column is vertically offset; align its top edge with the team members list header. See Tier 3.
- **[V7] Team page: narrow team members list** — Reduce the team members column width (same ratio as the email box) so the DepartmentsPanel gets more horizontal breathing room. See Tier 3.
- **[V8] Department edit modal: show reply template picker** — When editing a department in the modal (DeptModal), add a TemplatePicker so a default reply template can be assigned to the department. See Tier 3.
- ~~**[V9] Remove Departments from Settings page**~~ ✅ **DONE (session d-20260622)** — `/settings/departments` route + `DepartmentsPage` lazy import removed from `App.tsx`; `DepartmentsPage.tsx` deleted (had been re-introduced via merge after session 36).
- ~~**[V10] Add contact labels to Settings page**~~ ✅ **DONE (session d-20260622)** — `ContactLabelsCard` component added to `LabelsPage.tsx` (main Settings page); CRUD via `GET/POST/PATCH/DELETE /contacts/labels`; list with colour dot + edit/delete per row, add form with colour picker. Admin-only.
- ~~**[V11] Remove standalone Labels page**~~ ✅ **DONE (session 36 + d-20260622)** — `/settings/labels` route + sidebar link already gone; V9 re-removal completes the cleanup.

**New items collected (session 59 — 2026-06-17) — go-live target: 2026-06-28:**

- **[GOLIVE-CHECKLIST] Write the go-live checklist** — `Haiku` — before any go-live work starts, produce a single checked-off list of everything that must be true on 2026-06-28: Railway env vars set, DNS records verified, INBOUND_EMAIL live, Resend domains verified, superadmin account created on prod, seed data run, smoke-test script, Cloudflare proxy status, any feature-flag or module toggles that need flipping. Output as a section in this ROADMAP (or a standalone `GOLIVE.md`). Do this first so nothing is missed on the day. See Tier 3.
- **[LIVECHAT-QR] Fix LiveChat WhatsApp QR code** — `Haiku` — QR fetch works but fails silently in some envs; check Evolution API env vars + error path in `ChatPage.tsx` lines 53–55. See Tier 3.
- **[GRAPES1] Replace Unlayer editor with GrapesJS** — `Sonnet` — swap `react-email-editor` (Unlayer) for `grapesjs` + `grapesjs-preset-newsletter` (email-safe output, inline styles). Build on a feature branch; merge only after tests pass. Campaign buttons stay as custom drag-and-drop blocks (re-implement as GrapesJS block types). Affects `TemplatesPage.tsx`, `TemplatePicker.tsx`, `DraftReview.tsx`, `InboxQueue.tsx`. See Tier 2.
- **[BILLING2] Billing page upgrade** — `Sonnet` — (1) Add Invoice modal: create invoice manually, tied to existing contact or company via searchable select; statuses = Pending / Received / Not Sent. (2) Search bar above table (filter by invoice # or customer). (3) Row checkboxes + bulk Delete/Export actions. (4) KvK-nummer + Btw-nummer fields in Organisation Settings (on `tenants` table, exposed in admin). (5) Export CSV/JSON/XLSX with tenant KvK/Btw in header metadata. Files: `InvoiceList.tsx`, `billing/models.py`, `billing/schemas.py`, `billing/router.py`, `billing/service.py`, `admin/schemas.py`. See Tier 2.
- **[MERGE-TK] Merge Tickets** — `Sonnet` — "Merge" button on TicketDetail opens modal; agent picks primary + secondary ticket (search by ID or subject, same contact). Backend: re-parents all `email_messages`, `comments`, `activity_events` from secondary → primary ticket_id; secondary status → Closed + internal note "Merged into ticket #[primary]"; primary gets activity note "Ticket #[secondary] merged in". `POST /tickets/{id}/merge`. Files: `TicketDetail.tsx`, `tickets/router.py`, `tickets/service.py`, `tickets/models.py`. See Tier 2.
- **[TK-COCKPIT] Ticket detail — 3-column cockpit** — `Sonnet` — replaces + supersedes [TK-PAGE]. Col 1: existing sidebar. Col 2 (main/wide): title, compact status/priority dropdown top-right, SLA banner with Snooze 24h / Escalate buttons, Reply/Internal Note tabs (Reply = white, Note = soft yellow background). Col 3 (right/narrow): contact card (name, company, phone, email, labels, recent ticket count from `GET /contacts/{id}`) + mini AI context scanner (subject, invoice nr, previous mails). File: `TicketDetail.tsx`. See Tier 2.
- **[CO-CLICK] Companies clickable → contact list** — `Haiku` — company name/badge in Contacts page and elsewhere links to a filtered contact list view for that company. Reuse existing `?company_id=` filter. File: `ContactsPage.tsx`. See Tier 3.
- **[LANG1] Language switch (EN / NL)** — `Sonnet` — user setting in Profile to pick UI language; English default. Dutch translation for all sidebar labels, common UI strings, and status labels. Use i18next or a simple JSON map. See Tier 2.
- ~~**[DEPT-MOD] Make Departments a proper module**~~ ✅ **DONE (session 63)** — See Tier 2 section.
- ~~**[DEPT-ROUTING] Department inbox routing + shared/personal toggle**~~ ✅ **DONE (session 67)** — See Tier 1 section for full build summary.
- **[RBAC1] Full RBAC + permission matrix** — `Opus` — `roles` table (tenant-scoped), `permissions_matrix` (user/role/dept × module × access_level enum full/view/restricted). Default = full (matrix only stores downgrades). Hierarchical resolution: user-override → dept → role → default full. Backend `checkModuleAccess(moduleKey)` middleware on all module routers. Frontend: green check / orange eye / red cross indicators; hide/block UI on view/restricted. Admin UI: user row with role dropdown + dept multi-select + per-module access grid. See Tier 1.
- ~~**[WEB-PLANS2] Commercial site: 3 base plans + module add-ons**~~ ✅ **DONE (session 73)** — See Tier 2 section.
- **[AI-GEN] Generate buttons (same as [AI-BTN1])** — see existing [AI-BTN1] entry in Tier 2.
- **[CAM1] Email Campaign Creator module** — `Opus` — full campaign lifecycle built on top of [GRAPES1]: campaigns + campaign_templates + campaign_analytics DB tables; GrapesJS campaign designer canvas; Resend batch dispatch with open-tracking pixel; reply tracking via inbound webhook + AI classifier; Activity timeline campaign filter + analytics card (Sent / Opened% / Reply% / sentiment bar). Deferred until after June 28 — depends on [GRAPES1] merge. See Tier 1.

- ~~**[TK-CONTEXT] Contact context panel broken on ticket page**~~ ✅ **DONE (session 61)** — deduped parent `ticketContact` query key to avoid cache conflict with CustomerPanel's own contact query; added `isLoading` skeleton + `retry: 1` to the contact fetch; `'…'` → `'—'` placeholder so loading vs no-data is clearer.
- ~~**[PROF-LAYOUT] Profile page — two-column split layout**~~ ✅ **DONE (session 61)** — removed `max-w-4xl`; `gap-6`→`gap-8`; password card `w-[280px] shrink-0`→`w-96 flex-shrink-0` — matches the established two-column rule.
- ~~**[WEB-LOGO-BG] Logo (no text) as oversized background element on commercial site**~~ ✅ **DONE (session 61)** — `logo-blue-bg-mark.svg` added as `absolute -right-24 -bottom-16 w-[36rem] h-[36rem] opacity-[0.04] z-0` in the hero section; section already had `position: relative`.
- ~~**[WEB-FAVICON] Favicon missing on getyippie.com**~~ ✅ **DONE (session 61)** — `icons: { icon: '/favicon.svg', shortcut: '/favicon.svg' }` added to metadata in `layout.tsx`; `favicon.svg` already existed in `public/`.
- ~~**[WEB-NO-FEATURES] Remove Features page + nav link from commercial site**~~ ✅ **DONE (session 61)** — `features/page.tsx` deleted; removed from `SiteNav.tsx`, `SiteFooter.tsx`, `sitemap.ts`; all remaining `/features` links in vs-zendesk/modules/for-agencies/for-smbs redirected to `/modules`.

**New items collected (session 58 — 2026-06-16):**

- ~~**[WEB-HSTS] Ship HSTS header on getyippie.com**~~ ✅ **DONE (session 58 / 2026-06-17)** — `Strict-Transport-Security: max-age=15552000; includeSubDomains` added to `apps/web/next.config.mjs`; deployed via `git push origin commercial` (commit `b74044e`). No `preload` — near-irreversible. Verify live: `curl -sI https://getyippie.com | grep -i strict-transport`.

**New items collected (session 39 — 2026-06-12):**

- ~~**[Cal1] Calendar: automated email to contact when linked to a meeting**~~ ✅ **DONE (shipped commit 367ac95, verified session 54)** — `calendar/service.py` `_notify_contact()` sends a branded Resend invitation (title + human-formatted when + description) on create and on update; fires only when `contact_id` is set, the request's `notify_contact` flag is on, and (on update) the contact link or start time actually changed. Failures are logged, never break the request.

**New items collected (post-session-36b — 2026-06-12):**

- ~~**[36b-1] Contact bulk action order**~~ ✅ **DONE (session 39)** — reordered to Compose → Export → Delete in `ContactsPage.tsx`.
- **[36b-2] Contact / company inline edit popup** — `Haiku` — add a pencil/edit icon button to each row in the Contacts list and the Companies list. Clicking opens a modal to edit that record inline (same fields as the create forms); no page navigation. Reuses `PATCH /contacts/{id}` and `PATCH /contacts/companies/{id}`. See Tier 3.
- **[36b-3] Company filter dropdown in Contacts page** — `Haiku` — add a company filter dropdown (all companies + "All companies" default) alongside the label-filter chips on the Contacts page. Uses the existing `?company_id=` query param. See Tier 3.
- ~~**[36b-4] Search bar on Companies page**~~ ✅ **DONE (session 39)** — client-side search/filter input added to CompaniesTab in `ContactsPage.tsx`.
- **[36b-5] Multi-select on Companies page** — `Haiku` — per-row checkboxes + "Select all" header checkbox on the Companies list. Bulk action bar: **Export CSV** and **Delete** (confirm modal → soft-delete). Mirrors the Contacts multi-select pattern (`[20]`). See Tier 3.
- **[36b-6] XLSX import broken** — `Haiku` — `.xlsx` import via `POST /contacts/import` fails (CSV import works). Likely `openpyxl` missing from the Railway Docker image or incorrect MIME/extension detection. Fix so `.xlsx` imports succeed. See Tier 3.
- **[36b-7] Sent tab: match Pending/Processed UI + clickable rows** — `Haiku` — the Sent tab currently renders a different card layout from Pending and Processed. Align it to use the same mail card component/style as the other two tabs; each sent card should be clickable (open the thread/detail view). See Tier 3.
- **[36b-8] Team page: DepartmentsPanel polish** — `Haiku` — give the DepartmentsPanel a proper border/card outline consistent with the team members panel; align the "Departments" title to the same height as the "Team members" title; use the available horizontal space to make the layout look balanced (e.g. stretch the panel, improve internal padding/spacing). See Tier 3.
- ~~**[36b-9] Sidebar: Settings stays active on superadmin/team/profile pages**~~ ✅ **DONE (session 39)** — `useLocation` used to compute custom `settingsActive` in `Sidebar.tsx`, excluding `/settings/profile`, `/settings/team`, `/settings/superadmins`.

**New items collected (post-session-35 — 2026-06-12):**

- ~~**[T1] Template editor: full-screen pop-up modal**~~ ✅ **DONE (session 41)** — `fixed inset-0 z-50` overlay (90vw × 90vh, rounded-2xl, shadow-2xl); template list stays on the page; modal has name input + Save + X in header; EmailEditor stays mounted after first open (`editorEverOpened` flag + `opacity-0 pointer-events-none` when closed) to avoid Unlayer re-init cost.
- ~~**[T2] Campaign buttons as Unlayer blocks**~~ ✅ **DONE (session 37)** — Campaign Buttons tab replaced with native Unlayer `customTools` drag-and-drop blocks; `design:updated` listener syncs button count to React state; per-button label picker + color/text config panel below canvas; design traversal extracts `campaign_buttons` array at save time. See Tier 1.
- ~~**[TE1] Template editor: remove object deletion warning**~~ ✅ **DONE (session 36)** — `editor: { confirmOnDelete: false }` added to Unlayer options.
- ~~**[TE2] Signature: move inside template content area**~~ ✅ **DONE (session 36)** — signature preview now renders as a `rounded-b-xl` footer attached to the bottom of the Unlayer canvas border; separate bottom card removed.
- ~~**[TE3] Campaign buttons: per-button action type**~~ ✅ **DONE (session 54)** — all five action types now supported: **apply label** + **pipeline stage** (tracked, mint a `LabelClickToken` at send), and **open website** / **send mail** / **call phone** (direct `<a>` links built by `build_direct_action_href()`, no token). `CampaignButton.action_value` carries the URL/email/phone; TemplatesPage button-actions panel exposes all five with the right value input.
- **[TE4] Template editor: AI tip tooltip on HTML button** — `Haiku` — when hovering over the HTML/source button in the template editor, show a small tooltip: "Tip: Use AI to create a mail with HTML". Nudges users toward the AI compose flow for rich content. See Tier 3.

**New items collected (session 35 — 2026-06-12):**

- ~~**[Phase 9B] Full drag-and-drop email template editor**~~ ✅ **DONE (session 35)** — see Tier 1 entry for the build summary.
- ~~**[Phase 9C] Tracked click / campaign buttons**~~ ✅ **DONE (session 37)** — `LabelClickToken` model + migration; `flush_pending_sends()` generates one token per button×recipient, builds `token_map`, injects real tracking URLs into `render_campaign_buttons_html()`; public `GET /track/click/{token}` endpoint burns token + applies label + redirects; `TrackConfirmPage` (thank-you / already-used). See Tier 1.
- ~~**[C1] Column customisation — Contacts & Companies**~~ ✅ **DONE (session 49)** — `ColumnPicker.tsx` + `contact_column_prefs` on users. See Tier 2.
- ~~**[C2] Pre-import column mapping**~~ ✅ **DONE (session 49)** — column mapping step in import flow. See Tier 2.
- ~~**[I1] Inbox search**~~ ✅ **DONE (session 51)** — see Tier 2 entry for the build summary.
- ~~**[W1] Klimaatexamen primary colour not applied**~~ ✅ **DONE** — fixed.
- **[V2] All contacts button in compose broken** — already tracked as Tier 3 (see below). No change needed.

**Additional bugs reported (pre-session-28 — fix alongside the above):**
- ~~**Outbound from-address wrong in ndugu environment**~~ ✅ **DONE** — `queue_send` now resolves `from_email` to `tenant.inbound_email` before `RESEND_FROM`.
- ~~**Settings page broken**~~ ✅ **DONE** — fixed.
- ~~**Client page: too many buttons per row**~~ ✅ **DONE (session 29)** — row shows only View as / Set demo / Edit; toggle/copy/delete in Edit modal's Actions tab.
- ~~**Compose modal: Send/Quit buttons shift on send**~~ ✅ **DONE (session 29)** — `min-w-0` + stable layout.
- ~~**Email sent popup still appears after compose send**~~ ✅ **DONE (session 29)** — modal closes immediately on send; only undo bar shows.
- ~~**Compose modal: close on send, restore on undo**~~ ✅ **DONE (session 29)** — closes immediately, undo bar in parent; undo reopens modal with content restored.

**Legacy open bugs (from before session 27):**
- ~~**New agent arrived as admin**~~ ✅ **DONE** — fixed.
- ~~**Personal inbox leaks across users**~~ ✅ **DONE** — fixed.
- ~~**Personal address only receives after first send**~~ ✅ **DONE** — fixed.

**Manual / ops (Diederik):**
- ~~Cloudflare: delete the duplicate bare DMARC TXT at `_dmarc.getyippie.com`; keep only the one DKIM key shown in Resend at `resend._domainkey.getyippie.com`.~~ ✅ **DONE (2026-06-11)** — single DMARC record with Cloudflare `rua=` reporting, single DKIM verified, SPF verified.
- ~~klimaatexamen tenant `inbound_email` is NULL~~ ✅ **DONE** — set via Clients → Edit → Info tab.
- Set `INBOUND_EMAIL` in both live Railway envs before go-live.

**New items collected (2026-06-13):**

- **[TK1] Multi-select on Tickets page** — `Haiku` — per-row checkboxes + "Select all" header checkbox on the Tickets list. Bulk action bar: **Delete** (confirm modal → soft-delete, same pattern as `DELETE /contacts/bulk`). Mirrors the Contacts multi-select pattern (`[20]`). No export needed. See Tier 3.
- **[UI1] Full UI consistency audit & polish** — `Sonnet` — review every page/component for visual inconsistencies: button sizes/colours/variants, modal sizes (must all match), spacing, typography, card styles, icon sizes, empty states, loading skeletons, error states. Fix anything that deviates from the established pattern. See Tier 2.

**New items collected (2026-06-16):**

- **[WEB-CONS1] Commercial site consistency pass** — `Sonnet` — audit all pages on getyippie.com (`apps/web/`) for visual inconsistencies: layout, spacing, typography, colours, card/section styles, shared nav+footer alignment. Focus on the newer SEO pages (`/features`, `/for-smbs`, `/for-agencies`, `/blog`, `/vs-zendesk`) against the existing hero/pricing baseline. Fix anything that deviates from the established design language without redesigning. See Tier 2.
- ~~**[BIZ-Q1] Business questionnaire → module recommendation**~~ ✅ **DONE (session 70)** — 2-step `/request-demo` flow: step 1 questionnaire (team size, industry, current tooling, top pain points as chips), step 2 inline "Recommended for you" module badges computed client-side from the answers, then the contact form. `POST /public/request-demo` records the answers + recommended modules in the follow-up Ticket description so the root-tenant agent has full context. Coordinates with [CUSTOM1]. See Tier 1.
- **[DEMO-WF1] Demo-request → Kanban "Demo requested" stage** — `Sonnet` — when `POST /public/request-demo` fires, automatically place the created contact into a Kanban stage named **"Demo requested"** in the root tenant (create the stage at position 0 if it doesn't exist). Currently Phase 12 creates a Contact + Ticket but does not move the contact into the pipeline; this closes the loop: *demo requested → contact made → placed in Kanban*. Prerequisite: sandbox → live promotion. See Tier 2.

**New items collected (2026-06-15):**

- ~~**[SENT2] Sent mail content blank when opened**~~ ✅ **DONE (session 58)** — root cause: tracking-path OutboundEmail had no `body` stored; compose items linked to a batch-uuid (not a DraftTicket) → DraftReview blank. Fix: `body TEXT nullable` added to `outbound_emails` (migration `c9d0e1f2g3h4`); `flush_pending_sends()` passes `body=reply_text`; `OutboundEmailOut` includes `body`; Sent tab tracking-path cards now open inline `SentMailModal` (subject, To, status badge, body text; reply items add "View original email →" link).
- ~~**[CAM-SIMP] Campaign button actions: simplify to pipeline stage only**~~ ✅ **DONE (session 57)** — removed apply-label / open-website / send-mail / call-phone action types from `TemplatesPage` button-actions UI; `ButtonAction` type now `pipeline_stage` only; default for new buttons changed; labels query removed. Backend token dispatch still handles old types gracefully.
- ~~**[BK2] Calendar: + New Booking button**~~ ✅ **DONE (session 57)** — added **+ New booking** button in the Bookings slide-over panel header; clicking it closes the panel and opens `SendBookingModal`; added a ⚙ gear icon in the panel header that opens `BookingSettingsModal` (modal form); `BookingSettingsSection` accordion below the calendar was already removed by a prior agent (replaced by `BookingSettingsModal`). No scrolling needed to reach settings.
- ~~**[BK3] Booking: propose specific dates**~~ ✅ **DONE (in session 55 / BK1)** — "Propose times" mode already built into `SendBookingModal`: two-mode toggle ("Customer picks time" / "Propose times"), interactive month calendar with slot chips, proposed-slots list with remove badges; user just needed the + New booking entry point (now wired via [BK2] above).
- ~~**[BK5] Smart scheduling — weekly availability template**~~ ✅ **DONE (verified built end-to-end)** — `Sonnet` — migration `z6a7b8c9d0e1` adds `weekly_slots JSONB` + `use_weekly_slots BOOLEAN` to `calendar_settings`; `booking/models.py` + `schemas.py` (`WeeklySlotEntry`, settings out/update) carry the fields; `booking/service.get_available_slots()` branches into weekly mode (per-day `{time, capacity}` slots, skips past/weekend slots, marks `available=False` when day capacity is reached) and falls back to legacy work-hours when the toggle is off; public `GET /public/booking/{token}` + manage endpoint serve the computed availability; frontend `CalendarPage.tsx` `BookingSettingsModal` shows a "Use weekly schedule" toggle that swaps the hours/interval inputs for a `WeeklyGrid` editor (per-day `+ Add` with `HH:MM` + capacity, irregular times supported). Migration is in the single alembic head's ancestry → deploys via `alembic upgrade heads`. Original spec below.
- **[BK5] (original spec)** — `Sonnet` — current booking settings only support uniform slots (work hours + slot interval). Companies need specific appointment times, e.g. Mon-Fri at 09:15, 11:45, 14:00 with a max of 3 bookings per day. Replace the work-hours/slot-size model with a **weekly schedule**: a grid where per day-of-week the user adds specific `HH:MM` time slots (can be irregular, e.g. 9:15 not just 9:00) and sets a daily capacity. `calendar_settings` table: add `weekly_slots JSONB` (keyed by day 0–6, value = array of `{time, capacity}` objects) and `use_weekly_slots BOOLEAN` toggle. Public `/book/:token` page uses `weekly_slots` when enabled; settings UI replaces hours+interval with a weekly grid when the toggle is on. See Tier 2.
- ~~**[BK6] Customer counter-propose dates**~~ ✅ **DONE** — `Sonnet` — migration `478e0aa6c080` adds `customer_proposed_slots JSONB` + `status_override` to `booking_tokens`; `CounterProposeRequest` schema enforces 1–3 slots; `token_status()` reports `counter_proposed`; `service.counter_propose()` stores the slots and emails the agent (`_notify_agent_counter_proposed`); public `POST /public/booking/{token}/counter-propose` accepts any pending token (mode-agnostic). Public `/book/:token` page: `CounterProposeForm` (1–3 date/time rows) reachable via "Propose your own times →" in **both** propose mode and open mode (open-mode entry point + mode-aware back label added this session — it was previously only wired in propose mode). Agent side: Bookings panel shows a "Waiting" sub-tab listing each token's `customer_proposed_slots` with per-slot Accept buttons that create the CalendarEvent via the confirm endpoint. See Tier 2.
- ~~**[ACT3] Activity page pagination**~~ ✅ **DONE (session 58)** — `eventsPage` state + `EVENTS_PER_PAGE=10` constant; API limit raised to 500; `pageEvents` slice + Prev/Next controls below the events card; stage-filter clicks reset page to 0.
- ~~**[SIDE1] Sidebar collapse: pages stay at same x position**~~ ✅ **DONE (session 58)** — sidebar changed from flex-flow (`shrink-0`) to `fixed left-0 top-0 z-40` overlay; `<main>` given `md:ml-14` (56px = collapsed icon-rail width) so content always starts at the same x position; expanded sidebar (224px) slides over content as an overlay without shifting it.
- ~~**[BK4] Proposed booking slots: block in calendar**~~ ✅ **DONE** — tentative slots blocked in calendar until contact responds.
- ~~**[BK7] Booking confirmation: customer edit/cancel link**~~ ✅ **DONE** — `Sonnet` — migration `b8c9d0e1f2g3` adds `booking_tokens.manage_token` (UUID, unique, generated in `confirm_booking`) + `calendar_settings.cancel_edit_hours_before` (INT, default 24). The customer confirmation email includes a **Reschedule or cancel** button → public `/book/manage/:manage_token` page (`BookingManagePage.tsx`, route registered in `App.tsx`) with full month-grid reschedule picker, cancel-with-confirm, and a locked state ("Changes can no longer be made — please contact us directly") when within the cutoff. Backend: `get_manage_token()`, `reschedule_booking()` (re-checks lock + slot conflict, updates event, emails both parties), `cancel_booking()` (deletes the `CalendarEvent`, clears manage link, emails the agent); `_is_locked()` enforces the window server-side; public `GET /public/booking/manage/:manage_token` + `.../reschedule` + `.../cancel`. Configurable in `BookingSettingsModal`. This session also added the persisting manage link to the **reschedule** confirmation email (`_notify_customer_rescheduled` now takes the token), so a rescheduled customer keeps a working edit/cancel link instead of only the original confirmation having one. See Tier 2.
- ~~**[TK-PAGE] Ticket page full improvement pass**~~ — superseded: customer panel done via [TK4] ✅, cockpit layout done via [TK-COCKPIT] ✅ (session 59), merge done via [MERGE-TK] ✅ (session 76). Remaining open item (reassign to agent) is tracked separately as part of general Tier 2 work if needed.

**New items collected (2026-06-21):**

> **Code verified before logging:** clicking team members opens `EditUserModal` ✅; email + role edit in modal ✅; RBAC role assignment via expandable "Access roles & permissions" row ✅. Only department assignment is missing from the modal.

- **[COM-NAV] Commercial site: header nav misaligned with page content** — `Haiku` — `SiteNav` uses `padding: 0 var(--gutter)` (6 vw) while page sections use `max-width: var(--maxw)` (1180 px) + `margin: 0 auto`. At most viewport widths the nav items are offset from the page content. Fix: wrap the nav's inner row in a `max-width: 1180px; margin: 0 auto` container and drop the raw gutter padding from the outer nav. Files: `apps/web/src/app/components/SiteChrome.module.css`, `SiteNav.tsx`. See Tier 3.
~~**[MKTG-EXPAND] In-app Marketing module: expand feature depth**~~ ✅ **DONE (session 77)** — see Tier 2 entry.
- **[CON-TABS] Contacts: Contacts tab first, Companies second; remove Trash tab** — `Haiku` — Current tab button order is **Companies | Contacts | Trash**. Fix: (1) swap to **Contacts | Companies** (change the array on line 782 of `ContactsPage.tsx` from `['companies', 'contacts']` to `['contacts', 'companies']`); (2) remove the Trash tab button and `{activeTab === 'trash' && <TrashTab />}` render. Soft-delete + scheduled purge continues in the background — users just won't have a UI to restore or permanently delete. See Tier 3.
- **[CON-DELETED] Deleted contacts showing in search and at end of contacts list** — `Haiku` — Soft-deleted contacts (contacts with `deleted_at` not null) appear in search results and are visible (hidden at the bottom) on the main contacts list. Backend service already filters `deleted_at.is_(None)` on list + search, so the leak is likely in a client-side surface — possibly the contact picker in `InboxQueue` ComposeModal, or a stale React Query cache. Investigate which fetch paths skip the filter and fix. Files: `ContactsPage.tsx`, `InboxQueue.tsx` contact picker, `contacts/service.py`. See Tier 3.
- **[CON-PERMDEL] "Delete permanently" button silent failure** — `Haiku` — The Trash tab's `permanentDeleteMutation` calls `DELETE /contacts/{id}/permanent` (requires `AdminUser`). Non-admin users see the button but receive a silent 403 — no toast, no error message. Fix: (1) add `.onError` to `permanentDeleteMutation` with a `sonner` toast, (2) hide the button for non-admin users using `useAuth` role check. Files: `ContactsPage.tsx` `TrashTab` component. See Tier 3.
- **[INBOX-SHIFT] Inbox "Assign to me" with empty result causes layout shift** — `Haiku` — When "Assign to me" is toggled on and there are no matching drafts, the draft list collapses to zero height and the sidebar/page elements shift. Add a `min-h` guard to the draft list container so the layout stays stable when the list is empty. Files: `InboxQueue.tsx`. See Tier 3.
- **[TK-NAV] Tickets page: sidebar disappears on navigation** — `Haiku` — Clicking "Tickets" in the sidebar causes the sidebar menu to disappear. Likely a CSS height or overflow conflict between the tickets list layout and the fixed sidebar overlay (`fixed left-0 top-0 z-40`). Investigate `TicketList.tsx` layout + `App.tsx` shell + `Sidebar.tsx` z-index/height rules and fix. See Tier 3.
- **[TEAM-DEPT] Team: add department assignment to member edit modal** — `Haiku` — `EditUserModal` in `TeamSettingsPage.tsx` lets admins edit a member's email, name, and role — but not their department. Add a department multi-select below the role picker: fetch departments via `GET /departments`, render checkboxes or a multi-select, persist via `PUT /team/users/{id}/departments` (new endpoint) or via the existing department member management endpoints. Files: `TeamSettingsPage.tsx`, `team/router.py`, `team/service.py`. See Tier 3.

**New items collected (2026-06-22):**

**Bugs — app:**
- ~~**[BK-DATE] Booking: available dates cut off around 3 July**~~ ✅ **DONE (session 82)** — root cause was the three public slot endpoints capping the lookahead at `max(booking_expiry_days, 14)` (~2 weeks with the default 3-day link expiry). Split lookahead from link expiry: new configurable `booking_window_days` column on `calendar_settings` (default 60, migration `bk8w_booking_window_days` which also merges heads `a3b4c5d6e7f8`/`n4o5p6q7r8s9`), used by `public/router.py`, plus a "How far ahead customers can book" selector in CalendarPage booking settings.
- ~~**[DEMO-BUG] Request demo: "Something went wrong, please try again"**~~ ✅ **DONE (session 82)** — verified the `RequestDemo`/`Questionnaire` schema and handler match the web form payload exactly (no 422 from shape). Real fix: the `/api/request-demo` proxy collapsed every non-OK upstream response into a generic "Something went wrong", hiding 422/503 causes; it now surfaces the upstream detail (incl. the first FastAPI validation message).
- ~~**[EMAILTRACK-NAV] Email tracking sidebar link opens billing page**~~ ✅ **DONE (session 82)** — verified already correct in current HEAD: `MODULE_MAP.marketing` → `/marketing` and the `/marketing` route both point to `MarketingPage`; `emailtracking` is an in-Inbox feature with no standalone nav item by design. No wrong-path mapping remains.
- ~~**[ROI-FIX] ROI calculator broken — support staff variable not in equation**~~ ✅ **DONE (session 83 — verified)** — `staffCount` was already in the formula (`tickets * staff * minutes * automatable / 60`). No code change needed.
- ~~**[BOOK-LOGO] Booking page shows old logo**~~ ✅ **DONE (session 82)** — BookingPage, MeetPage and BookingManagePage replaced their stale inline hand-drawn SVG mark with the `/logo-lockup-onLight.svg` asset, matching the LoginPage pattern for public light-background surfaces.
- ~~**[LIVECHAT-1PC] WhatsApp livechat: one session per contact for send + receive**~~ ✅ **DONE (session 81)** — root cause was asymmetric phone matching: the inbound webhook used exact + 8-digit-suffix matching (bridging local `0612…` vs international JID `31612…`) but the outbound `_find_or_create_open_session` (Start conversation + Broadcast) matched on exact digits only, so a customer-first session (`31612…`) plus an agent-initiated create from a locally-formatted contact (`0612…`) produced two sessions. Fixed by extracting shared `normalize_phone()` + `find_open_session_for_phone()` in `chat/whatsapp_service.py` and calling it from both the inbound webhook and `_find_or_create_open_session`; one open session now serves both directions. The `[LIVECHAT-SESSION-DEDUP]` partial unique index remains the safety net against concurrent dup opens.

**Bugs — commercial site:**
- **[WEB-CENTER] Commercial site pages not centred on all pages** — `Haiku` — some pages on `getyippie.com` have content that bleeds to the edge or has unequal gutters instead of the `max-width: 1180px` centre column standard. Audit all pages (home, pricing, modules, vs-zendesk, blog, about, privacy, terms, request-demo) and apply consistent centering. See Tier 3.
- ~~**[PRIVACY-FIX] Privacy + terms page content errors**~~ ✅ **DONE (session 83 — verified)** — privacy page already used `support@getyippie.com`; terms page already said "Yippie" not "Yippie BV". No changes needed.

**Features — app:**
- **[BK8] Booking: per-send post-booking pipeline stage override** — `Sonnet` — currently the post-booking Kanban stage is set globally in booking settings. When sending a booking link, allow the agent to pick which pipeline stage the contact moves to after confirming. UI: "Move to stage" dropdown in `SendBookingModal` (optional, falls back to global setting); pass `stage_id_override` on `POST /booking/send`; `booking/service.py` uses override if present. See Tier 2.
- **[UI2] UI consistency audit round 2** — `Sonnet` — new ticket creation modal looks different from the rest of the app (different size, spacing, button variants). Audit all primary create/edit modals (new ticket, new contact, new company, new booking, new calendar event, new department, new campaign) against the `max-w-lg w-full` + button hierarchy standard from [UI1] (session 56). Fix all deviations. See Tier 2.

**Commercial site — features:**
- ~~**[WEB-USE-NAV] Add "Use cases" to commercial site header nav**~~ ✅ **DONE (session 83)** — simple direct link added to `SiteNav.tsx` between Product and Pricing, pointing to `/for-smbs`.
- ~~**[ABOUT-COMP] About page: remove company names, keep descriptions only**~~ ✅ **DONE (session 83 — verified)** — already anonymised; uses generic descriptors like "A major online retailer". No change needed.
- ~~**[BLOG-AUTHOR] Set blog post author to Diederik Brinkman**~~ ✅ **DONE (session 83 — verified)** — both posts already show "By Diederik Brinkman" with JSON-LD author. No change needed.
- ~~**[VS-ZD-FIX] vs-zendesk page: remove AI inbox section, price from €19, no emojis**~~ ✅ **DONE (session 83)** — AI inbox section and price already correct; stripped ✓/✗ symbols, replaced with "Yes"/"No".

**Module & pricing corrections:**
- ~~**[FOUNDER-PLAN] Founder plan: 10 users + 50% discount on modules**~~ ✅ **DONE (session 82)** — `plans.py` `PLAN_LIMITS` Founder raised to 10 users + `module_discount: 0.5`; added `module_discount_for_plan()` and `module_prices_for_plan()` helpers; `GET /tenant/config` now returns the discount-adjusted `module_prices` for the tenant's plan (Founder add-ons show 50% off). (Pricing page Founder card on getyippie.com left for the secondary session's commercial-site pass.)
- **[MODULE-INC] Correct included vs paid modules** — `Sonnet` — only **Inbox** and **Contacts** are included in the base plan. All other modules (Tickets, AI, Calendar, Kanban, Live Chat, Marketing, Departments, Billing) are paid add-ons. Fix: (1) `plans.py` `PLAN_FEATURES`/`PLAN_LIMITS`; (2) pricing page on getyippie.com; (3) module add-on cards to accurately reflect what is and isn't included. See Tier 2.
- **[MODULE-RENAME] Rename emailtracking → "Marketing module"; remove Templates as standalone module** — `Sonnet` — (1) The `emailtracking` module is now fully subsumed by `marketing` (session 69); consolidate them under a single "Marketing" module entry covering both email campaigning and delivery tracking — no duplicate sidebar entries; (2) Remove "Templates" as a standalone sidebar module — templates are an internal tool accessed from within Inbox and Marketing, not a top-level module. Update `ALL_MODULES`, `MODULE_MAP`, sidebar, and route registrations. No data loss. See Tier 2.
- **[MODULE-CONSIST] Commercial site: pricing page lists all modules consistently** — `Sonnet` — not all modules appear in the add-on pricing section. Cross-check the products/modules page against the pricing page and ensure every sold module has a card (Tickets, AI, Calendar, Kanban, Live Chat, Marketing, Departments, Billing, and future: Cloud LLM €20/mo, Webpage Tracking €9/mo). Reference the GitHub products workflow for the canonical list. See Tier 2.
- **[MKTG-PAGE] Marketing module in-app page upgrade** — `Sonnet` — the current marketing module page is mostly a template editor; the full campaign dashboard discussed earlier (campaign list with status/analytics, audience segments overview, drip sequence builder) was specified in [MKTG1] but left thin on the front-end. Build out the full dashboard view as the landing page of the marketing module, with the editor accessible per-campaign. See Tier 2.

**Features — calendar:**
- **[CAL-SPLIT] Calendar: shared vs personal events + booking from personal email** — `Sonnet` — (1) Add `calendar_type: "shared" | "personal"` to `calendar_events` (migration, default "shared"). Calendar page gets a toggle or tabs — **Team** (shared events, visible to all) / **Personal** (user's own events, private) / **All**. New-event modal: shared/personal radio button. (2) `SendBookingModal` gets a "Send from personal work email" checkbox. Unchecked (default): booking confirmation sent from `tenant.inbound_email` (support address). Checked: sends from the agent's personal `reply_from_email` / selected alias — reply-to and From both switch. `booking_tokens` gains a `from_email` field (nullable, falls back to tenant default). Backend `booking/service.py` passes the override through to Resend. Files: `calendar_events` migration, `CalendarPage.tsx` (toggle/tabs), create/edit event modal, `SendBookingModal.tsx`, `booking/service.py`, `booking/schemas.py`. See Tier 2.

**Post-launch (after [AI-MOD1] is set up):**
- **[JARVIS1] Quick-capture assistant** — `Opus` — *post-launch.* Small floating popup (like ticket notification, bottom-right) triggered by `⌘K`. Type anything; AI classifies intent (personal reminder, contact note, ticket note, customer context query, inline edit, navigation) and routes the action using current page context + each tenant's own business context. Right-click "Add note" on contact/ticket rows. User can configure hotkey and toggle action types. `user_reminders` table + APScheduler for timed reminders; notes into `activity_events`. Uses Claude Haiku early; upgrades to [AI-MOD1]. Phase 1: notes/reminders/context. Phase 2: NL queries. Phase 3: multi-step workflows. See post-launch build order + spec above.
- **[CLUSTER1] Issue cluster generator** — `Sonnet` — *post-launch, depends on [AI-MOD1].* Automatically groups open tickets and livechat messages by theme (e.g. "billing questions", "bug reports", "delivery issues") using the cloud LLM (or Anthropic API as interim). Surfaces as a "Top issues this week" widget on the Activity page or a dedicated insights tab: cluster name, count, and example tickets per group. Agents see at a glance what customers ask about most — useful for documentation, FAQ, and proactive comms. Depends on [AI-MOD1] for volume-trained embeddings; Anthropic API works as a fallback in early builds. See post-launch.

**New items collected (2026-06-22 — additional):**

**Bugs — app:**
- ~~**[INBOX-UNREAD] Inbox: unopened mails counter not working**~~ ✅ **DONE (session 83)** — root cause: `?? pending` fallback in badge logic caused shared counter to show all-pending instead of unread-only. Removed fallback; badges now use `unread`/`unread_personal` exclusively. `InboxQueue.tsx`.
- ~~**[INBOX-SHARED-CNT] Inbox: shared mails counter looks off**~~ ✅ **DONE (session 83)** — same fix as [INBOX-UNREAD] above.
- ~~**[BK-HOURS-BUG] Booking: work hours not enforced — slots outside 9:00–17:00 visible**~~ ✅ **DONE (session 84)** — Added `timezone` column to `calendar_settings` (default Europe/Amsterdam, migration `bk_tz_calendar_settings`); `get_available_slots()` now interprets work-start/end and weekly-slot times via `zoneinfo.ZoneInfo(settings.timezone)` before converting to UTC; timezone dropdown added to CalendarPage booking settings modal.

**Bugs — livechat:**
- **[LIVECHAT-ROOT] LiveChat: find root cause + targeted clean fix** — `Sonnet` — LiveChat is still not working after several fix attempts. Approach: (1) check Evolution API instance status and QR/connection state; (2) verify the inbound webhook URL (`/chat/webhook/{tenant_slug}`) is correctly registered with Evolution API and reachable from sandbox; (3) send a test WhatsApp message and trace it through `receive_message()` → `send_to_agents()` → WS broadcast → `ChatPage.tsx`; (4) check the agent WebSocket endpoint (`/ws/agent/{tenant_id}`) connects and stays alive. Fix only the first failing step — do not rewrite working code. Files: `chat/router.py`, `chat/whatsapp_service.py`, `ChatPage.tsx`. See Tier 2.

**Features — app:**
- ~~**[TPL-CONSISTENT] Template editor: consistent layout — presets left, editor right; marketing templates fix; module gating**~~ ✅ DONE (session b-20260622) — TemplatePicker now fetches both response templates (`/tickets/templates`) and marketing campaign templates (`/marketing/campaigns` + per-campaign `/templates`), merged with a "Campaign" badge; Templates button gated by marketing module in InboxQueue + DraftReview; sub-task 3 was already correct (picker is inline, no navigation). See Tier 2.
- **[BK-MULTISLOT] Booking: multiple distinct time slots per day in weekly schedule** — ✅ DONE — backend `get_available_slots()` already iterates all entries per day (verified); `WeeklyGrid` in `CalendarPage.tsx` already renders all day slots with `+ Add` and `×` remove buttons. No code changes needed.

**Commercial site:**
- ~~**[COM-LOGO-VIS] Commercial site: logo more visible**~~ ✅ **DONE (session 83)** — `logo-blue-bg-mark.svg` added as absolute-positioned element in hero (`bottom: -60px; right: -40px; width: 480px; opacity: 0.10`) via `.heroLogoMark` CSS class. `page.tsx` + `page.module.css`.

**App pages:**
- ~~**[AUTH-LOGO-SIZE] Login + booking pages: larger logo**~~ ✅ **DONE (session 83)** — logo enlarged to `w-56 mx-auto` (224px centred) on `LoginPage.tsx`, `BookingPage.tsx`, `MeetPage.tsx`, `BookingManagePage.tsx`.

**Pricing:**
- ~~**[PLAN-STARTER] Starter plan: max 3 users or price update**~~ ✅ **DONE (session 84)** — Capped Starter at 3 users (was 5), €19/mo unchanged; `invite_user()` in `team/service.py` enforces the cap via `limits_for_plan()` with a 409 error; `plans.py` + `web/src/lib/config.ts` + pricing page feature list all updated.

**Deploy reminder:** staging deploys from `sandbox` — ship with `git push origin sandbox`. Both Sandbox-env services (`Dev Sandbox` + `Sandbox`) + Commercial website rebuild automatically. `migrations/env.py` takes a Postgres advisory lock so containers can't race DDL.

---

## ▶▶ Performance initiative — ✅ COMPLETE

Top-priority "make the tool faster" pass — **all four steps shipped** (sessions 19, 22, 23, 24):
composite indexes + 5s poll + nginx gzip/cache (Step 1); async ingest with on-demand Generate
(Step 2); loading skeletons + vendor chunking + consolidated draft query (Step 3); `pg_trgm`
search indexes + lazy compose contacts + pool tuning + dropped RLS role-switch (Step 4). Root
causes and file refs are preserved in Appendix A (sessions 22–24). No remaining performance items.

---

## 🟣 Tier 1 — Big, complicated & creative → `Opus`

The heavy lifts: brand-new modules, cross-cutting features, and the creative/marketing work.

### Department routing & inbox architecture
- ~~**[DEPT-ROUTING] Department inbox routing + shared/personal inbox toggle**~~ ✅ **DONE (session 67)** — Routing happens in `inbox/service._create_draft`: the poller passes `inbound_to`, which is matched against `Department.email` (field is `email`, not `inbound_email`) to set `forwarded_to_department_id` on the draft; approving a routed draft carries the dept onto the new `Ticket.department_id`. `GET /inbox/drafts` supports `?department_id=` (filters on `forwarded_to_department_id`) and `?personal=true` (drafts assigned to the current user, any dept — new `assigned_to` filter in `list_drafts`). `users.personal_inbox` boolean added (migration `dr1e2f3a4b5c`, which also merges the 3 then-open heads) + exposed on `UserOut`/`UserSelfUpdate` + `PATCH /auth/me`. InboxQueue renders an All + "Shared [Dept] Inbox" tab per `GET /departments/my` membership (drives `?dept=`), plus a persisted "Personal work inbox" toggle wired to `PATCH /auth/me` that adds `?personal=true` to draft queries in the default view. Files: `inbox/service.py`, `inbox/router.py`, `core/models.py`, `core/schemas.py`, `auth/router.py`, `InboxQueue.tsx`, `useAuth.ts`.

### RBAC
- ~~**[RBAC1] Full RBAC + permission matrix**~~ ✅ **DONE (session 66)** — `rbac_roles` + `rbac_user_roles` + `permissions_matrix` tables (migration `rbac_001`, merges all 4 prior heads); `perm_subject_type` + `access_level_enum` Postgres enums; RLS `tenant_isolation` on all 3 tables; `rbac/service.py` hierarchical resolution (user-override → dept-most-restrictive → role-most-permissive → default full); `rbac/router.py` CRUD for roles, user-role assignments, permissions matrix; `check_module_access(module_key)` FastAPI dependency applied to all module routes in `main.py`; `GET /rbac/my-permissions` endpoint. Frontend: `useRbacPermissions` hook; `ModuleGate` checks RBAC (restricted → redirect to `/`, view → `RbacViewModeContext=true`); `MutationGate` hides mutation controls when view-only (added to InboxQueue bulk actions, TicketDetail action bar + reply send, ContactsPage New/Import/bulk delete); `AccessLevelBadge` component; `ModulePermissionsGrid` per-module access selector; `TeamSettingsPage` Members tab with collapsible per-user role assignment + module override grid + Roles tab for role CRUD + per-role access grid.

### New modules (Phase 10)
- ~~**[MKTG1] Marketing module**~~ ✅ **DONE (session 69)** — full campaign-lifecycle `marketing` module: 5 RLS tables (campaigns/campaign_templates/campaign_analytics/campaign_sequences/contact_unsubscribes, migration `em1k2t3g4h5j`); backend service+router (CRUD, launch, schedule, analytics, drip sequences, segment preview, unsubscribes), Resend + Evolution-API dispatch with 1×1 open-pixel + click-tracking + unsubscribe footer, 50/50 A/B split + open-rate winner; public `/track/open/{token}` GIF + `/track/unsubscribe/{token}`; APScheduler scheduled-launch/A-B-winner/drip jobs; reply tracking via emailtracking inbound webhook + Claude-Haiku classifier (auto-unsubscribe on opt-out); frontend two-panel `MarketingPage` with Design (GrapesJS newsletter preset + A/B + 3 starter templates) / Audience / Schedule / Analytics / Drip tabs + public `UnsubscribePage`. Megaphone sidebar link + `/marketing` ModuleGate route. Supersedes [CAM1].
  - **DB** — migrations (tenant-scoped): `campaigns` (id, tenant_id, name, subject, status enum draft/scheduled/sending/completed, scheduled_at nullable, dispatch_channel enum email|whatsapp, ab_winner nullable, created_at, updated_at); `campaign_templates` (id, campaign_id, raw_html, raw_css, variant enum a|b nullable); `campaign_analytics` (id, tenant_id, campaign_id, recipient_email, status enum sent/opened/clicked/replied, tracking_token UUID unique, reply_classification nullable, updated_at); `campaign_sequences` (id, tenant_id, campaign_id, delay_days int, subject, html_body — drip steps); `contact_unsubscribes` (contact_id, tenant_id, unsubscribed_at — GDPR opt-out); nullable `campaign_id` FK on activity log table.
  - **Sidebar module** — `"marketing"` added to `ALL_MODULES`; sidebar Marketing link; `ModuleGate`-wrapped route at `/marketing`.
  - **Audience / segment builder** — filter contacts by label, tag, company, or pipeline stage to build a named recipient segment; stored as filter-spec JSON (re-evaluated at send time — new matching contacts auto-included).
  - **Campaign designer** — GrapesJS canvas (newsletter preset); Name + Subject inputs; "Launch now" or "Schedule" toggle; campaign buttons as GrapesJS blocks.
  - **Campaign scheduler** — `scheduled_at` on `campaigns`; APScheduler job polls every minute for due campaigns; status: draft → scheduled → sending → completed.
  - **Backend pipeline** — `POST /campaigns/launch` (immediate) + `POST /campaigns/schedule`; recipients built from segment filter at send time; injects 1×1 open-tracking pixel; pushes to Resend queue; one `campaign_analytics` row per recipient.
  - **Open tracking** — `GET /track/open/:token` (public): marks row `opened`, returns 1×1 transparent GIF.
  - **Click tracking** — existing campaign-button tokens; marks row `clicked`.
  - **Reply tracking** — inbound Resend webhook matches by sender email → status `replied`; AI classifier → `reply_classification` (Interested / Opt-out / Out of office / Other).
  - **WhatsApp broadcast integration** — same campaign workflow dispatched via Evolution API; `dispatch_channel = whatsapp`; loops recipients with 5–10 s randomised delay (anti-ban); `POST {EVOLUTION_API_URL}/message/sendText/{instanceName}`.
  - **Drip sequences** — multi-step follow-up: if no reply after N days, send the next `campaign_sequences` step; APScheduler minute-job drives sequence; stops on reply or opt-out.
  - **Unsubscribe management** — one-click unsubscribe link in every campaign email; public `GET /track/unsubscribe/:token` creates `contact_unsubscribes` row + confirmation page; `flush_pending_sends` skips opted-out contacts; GDPR-compliant.
  - **A/B testing** — two template variants (A and B) per campaign; recipients split 50/50; after 2 hours winner (higher open rate) auto-sent to remaining audience; `ab_winner` stored on `campaigns`.
  - **Campaign archive** — list of all completed campaigns with performance snapshot: Sent, Opened %, Clicked %, Replied %, opt-outs; click into campaign for per-recipient breakdown.
  - **Template library** — pre-built starter templates by category (Welcome, Promo, Re-engagement, Follow-up, Newsletter); `is_system_template=True`; tenants duplicate + customise.
  - **Activity sidebar card** — module overview shows open rate + response rate for last 30 days (bar chart); quick-access to last 5 sent campaigns.
- ~~**Email tracking module**~~ ✅ **DONE (session 37)** — `emailtracking` module: `OutboundEmail` model + migration; `send_email()` returns Resend ID; `flush_pending_sends()` creates `OutboundEmail` record per send; `POST /emailtracking/webhooks/resend` (public, HMAC-verified) updates status/timestamps on delivered/opened/clicked/bounced events; `GET /emailtracking/outbound` list endpoint; Sent tab in InboxQueue shows status badge (Sent/Delivered/Opened/Clicked/Bounced) when module enabled, falls back to activity log otherwise.
- ~~**Calendar module**~~ ✅ **DONE (session 38)** — `calendar` module: `calendar_events` table (id, tenant_id, title, description, start_at/end_at TIMESTAMPTZ, all_day, contact_id FK, ticket_id FK, created_by FK); migration `k1l2m3n4o5p6`; CRUD at `GET /calendar/items?start&end` (merges events + open-ticket `sla_due_at` deadlines), `POST/GET/PATCH/DELETE /calendar/events[/{id}]`; hand-built Monday-start month grid (no lib), prev/next/Today nav, today highlighted with `bg-yippie` circle, event chips (blue) + deadline chips (red ≤24h / orange), contact+ticket typeahead in create/edit modal; per-tenant toggle; Calendar nav item in sidebar.
- ~~**Pipeline module**~~ ✅ **DONE (session 42)** — `pipeline` module: `pipeline_stages` table (id, tenant_id, name, color, display_order) + `contact_pipeline_entries` (contact_id PK, stage_id, tenant_id, entered_at); migrations `l2m3n4o5p6q7` + `m3n4o5p6q7r8`; CRUD at `GET/POST/PATCH/DELETE /pipeline/stages`, `PUT /pipeline/stages/reorder`, `GET /pipeline/board`, `PUT/DELETE /pipeline/contacts/{id}/stage`, `GET /pipeline/contacts/{id}/stage`; kanban board (drag-and-drop columns, per-column contact cards with days-in-stage, add-contact picker); manage-stages modal (drag reorder, color picker, CRUD); Pipeline sidebar nav; pipeline stage widget on ContactDetail. Campaign buttons extended: per-button action_type selector (Apply label / Pipeline stage) — pipeline_stage action moves contact to stage via `_assign_stage` without double-commit; LabelClickToken extended with `action_type` + nullable `stage_id` + nullable `label_id`; tracking endpoint handles both. Stages standalone (not linked to labels). Stage-triggered emails not in scope.

> The **AI module** is already built — see ✅ Done. It's the `ai` per-tenant flag that switches on the AI extras across inbox + tickets (summaries, generate mail, suggested/improved replies, compose suggestions, autofilled ticket fields). With it off, none of that runs.

### Email templates (Phase 9 — creative)
- ~~**[Phase 9] Template UX + AI insertion**~~ ✅ **DONE (session 33)** — `/settings/templates` CRUD page, `TemplatePicker` component (search + one-click insert + AI suggest button) wired into DraftReview reply panel and ComposeModal, `PATCH`/`DELETE`/`POST ai-suggest` backend endpoints, AI ranking via Claude. "Templates" sidebar link for all users. Personal templates still open ([S3] — see Tier 2 if needed).
- ~~**[Phase 9B] Full drag-and-drop email template editor**~~ ✅ **DONE (session 35)** — `Opus` — Built on `react-email-editor` 1.8 (Unlayer, MIT licence). `/settings/templates` rebuilt as a two-panel split: template list (left, "Rich design" badge, delete) + editor (right) with "Email Design" (Unlayer canvas, design persisted as `design_json` + exported `html_body`) and "Campaign Buttons" tabs (per-button text/bg/text colour/radius/font size/weight/outline, drag-reorder, "multiple answers allowed?" toggle, live preview — stored as `campaign_buttons` JSONB, label mapping deferred to 9C). New migration `g7h8i9j0k1l2` adds the three columns. Templates button beneath Compose in the Inbox header (same size/colour) replaces the sidebar link; picking a template opens ComposeModal pre-filled (rich templates show an HTML preview + plain-text fallback). TemplatePicker shows "Visual" badge for rich templates and passes `html_body` via `onSelect(body, isHtml)`. `render_email_html()` gained `prerendered_html` param + `render_campaign_buttons_html()` helper (placeholder `#` hrefs until 9C tokens). Signature preview block below the editor. Rich-HTML *sending* pipeline + button label mapping land with [Phase 9C].
- ~~**[Phase 9C] Tracked click / campaign buttons (label-click tokens)**~~ ✅ **DONE (session 37)** — All four pieces shipped: (1) Campaign buttons as native Unlayer blocks (T2 — custom drag-and-drop tool, per-button config panel). (2) `LabelClickToken` model + migration `h8i9j0k1l2m3`. (3) Public `/track/click/{token}` endpoint + `TrackConfirmPage`. (4) `render_email_html()` + `render_campaign_buttons_html(token_map)` inject real tracking URLs generated at send time.

### Contacts — workflow & data model (big)
- ~~**[36] Company grouping for contacts**~~ ✅ **DONE (session 34)** — `companies` table + `contacts.company_id` FK (legacy text column kept for old data), company CRUD at `/contacts/companies` (admin-gated), `/settings/companies` page, `CompanyBadge`/`CompanyPicker` on contact list/new/detail (+DraftReview new-contact modal), company filter chips + `?company_id=` filter, ComposeModal "Company" button adds all of a company's contact emails via `/contacts/companies/{id}/contacts`.
- ~~**[38] Contact labels**~~ ✅ **DONE (session 31)** — `contact_labels` + `contact_label_links` tables, label CRUD at `/contacts/labels` (admin-gated), `/settings/labels` page, label picker on new/detail contact, label-filter chips + Labels column in the contact list. Bulk-label still waits on multi-select (`[20]`). Foundation for the Pipeline module + demo flow is in place.
- ~~**[30] Mail-all / broadcast system**~~ ✅ **DONE (session 49)** — The broadcast system is the existing compose-to-multiple flow via `queue_send` + `flush_pending_sends()` — agents can compose to multiple recipients via the contacts multi-select → Compose action; bulk sends now carry `List-Unsubscribe` + `List-Unsubscribe-Post` headers (shipped session 48). No separate superadmin broadcast endpoint was needed.

### Demo provisioning (Phase 12 — cross-cutting)
- ~~**[Phase 12] Demo-request → auto-provisioned demo**~~ ✅ **DONE (session 48)** — `POST /public/request-demo` (no auth, 5/hr IP rate limit): slugifies company name, creates `is_demo=True` tenant with set-password invite, files a Contact labeled "potential client: demo" + a follow-up Ticket (`sla_due_at` = now + 3 days) in the root owner's tenant. `demo_expiry_check` APScheduler job (hourly) deactivates demos older than 7 days and emails `ADMIN_EMAIL` per expiry. `/request-demo` frontend page (AuthShell form, lazy-routed). Broadcast spam fix: `send_email()` gains `headers` param; broadcast emails now carry `List-Unsubscribe` + `List-Unsubscribe-Post` headers (Gmail bulk-mail requirement since Feb 2024).

### Onboarding (big)
- ~~**[21] Client onboarding wizard**~~ ✅ **DONE (session 17 + polished later)** — `CreateClientModal` in `SuperAdminPage.tsx`: 5-step wizard (Company → Modules → Branding → Admins → Go live). Step 0: name/slug/admin email+password. Step 1: module toggles. Step 2: primary colour + logo URL. Step 3: extra admin emails (each gets an invite email). Step 4: demo vs go-live toggle + summary. Matches the full spec.

### Architecture & infra
- ~~**PostgreSQL RLS policies**~~ ✅ **DONE (session 44)** — All tables now covered. Migration `n4o5p6q7r8s9` adds `tenant_isolation` policies to the 8 previously-unprotected tables: `companies`, `contact_labels`, `contact_label_links` (subquery via contacts, no tenant_id), `label_click_tokens`, `outbound_emails`, `pending_sends`, `pipeline_stages`, `contact_pipeline_entries`. Original 14 tables + `tenants` + `calendar_events` already covered by `c3d4e5f6a7b8` + `k1l2m3n4o5p6`.
- **Per-tenant custom domain** — `Opus` — *not built.* `acme.getyippie.com` → shared Railway service (subdomain/slug-based tenant routing; no public slug-config lookup before login).
- ~~**Mobile web**~~ ✅ **DONE (session 49)** — Responsive mobile layout shipped — `BottomNav.tsx` (Inbox, Contacts, Tickets, Pipeline, Chat icons), `useMobile.ts` hook (breakpoint <768px), `App.tsx` renders `<BottomNav />` at small widths; `f63ae96` simplified mobile-specific flows for Inbox, Chat, Contacts. Bottom navigation replaces sidebar on mobile.
- ~~**Billing / plans per client**~~ ✅ **DONE (session 52)** — `Tenant.plan` SaaS tier (free/starter/pro/enterprise, migration `u1v2w3x4y5z6`, existing tenants backfilled to `enterprise` so nothing locks out). `app/core/plans.py` is the single source of truth: `PLAN_FEATURES` map + `features_for_plan`/`plan_allows`; core features (inbox/tickets/contacts/activity/billing) never gated, advanced (chat/calendar/pipeline/emailtracking/ai) unlocked by tier. Backend `require_feature(name)` dependency composes with `require_module` in `main.py` for advanced modules → **403** if module disabled, **402 Payment Required** if plan too low. `GET /tenant/config` now returns `plan` + `allowed_features`. Superadmin Edit modal (Info tab) has a Plan selector via `PATCH /admin/tenants/{id}`. Frontend `PlanGate` (sibling of `ModuleGate`) shows an upgrade card for calendar/pipeline/chat routes. NB: distinct from billing module's `Subscription.plan_name` (a tenant's *own* customer subscriptions). Checkout/Stripe explicitly out of scope.
- **Customer data + AI briefing** *(architecture decision)* — `Opus` — define where full contact history is stored; the AI briefing (already running) must pull complete history.

### Booking & scheduling
- ~~**[BK7] Booking confirmation: customer edit/cancel link**~~ ✅ **DONE (verified session 76)** — `booking_tokens.manage_token` UUID; `BookingManagePage.tsx`; reschedule + cancel with lock window. Full build summary in "New items collected (2026-06-15)" section above.
- ~~**[BK1] Booking system**~~ ✅ **DONE (session 55, verified)** — `calendar_settings` (work hours 9–17, slot size, expiry days, post-booking stage) + `booking_tokens` tables (migration `v2w3x4y5z6a7`); booking module: `GET/PATCH /booking/settings`, `POST /booking/send`, `GET/DELETE /booking/tokens`, public `GET /public/booking/{token}` + `POST /public/booking/{token}/confirm`; on confirm: CalendarEvent created, customer confirmation email, agent inbox notification, contact moved to configurable Kanban stage; public `/book/:token` BookingPage (propose-mode accept/decline + open slot picker with green/grey chips); `SendBookingModal` shared component; "Send booking link" on ContactDetail + TicketDetail; Kanban multi-select checkboxes + bulk action bar (open mode); Calendar page Bookings slide-over panel (Pending/Booked/Expired) + collapsible booking settings section. Commit `38c9c6d`.

### Product strategy
- ~~**[PRICE1] Modular pricing restructure**~~ ✅ **DONE (session 58)** — `PlanTier` enum → `founder|starter|growth|pro` (merge migration `x4y5z6a7b8c9`; `enterprise`→`pro`, `free`→`founder` data update). `PLAN_LIMITS` dict (users/contacts/prices) + `MODULE_PRICES` dict (tickets €15, ai €19, calendar €12, kanban €12, emailtracking €9) in `plans.py`. All features unlocked on all tiers — limits are the differentiator, not feature gating. `GET /tenant/config` returns `plan_limits` + `module_prices`. SuperAdminPage plan dropdown updated to Founder/Starter/Growth/Pro. `/pricing` page on getyippie.com: annual/monthly toggle (10% off), 4 plan cards, Growth "Most popular", module add-on cards, FAQ, final CTA. Commits `81bab34` + `2125546`.
- **[CUSTOM1] Bespoke package configurator** — `Opus` — *not built.* Public page on `getyippie.com` (`/custom` or `/get-a-plan`) where a potential customer answers a short guided questionnaire (team size, industry, which problems they want to solve, current tools, budget). Output: a recommended Yippie plan + suggested module add-ons with pricing breakdown, plus a prominent "Book a call" CTA (calendar booking or Calendly link). Coordinate with [PRICE1] (plan data) and [WEB1] (design language). Add booking/scheduling mechanic in a future session — for now just the questionnaire flow and recommendation output.
- ~~**[BIZ-Q1] Business questionnaire → module recommendation**~~ ✅ **DONE (session 70)** — `/request-demo` now has a 2-step questionnaire (team size, industry, current tooling, top pain points) mapping answers to recommended Yippie modules shown inline before submit; `POST /public/request-demo` records the answers + recommended modules in the Ticket body for the root-tenant agent. Coordinates with and may supersede [CUSTOM1]. See Tier 1.
- **[B2X1] B2B vs B2C client split** — `Opus` — *not built.* Flag per tenant (`client_type: b2b | b2c`). B2B mode: company-centric views, Kanban, account management focus. B2C mode: individual contacts, fast ticket resolution, high-volume inbox. Needs a UX prototype and design pass before building.
- **[INSIGHT1] Tenant performance analytics** — `Opus` — ✅ **DONE (session 68)** — merged into [SUPER-DASH]. Per-tenant metrics (tickets open/closed/overdue, inbox pending, AI usage, contacts) surface on the new superadmin Dashboard tab; at-risk tenants (no AI usage + overdue > 2) are highlighted amber for upsell/intervention.
- **[SUPER-DASH] Superuser cross-tenant activity dashboard** — `Opus` — ✅ **DONE (session 68)** — `GET /admin/stats?start&end&tenant_id=` (superadmin-only, RLS-free) returns a per-tenant row (tickets_open/closed/overdue, inbox_pending, contacts_created, active_users_today, ai_usage_today) plus a summary object, computed with grouped SQLAlchemy aggregates over tickets/draft_tickets/contacts/users. Frontend: "Dashboard" tab (first tab) on `SuperAdminPage.tsx` — 5 summary stat cards, per-tenant table (overdue rows red, at-risk amber, click-to-filter), 7d/30d/All-time range toggle, tenant dropdown, 60s auto-refresh. Read-only — no migration.

### Marketing site — creative (Phase 11)
- ~~**[WEB1] Website remodel**~~ ✅ **DONE (session 58)** — Full visual overhaul of `getyippie.com` (`apps/web/`): new layout, multi-column footer, scroll-aware nav, Reveal animations, structured-data, OG image, app icons, logo assets. [SEO1] + [PRICE1] fully integrated. The [AI-BTN1] interactive demo tool on the site is still open separately.
- **[Phase 11 A] Copy & branding** — ✅ **DONE (session 26).** Hero → "Take back the time that matters."; support-automation sub copy; "Start for free" / "Sign up" → "Request demo →" across hero, nav, CTA section, pricing cards; `NEXT_PUBLIC_DEMO_URL` env var (falls back to `APP_URL` until Phase 12 form is built). Logo replacement still open (need Diederik's current logo file).
- **[Phase 11 B] The Hour Counter (live ticker)** — ✅ **DONE (session 26).** `GET /api/v1/public/stats` (unauthenticated) in `apps/app/backend/app/public/router.py`; counts cross-tenant tickets × 15 min ÷ 60 + `BASE_HOURS_SAVED` (env, default 10 000). `HourCounter` client component on the marketing site fetches on mount, animates count-up with ease-out cubic over 2s, falls back to 10 000 on error. `getyippie.com` + `www.getyippie.com` added to CORS allowlist.
- **[Phase 11 C — Tier 1] On-page ROI calculator** — ✅ **DONE (session 26).** Five sliders (tickets/mo, min/ticket, staff, hourly cost, automatable %) → hours saved, € saved/month, payback vs €29/mo plan. Pure-frontend `ROICalculator` component between "How it works" and Pricing. `NEXT_PUBLIC_DEMO_URL` wired to its CTA.
- **[Phase 11 C — Tier 2] "Connect your inbox" ROI estimate** — `Opus` — *not built.* Pursue **CSV / mailbox-export upload first** (parsed in-browser, best privacy/effort); one-time IMAP/OAuth scan next; Gmail/Workspace metadata add-on last (flag the OAuth verification + restricted-scope security assessment cost up front). "We never read your email content."

---

## 🔵 Tier 2 — Medium → `Sonnet`

Standard feature builds — well-scoped, mostly with existing patterns/endpoints to reuse.

### Contacts & data import
- ~~**[29] Contact CSV import**~~ ✅ **DONE (session 36b)** — `POST /contacts/import` multipart (CSV + JSON + XLSX), validate, dedupe by email, bulk insert; import widget in ContactsPage.
- ~~**[40] Contact import — JSON + Excel**~~ ✅ **DONE (session 36b)** — bundled with [29]; same endpoint handles JSON and `.xlsx`.
- ~~**[C2] Pre-import column mapping**~~ ✅ **DONE (session 49)** — Column mapping step added to the import flow — users match CSV/XLSX columns to Yippie contact fields before the import runs (commit `9aac876`).
- ~~**[37] Import users / staff from CSV**~~ ✅ **DONE** — `POST /admin/users/import` + superadmin path, bulk-invite via Resend, upload widget in Settings → Team.
- ~~**[20] Multi-select contacts**~~ ✅ **DONE (session 36b)** — checkbox per row + action bar (admins/superadmins): Compose (prefill emails), Export CSV, Label, Delete (soft). Wired into `ContactsPage.tsx` (`f0e4906`).
- ~~**[39] Contact soft-delete + retention**~~ ✅ **DONE** — `contacts.deleted_at`, 1-month retention window, scheduled purge.
- ~~**[C1] Column customisation — Contacts & Companies**~~ ✅ **DONE (session 49)** — `ColumnPicker.tsx` component + `contact_column_prefs` field on users (migration `r8s9t0u1v2w3_add_contact_column_prefs`); users can toggle/reorder columns in the Contacts list; preferences persisted via `PATCH /auth/me`; gear icon beneath "+New contact" opens picker (commit `9aac876`).

### Calendar
- **[CAL-SPLIT] Shared vs personal calendar events + booking from personal email** — `Sonnet` — *not built.* (1) Migration adds `calendar_type VARCHAR` to `calendar_events` (default `"shared"`; enum: `shared | personal`). `GET /calendar/items` gains `?calendar_type=shared|personal|all` (default `all`). Create/edit modal adds a shared/personal toggle radio. Calendar page gets a **Team / Personal / All** tab strip. Personal events are only visible to their creator. (2) `booking_tokens` gains a nullable `from_email` field; `POST /booking/send` accepts an optional `from_email` override (must be one of the user's verified addresses: `reply_from_email` or an alias in `send_from_aliases`). `SendBookingModal.tsx` gains a "Send from personal work email" checkbox — unchecked uses `tenant.inbound_email` (support address), checked uses the agent's own address. `booking/service.py` passes the override to Resend. Files: migration, `CalendarPage.tsx`, event modal, `SendBookingModal.tsx`, `booking/schemas.py`, `booking/service.py`.
- ~~**[Cal1] Automated contact email when linked to a calendar event**~~ ✅ **DONE (commit 367ac95, verified session 54)** — `calendar/service.py` `_notify_contact()`; request-only `notify_contact` flag (default true) suppresses it; update path notifies only on contact-link or start-time change.

### Tickets
- ~~**[MERGE-TK] Merge Tickets**~~ ✅ **DONE (verified session 76)** — `MergeModal` component inside `TicketDetail.tsx`; searches same-contact tickets, calls `POST /tickets/{id}/merge`; toast on success/failure.
- ~~**[TK-COCKPIT] Ticket detail — 3-column cockpit**~~ ✅ **DONE (session 59)** — compact status/priority dropdowns top-right replace pill buttons + text row; SLA banner gained Snooze 24h (`POST /tickets/{id}/snooze`) + Escalate (priority→urgent) buttons; Reply/Internal Note tabs replace checkbox; CustomerPanel gained "Context scan" card (subject, invoice # regex, prior ticket count + recent subjects). Commit `694ec59`.

### Live Chat
- ~~**[LIVECHAT-STATUS-MODEL] Full chat status model + assignment**~~ ✅ **DONE (session 64)** — `status` (open|assigned|solved|ticket) + `assigned_to` FK + `solved_at` on `ChatSession`; `Tenant.hide_solved_chats_hours` (default 72); auto-claim on open; `/claim` + `/assign` + `/status` endpoints; Mine/Open/All filter tabs in sidebar; browser notifications target assigned agent only (unassigned → all); LiveChat settings card in LabelsPage (admin); migration `livechat_status_001_status_model`; commit `92b3fc6`.

### Billing
- ~~**[BILLING2] Billing page upgrade**~~ ✅ **DONE (session 60)** — Add Invoice modal (contact typeahead, line items, status, due date); debounced search; row checkboxes + bulk Delete/Export; KvK/Btw on Tenant model + Organisation Settings + SuperAdmin edit modal; GET /billing/invoices/export (CSV/XLSX with KvK/Btw header rows); DELETE /billing/invoices/bulk; new InvoiceStatus values (pending/received/not_sent); migration a0b1c2d3e4f5; commit 2d0146c.

### i18n
- **[LANG1] Language switch (EN / NL)** — `Sonnet` — *not built.* User setting in Profile for UI language; English default. Dutch translation for sidebar labels, status labels, common UI strings. Use `i18next` + `react-i18next` with JSON resource files.

### Departments module
- ~~**[DEPT-MOD] Make Departments a proper module**~~ ✅ **DONE (session 63, verified session 76)** — `'departments'` confirmed in `ALL_MODULES` in `config.py`; departments router gated by `require_module`; sidebar link hidden when disabled.

### Marketing module
~~**[MKTG-EXPAND] Marketing module: expand feature depth**~~ ✅ **DONE (session 77)** — test-send, personalisation tokens ({{first_name}}/{{company}}/{{email}}), campaign duplication, bounce handling (contact_bounces + Resend webhook), button click analytics, engagement score 0-100 on Contact (badge + segment filter + monthly decay), unsubscribes panel with Re-enable, activity KPI strip (campaigns sent/open rate/response rate/opt-outs). Migrations: b251c948a65a (contact_bounces) + 243646e386fc (engagement_score). Commit e043c8a.

### Commercial site
- ~~**[WEB-PLANS2] 3 base plans + module add-ons on getyippie.com**~~ ✅ **DONE (session 73, verified session 76)** — `pricing/page.tsx` has Starter/Growth/Enterprise plan cards + module add-on pricing; PLAN_RANK updated to Starter/Starter/Growth/Enterprise; homepage pricing teaser matches.

### AI / automation
- ~~**[AI-BTN1] Explicit "Generate" button instead of auto-AI**~~ ✅ **DONE (session 73)** — Inbox AI button-triggered via `/inbox/drafts/{id}/generate`; `ai_auto_scan` per-tenant boolean; interactive AI inbox demo on getyippie.com (`POST /public/ai-demo` endpoint + `InboxDemo.tsx` component with 3 example emails, live ticket result, priority + category badges).

### Inbox
- ~~**[I1] Inbox search**~~ ✅ **DONE (session 51)** — shared debounced search (300ms) across Pending/Processed/Sent; query persists across tab switches (not reset; `q` in each queryKey). Backend: `?q=` on `GET /inbox/drafts` (ILIKE over `ai_suggested_subject`/`ai_suggested_description`/`final_subject`/inbound `subject`/`sender`/`raw_body`) + `GET /emailtracking/outbound` (`subject`/`to_email`); new `GET /inbox/trending` (top ~6 non-stopword subject words from 200 most-recent drafts, words seen >1×, tenant-scoped, client refetch every 15 min, rendered as subtle grey clickable chips). Migration `t0u1v2w3x4y5` adds pg_trgm GIN indexes for the ILIKE'd columns. Sent tab paginated at 9/page (same `PAGE_SIZE` as Pending); Processed inline filter pills → dropdown. Non-tracking Sent path (`/activity`) filtered client-side (searchable fields are JSONB). Also fixed a latent double-slice in the Pending/Processed paginator (only page 1 rendered correctly).

### Right-click context menus
- ~~**[RC1] Right-click context menus**~~ ✅ **DONE (session 79)** — All pages wired. `ContextMenu.tsx` shared component in ✅ TicketList, ✅ ContactList, ✅ InboxQueue, ✅ ChatPage, ✅ InvoiceList, ✅ PipelinePage, ✅ CalendarPage, ✅ TemplatesPage. Cross-entity "View contact" / "View ticket" items open peek modals (`ContactPeekModal` / `TicketPeekModal`) instead of navigating away; "Open ticket" removed from TicketList + "Review draft" removed from InboxQueue (redundant with row click). Commit c4ed718.

### UI / UX
- ~~**[OPT1] Optimistic UI updates**~~ ✅ **DONE (session 56)** — ticket status change, draft approve/reject, contact label apply, pipeline stage move, ticket comment submit all use React Query `onMutate`/`onError`/`onSettled` for instant UI + rollback; `sonner` toast on failure. Commit `89a7ff4`.

### UI consistency
- ~~**[UI1] Full UI consistency audit & polish**~~ ✅ **DONE (session 56)** — button hierarchy (primary/secondary/danger/ghost) normalized across tickets/contacts/admin pages; all modals → `max-w-lg w-full`; card styles (`rounded-xl border border-slate-200 shadow-sm`) confirmed consistent; 10 files changed. Commit `ecf87a7`.

### Bugs & config
- ~~**[ACT2] Activity page regression**~~ ✅ **DONE (session 57)** — root cause: `get_kpis()` in `activity/service.py` called `func.count(ContactPipelineEntry.id)`, but `ContactPipelineEntry` has no `id` column (its PK is `contact_id`). This raised `AttributeError: type object 'ContactPipelineEntry' has no attribute 'id'` → `/activity/kpis` returned 500 → the frontend (which only rendered when `kpis` was truthy) showed a blank page. Fixed by counting `contact_id`, and hardened `ActivityFeed.tsx` to render an error state on query failure instead of blanking. Confirmed the 500 in sandbox logs before fixing.
- ~~**[W1] Klimaatexamen primary colour not applied**~~ ✅ **DONE** — fixed.

### Superadmin / client management
- **[38c] Per-client edit modal (UX redesign)** — ✅ **DONE (session 27).** "Edit modules" button replaced with "Edit" opening a 3-tab modal: Info (name, inbound_email, slug readonly), Modules (module toggles), Branding (primary_color, logo_url + preview). All fields patch via the existing `PATCH /admin/tenants/{id}`. Status buttons kept inline.
- ~~**[38d] Manage client users from the edit modal**~~ ✅ **DONE** — add/remove/inactivate folded into the unified Edit modal.
- ~~**[31] Demo environments (template data)**~~ ✅ **DONE** — seed dataset + superadmin "Reset to demo" shipped.
- ~~**[SA-CLIENTS] Clients page: plan column + API token donut + clickable users column**~~ ✅ DONE (session 78) — plan badge + token donut + users modal in SuperAdminPage.tsx; new GET /admin/tenants/{id}/users endpoint; `last_login_at` added to `TenantUserOut` schema; per-plan `PLAN_BADGE` colors; donut thresholds 75%/100%, size 40px; dedicated `TenantUsersModal` (name/email/role/last active/status) opened from the Users count button without touching the full edit modal.

### Branding & marketing
- **[WEB-CONS1] Commercial site consistency pass** — `Sonnet` — *not built.* Audit all pages on getyippie.com (`apps/web/`) for visual inconsistencies: layout, spacing, typography, colours, card/section styles, shared nav+footer alignment. Primary focus: newer SEO pages (`/features`, `/for-smbs`, `/for-agencies`, `/blog`, `/vs-zendesk`) against the existing hero/pricing baseline. Fix deviations without redesigning; output should feel like one coherent site, not pages built at different times.
- ~~**[SEO1] SEO foundation + content pages**~~ ✅ **DONE (session 58)** — Site-wide Open Graph, Twitter Card, `Organization` JSON-LD in `layout.tsx`; `sitemap.ts` + `robots.txt` updated. New pages: `/features` (12-feature 3-col grid), `/for-smbs`, `/for-agencies` (pain/solution rows), `/blog` + 2 posts with `Article` JSON-LD, `/vs-zendesk` comparison table. Shared `SiteNav.tsx` + `SiteFooter.tsx`. All pages have page-level `metadata` exports. Build + `tsc --noEmit` clean. Commit `81bab34`. **Open**: `/vs-freshdesk` still to build.
- **Branding wiring into the app shell** — ✅ **DONE (session 27).** Sidebar background now reads `primary_color` from tenant config via inline style; the Yippie SVG mark always shows, client `logo_url` appears below it when set. Seed.py now syncs `primary_color` + `logo_url` from config on every deploy; all defaults updated to `#5BA4F5`.
- **[Phase 11 C — Tier 1] On-page ROI calculator** — ✅ **DONE (session 26)** — see Tier 1 entry above.

### Promotion & identity (Phase 13)
- ~~**Promotion: devsandbox → sandbox → live**~~ ✅ **DONE** — no longer applicable; deploy flow restructured (see CLAUDE.md).
- ~~**Send-from aliases + app tour**~~ ✅ **DONE (session 75)** — `send_from_aliases` JSONB + `tour_completed` bool on users; Profile "Send-from aliases" list UI; From selector in compose/reply shows reply_from_email + all aliases; `WelcomeTour.tsx` 4-step overlay shown once after first login.

### Template editor
- ~~**[GRAPES1] Replace Unlayer with GrapesJS**~~ ✅ **DONE (verified session 76)** — `TemplatesPage.tsx` imports `GrapesEditor` from `../components/GrapesEditor.tsx`; `react-email-editor` (Unlayer) is gone. `GrapesEditor.tsx` component exists in `admin/components/`.
- ~~**[TE3] Campaign buttons: per-button action type**~~ ✅ **DONE (session 54)** — completed the partial from session 42: **open website** / **send mail** / **call phone** now ship alongside **Apply label** + **Pipeline stage**. Direct-link types use `CampaignButton.action_value` + `build_direct_action_href()` (mailto:/tel:/https, no token); TemplatesPage panel has all five.

### Kanban / Pipeline
- ~~**[DEMO-WF1] Demo-request → Kanban "Demo requested" stage**~~ ✅ **DONE (verified session 76)** — `_ensure_demo_pipeline_stage()` creates the stage at position 0 if missing; `_assign_stage()` called in `public/router.py` after contact creation. Full loop: demo requested → contact created → placed in Kanban.
- ~~**[KANBAN-STAGES] Customisable Kanban stages per tenant**~~ ✅ **DONE (session 62)** — backend CRUD already existed; added `provision_default_stages()` (Lead/Qualified/Proposal/Won) called from `create_tenant()`; added inline `KanbanStagesPanel` to LabelsPage (Settings) with add/edit/delete/drag-reorder — admin-only; commit `c43550b`.

### Pipeline × Activity
- ~~**[P1] Stage filter on Activity page**~~ ✅ **DONE (session 73, verified session 76)** — `selectedStageId` state + `pipeline_stage_id` param on `/activity` query confirmed in `ActivityFeed.tsx`; stage chips reset page to 0 on change.
- ~~**[P2] Stage changes as activity events**~~ ✅ **DONE (session 57)** — logging moved into `_assign_stage()` so every stage-change path logs once: kanban drag (`move_contact_to_stage`), booking auto-move, and tracking-link clicks. Writes a `pipeline_stage_changed` activity event (only when the stage actually changes) with `payload={"stage_name", "body": "Moved to {stage}"}`, committed atomically with the entry. Removed the now-duplicate log in `move_contact_to_stage`.

### Signatures & team management
- ~~**[S1] Multi-signature per user**~~ ✅ **DONE (session 50)** — `user_signatures` table (`id, user_id, tenant_id, name, body, is_default, display_order`, migration `s9t0u1v2w3x4` + `tenant_isolation` RLS); backfills each user's `email_signature` into a "Default" entry (legacy column retained for rollback). CRUD at `GET/POST /auth/me/signatures`, `PATCH/DELETE /auth/me/signatures/{id}` (one-default enforcement, user+tenant scoped, auto-promote on default delete). Profile page: signature list cards (name+preview, edit/delete, default star, up/down reorder, "+"); compose/reply prefill the default + `SignaturePicker` dropdown to switch (`useSignatures` hook + `swapSignature` helper).
- ~~**[S2] Signature image upload**~~ ✅ **DONE (session 50)** — chose **base64 inline** (no separate table): SVG/PNG/JPEG embedded as a single `<img src="data:...">` in the signature body, ≤500 KB cap (client + backend `MAX_SIGNATURE_BODY_CHARS`). `email_html._paragraphs()` stashes the allowlisted data-URI `<img>` before `html.escape()` and rebuilds it with a fixed `style` (drops any other attrs → no `onerror`/script vector; remote-URL imgs not preserved); placeholder restore after escaping.
- ~~**[T1] Delete users from team**~~ ✅ **DONE (session 73, verified session 76)** — `DeleteUserModal` confirmed in `TeamSettingsPage.tsx`; `DELETE /team/users/{id}` backend endpoint with `require_admin` gate; confirm modal with user name.

### Module & pricing corrections (2026-06-22)
- ~~**[LIVECHAT-1PC] WhatsApp livechat: one session per contact**~~ ✅ **DONE (session 81)** — `normalize_phone()` + `find_open_session_for_phone()` extracted in `whatsapp_service.py`; both inbound webhook and outbound create-path use it. Verified in code.
- **[BK8] Booking: per-send post-booking pipeline stage override** — `Sonnet` — *not built.* Add an optional "Move to stage" dropdown to `SendBookingModal`; pass `stage_id_override` on `POST /booking/send`; backend uses override over global `post_booking_stage` setting. Files: `SendBookingModal.tsx`, `booking/router.py`, `booking/service.py`.
- **[UI2] UI consistency audit round 2** — `Sonnet` — *not built.* New ticket creation modal is visually inconsistent with the rest of the app. Audit all primary create/edit modals (new ticket, new contact, new company, new booking, new calendar event, new department, new campaign) against the `max-w-lg w-full` + button hierarchy standard from [UI1] (session 56). Fix all deviations.
- **[MODULE-INC] Correct included vs paid module split** — `Sonnet` — *not built.* Only **Inbox** and **Contacts** are included in the base plan; all other modules (Tickets, AI, Calendar, Kanban, Live Chat, Marketing, Departments, Billing) are paid add-ons. Fix `plans.py` `PLAN_FEATURES`/`PLAN_LIMITS` and update the getyippie.com pricing page and module add-on cards accordingly.
- **[MODULE-RENAME] Rename emailtracking → Marketing; remove Templates as standalone** — `Sonnet` — *not built.* (1) Consolidate `emailtracking` module into `marketing` under one "Marketing" sidebar entry (no duplicates); (2) Remove "Templates" as a standalone sidebar module — accessible from within Inbox and Marketing instead. Update `ALL_MODULES`, `MODULE_MAP`, sidebar, and route registrations. No migration needed.
- **[MODULE-CONSIST] Commercial site: pricing page covers all modules** — `Sonnet` — *not built.* Cross-check products/modules page against pricing page; every sold module needs a card (Tickets, AI, Calendar, Kanban, Live Chat, Marketing, Departments, Billing; future: Cloud LLM €20/mo, Webpage Tracking €9/mo). Reference GitHub products workflow for canonical list.
- ~~**[MKTG-PAGE] Marketing module in-app page upgrade**~~ ✅ **DONE (session 85 — user confirmed)**

### Templates & LiveChat fixes (2026-06-22 additional)
- ~~**[TPL-CONSISTENT] Template editor: consistent layout + marketing templates + module gating**~~ ✅ DONE (session b-20260622) — see Tier 2 entry above.
- **[BK-MULTISLOT] Booking: multiple distinct time slots per day in weekly schedule** — ✅ DONE — backend already iterates all entries per day; `WeeklyGrid` already renders all slots with `+ Add` / `×` remove. Verified correct, no changes needed.
- **[LIVECHAT-ROOT] LiveChat: find root cause + targeted clean fix** — `Sonnet` — *not built.* LiveChat still not working after multiple attempts. Trace: Evolution API connection → webhook registration → `receive_message()` → WS broadcast → `ChatPage.tsx`. Fix only the first failing step. Do not rewrite working code. Files: `chat/router.py`, `chat/whatsapp_service.py`, `ChatPage.tsx`.

---

## 🟢 Tier 3 — Quick & easy wins → `Haiku`

Small, well-bounded changes — UX polish and config/ops one-liners.

### UX polish
- ~~**[BR1] Branding colour — "Reset to default" in client edit + editable in Settings**~~ ✅ **DONE (session 46)** — (1) SuperAdmin Clients → Edit → Branding tab: "Reset to default" button resets `primary_color` to `#5BA4F5`; (2) Tenant Settings page: `BrandingSection` card (Palette icon, colour picker, reset, Save) backed by new `PATCH /team/branding` endpoint (`AdminUser`-gated) in `team/router.py`; `update_branding()` in `team/service.py`; `BrandingUpdate` schema; page reloads after save so sidebar picks up new colour.
- ~~**[V1] Sent inbox not showing mails**~~ ✅ **DONE (session 49)** — Already noted as done in the "Next session" section (session 42 — Activity module rebuilt); marking the Tier 3 entry done for consistency.
- ~~**[V2] All contacts button in compose broken**~~ ✅ **DONE (session 36)** — fixed `fetchQuery` wiring: `staleTime: 0`, defensive `Array.isArray` check, `catch` block so errors don't swallow silently.
- ~~**[V3] Compose: pre-select personal address as From when in personal inbox**~~ ✅ **DONE (session 36)** — Compose button now sets `usePersonalFrom: true` in `composeInitial` when `mailbox === 'personal'`.
- ~~**[V5] Profile: signature inside email card**~~ ✅ **DONE (session 36)** — signature textarea merged into the personal-email-address card; separate signature card removed; Change Password card stands alone below.
- ~~**[V6] Team page: align departments panel top with team list**~~ ✅ **DONE (session 36)** — `DepartmentsPanel` given `pt-[78px]` to align its header with the team table header.
- ~~**[V7] Team page: narrow team members list**~~ ✅ **DONE (session 36)** — team list capped at `max-w-2xl`; DepartmentsPanel widened to `w-80`.
- ~~**[V8] Department edit modal: add TemplatePicker**~~ ✅ **DONE (session 39)** — `TemplatePicker` embedded in `DeptModal`; selected template body stored as `reply_template` via existing `PATCH/POST /departments` endpoints.
- ~~**[36b-1] Contact bulk action order**~~ ✅ **DONE (session 39)** — reordered to Compose → Export → Delete.
- ~~**[36b-2] Contact inline edit popup**~~ ✅ **DONE (session 40)** — pencil icon on each contact row opens `EditContactModal` (name, email, phone, company, notes); `PATCH /contacts/{id}`. Company rows already had inline edit.
- ~~**[36b-3] Company filter dropdown in Contacts page**~~ ✅ **DONE (session 43)** — company chip-filter row already present in `ContactsPage.tsx` (`companyFilter` state + `?company_id=` query param); verified in code, marking done.
- ~~**[36b-4] Search bar on Companies page**~~ ✅ **DONE (session 39)** — client-side filter input added to CompaniesTab.
- ~~**[36b-5] Multi-select on Companies page**~~ ✅ **DONE (session 49)** — `CompaniesTab` in `ContactsPage.tsx` has `selected` Set state, select-all checkbox, bulk Export CSV + Delete with confirm (commit `05a0fa2`). Was marked "reopened" due to sandbox deploy lag — code confirmed present.
- ~~**[TK1] Multi-select on Tickets page**~~ ✅ **DONE (session 43)** — per-row checkboxes + "Select all" header checkbox; bulk action bar (Delete, confirm modal → `DELETE /tickets/bulk` soft-delete); `BulkDeleteTicketsRequest` schema; backend endpoint loops `soft_delete_ticket` per id; `TicketList.tsx` mirrors ContactsPage multi-select pattern.
- ~~**[36b-6] XLSX import fix**~~ ✅ **DONE (session 60, verified session 76)** — go-live scope confirmed `[x]`; `openpyxl` wired in `contacts/router.py` with graceful 400 fallback.
- ~~**[36b-7] Sent tab: match Pending/Processed UI + clickable rows**~~ ✅ **DONE (session 40)** — hover border/shadow added; emailtracking rows link to `/inbox/drafts/{draft_id}`, activity-log rows link to draft if `payload.draft_id` is set.
- ~~**[36b-8] Team page: DepartmentsPanel polish**~~ ✅ **DONE (session 46)** — card wrapper (`bg-white rounded-2xl border border-slate-200`) was already in place; widened panel from `w-72` to `w-80` for better proportions alongside the team table.
- ~~**[36b-9] Sidebar: Settings active state bleeds into superadmin/team/profile pages**~~ ✅ **DONE (session 39)** — custom `settingsActive` via `useLocation` in `Sidebar.tsx`.
- ~~**[V9] Remove Departments from Settings**~~ ✅ **DONE (session 36)** — `/settings/departments` route removed; `DepartmentsPage` lazy import removed from `App.tsx`; sidebar "Settings" link updated.
- ~~**[V10] Add contact labels to Settings page**~~ ✅ **DONE (session 36)** — `/settings` route now renders `LabelsPage`; sidebar "Settings" → `/settings`.
- ~~**[V11] Remove standalone Labels page**~~ ✅ **DONE (session 36)** — `/settings/labels` route and "Labels" sidebar link removed.
- ~~**[T1] Template editor: full-screen pop-up modal**~~ ✅ **DONE (session 49)** — Already present in code — `fixed inset-0 z-50` overlay (`90vw × 90vh`), `editorEverOpened` flag avoids Unlayer re-init, template list stays behind the modal, name input + Save + × in header (commit `b24550a`). Was marked "reopened" due to sandbox deploy lag — code confirmed present.
- ~~**[TE1] Template editor: remove object deletion warning**~~ ✅ **DONE (session 36)** — `editor: { confirmOnDelete: false }` added to Unlayer options.
- ~~**[TE2] Signature: move inside template content area**~~ ✅ **DONE (session 36)** — signature preview now renders as a `rounded-b-xl` footer attached to the bottom of the Unlayer canvas border; separate bottom card removed.
- ~~**[TE4] Template editor: AI tip tooltip on HTML button**~~ ✅ **DONE (session 49)** — Unlayer renders its toolbar inside an iframe so a React tooltip cannot reach the HTML button directly. Instead added a subtle `text-xs text-slate-400` hint line directly above the editor area in the modal: "💡 Tip: Use **AI → Compose** to generate rich HTML content, then copy it here using the HTML source button." Commit `4601e62`.
- ~~**[C1] Compose: rich template not loaded into editor**~~ ✅ **DONE (session 45)** — `setTemplateHtml` was already called on `isHtml=true` (since Phase 9B); the remaining gap was that the InboxQueue TemplatePicker (opens compose pre-filled) never forwarded `campaignButtonsJson` into `ComposeInitialState`. Fixed: added `campaignButtonsJson` to `ComposeInitialState`, updated the InboxQueue `onSelect` to capture `buttons` arg, and initialized `campaignButtonsJson` state in ComposeModal from `initialState.campaignButtonsJson`. Campaign buttons from rich templates are now preserved end-to-end when opening compose via the sidebar TemplatePicker.
- ~~**[35-backlog] More hotkeys**~~ ✅ **DONE (session 49)** — ~~`c` compose, `Esc` close compose, `g i` go to inbox~~ ✅ (session 32). Added in session 49: InboxQueue `j`/`k` navigate mail list with blue focus ring, `r` opens focused draft; DraftReview `r` focuses reply textarea, `e` approves when reply is empty. `/` (focus search) skipped — no search input exists. Commit `6bb678d`.
- ~~**[43] Ticket deadline reminder toast**~~ ✅ **DONE (session 49)** — Installed `sonner` 2.0.7. Added `<Toaster position="bottom-right" richColors />` to App.tsx. Sidebar fires a one-shot `toast.warning()` on first mount when `redCount > 0`, with 8 s duration and a "View" action link to `/tickets`. Commit `6bb678d`.
- ~~**[48] Clickable rows everywhere**~~ ✅ **DONE (session 49)** — TicketList rows already use `<Link to={/tickets/${t.id}}>` for full-row click — confirmed in code. Convention complete across inbox cards, contact rows, and ticket rows.
- ~~**[8c] Status column labels**~~ ✅ **DONE (session 32)** — Clients table status column replaced with a `<select>` dropdown (active/demo/inactive); clicking fires `PATCH /admin/tenants/{id}`; disabled during mutation.
- ~~**[6c] Bulk delete clients**~~ ✅ **DONE (session 29)** — Delete button in bulk action bar (root owner only); `BulkDeleteClientsModal` with password gate, calls `POST /admin/tenants/{id}/delete` for each selected client.
- ~~**Spam → Resend sender block**~~ ✅ **DONE** — sender block call to Resend shipped.
- ~~**[U1] Inbox: remove duplicate select-all**~~ ✅ **DONE (session 32)** — header copy removed; sticky select-all row in scrollable section kept.
- ~~**[U2] Inbox: add Sent tab**~~ ✅ **DONE (session 32)** — Sent tab filters `/activity` log for `email.replied`/`email.composed` events; shows subject, to, preview, timestamp.
- ~~**[U3] Client info page: remove Inactivate + Delete**~~ ✅ **DONE (session 32)** — removed from Info tab; they live only in Actions tab.
- ~~**[U4] Client actions: remove "Copy email"**~~ ✅ **DONE (session 32)** — removed from Actions dropdown; Copy button remains in Info tab.
- ~~**[U5] Departments → Team page**~~ ✅ **DONE (session 32)** — `DepartmentsPanel` (compact, 288px) added as right column on Team page; create/edit via modal.
- ~~**[U6] Profile: password next to signature**~~ ✅ **DONE (session 32 + 33)** — two-column layout: signature (left, flexible), Change Password card (right, 280px). `mt-6` offset removed + new/confirm fields unstacked in session 33.
- ~~**[TK4] Tickets: customer panel in dead space**~~ ✅ **DONE (verified session 58)** — contact panel already present in `TicketDetail.tsx`; confirmed in code. (The larger [TK-PAGE] redesign is still open.)
- ~~**[EMPTY1] Loading & empty states**~~ ✅ **DONE (session 56)** — "All Caught Up" component (20 rotating facts, 2min interval) on pending inbox tab; spinners + `disabled` added to DraftReview approve/send, TicketDetail status buttons + comment submit, ContactDetail save. Commit `0e7dbc0`.
- ~~**[TK5] "Waiting for customer" ticket state**~~ ✅ **DONE (session 56)** — `waiting` enum already existed in the DB; frontend-only: relabelled to "Waiting for customer" via `STATUS_LABELS` map, changed badge colour from violet → amber in both TicketList + TicketDetail. No migration needed.
- ~~**[TAG-RM] Remove tags entirely**~~ ✅ **DONE (session 56)** — no tag DB tables existed; removed `tags` input from DraftReview new-contact form and "Legacy tags" field from ContactDetail. Commit `0e7dbc0`.
- ~~**[KAN-RN] Rename "Pipeline" → "Kanban"**~~ ✅ **DONE (session 53)** — all user-visible "Pipeline" strings changed to "Kanban" in Sidebar.tsx, BottomNav.tsx, PlanGate.tsx, PipelinePage.tsx, ContactDetail.tsx; backend identifiers/routes/keys untouched.
- ~~**[SIDE-COL] Collapsable sidebar**~~ ✅ **DONE (session 53)** — collapse toggle (ChevronLeft/Right) added at bottom of Sidebar.tsx; collapsed = 56px icon-only rail, expanded = 224px; state persisted in `localStorage` key `yippie:sidebarCollapsed`; `title` tooltip on icons when collapsed; smooth `transition-all duration-200` width animation.

### Commercial site (session 76+)
- ~~**[COM-NAV] Commercial site: header nav misaligned with page content**~~ ✅ **DONE (session 78)** — Wrapped nav inner content row in `.navInner` class (`max-width: 1180px; margin: 0 auto; width: 100%`) in `SiteChrome.module.css`; moved flex layout + padding from `.nav` to `.navInner`; nav background still spans full width. `SiteNav.tsx` wraps logo + links + buttons in the new inner div. Commit `f1c21cc`.
### Contacts (session 76+)
- ~~**[CON-TABS] Contacts: swap tab order + remove Trash tab**~~ ✅ **DONE (session 78, verified)** — `ContactsPage.tsx` already has `['contacts', 'companies']` tab order and no Trash tab; verified in code (commits `de482b6` + `772f274`).
- ~~**[CON-DELETED] Deleted contacts in search/list**~~ ✅ **DONE (session 78)** — Root cause: `ContactsTab` in `ContactsPage.tsx` passed `include_deleted: true` when a search query was active. Removed that param — deleted contacts now never appear in search or the main list. Backend `contacts/service.py` was already correct. Commit in `land: session/c-20260621-con-deleted`.
- ~~**[CON-PERMDEL] Delete permanently — silent failure**~~ ✅ **DONE (session 78)** — Added `isAdmin` guard (`role === 'admin' || 'superadmin'`) hiding the button for non-admins; added `onError: () => toast.error('Failed to permanently delete contact')` to `permanentDeleteMutation`. Commit `64eab0a`.

### Inbox (session 76+)
- ~~**[INBOX-SHIFT] Assign to me + empty list causes layout shift**~~ ✅ **DONE (session 78)** — Added `min-h-[200px]` to the `flex flex-col gap-3` draft list container in `InboxQueue.tsx` so the layout stays stable when "Assign to me" filters all items client-side. Commit `7de20fb`.
- ~~**[TK-NAV] Sidebar disappears on Tickets page**~~ ✅ **DONE (session 78)** — Added `relative z-10` to the sidebar `<aside>` in `Sidebar.tsx` to guarantee paint order above main content; changed `h-full` → `min-h-0` on `PagePad` and added `min-w-0` to `<main>` in `App.tsx` to prevent flex overflow pushing the sidebar off-screen. Commit `bc80ed6`.

### Team (session 76+)
- ~~**[TEAM-DEPT] Add department assignment to team member edit modal**~~ ✅ **DONE (session 78)** — Backend: `GET /team/users/{id}/departments` + `PUT /team/users/{id}/departments` (replace-all memberships) in `team/router.py` + `team/service.py`; `UserDepartmentOut` + `UserDepartmentsUpdate` schemas. Frontend: `EditUserModal` in `TeamSettingsPage.tsx` fetches all depts + user's current depts, renders checkbox rows inside the Profile tab, saves both mutations on submit. No migration — reuses existing `department_members` table. Commit in `land: session/d-20260621-team-dept`.

### Go-live prep
- ~~**[GOLIVE-CHECKLIST] Write the go-live checklist**~~ ✅ **DONE (session 60, verified session 76)** — `GOLIVE.md` exists in repo root; 9-section checklist covering Railway env vars, DNS, Resend, first deploy, smoke tests, post-deploy ops.
- ~~**[WEB-LEGAL] Privacy Policy + Terms of Service on getyippie.com**~~ ✅ **DONE (session 71)** — `/privacy` already existed; created `/terms` (GDPR/AVG-compliant Dutch B2B SaaS ToS: definitions, permitted use, subscription/payment 14-day terms, data processing DPA, IP, liability cap 3 months fees, Dutch law/Amsterdam courts); footer Terms link added next to Privacy.

### Contacts & companies
- ~~**[LABEL-INLINE] Inline label creation from contact view**~~ ✅ **DONE (session 61)** — `LabelPicker` in `LabelChip.tsx` now shows a `＋ New label` button (admin-only) that expands inline: name input + 6 preset color swatches + Create button; on success, invalidates `['contact-labels']` and auto-selects the new label. `useMutation` + `useQueryClient` added; Settings link text updated to reference both paths.
- ~~**[CO-CLICK] Companies clickable → contact list**~~ ✅ **DONE (session 71)** — company names in CompaniesTab are now clickable buttons; clicking switches to Contacts tab with that company pre-filtered. `companyFilter` state lifted to `ContactsPage`; `CompaniesTab` gains `onCompanyClick` prop; `ContactsTab` accepts `companyFilter`/`setCompanyFilter`; dismissible company chip shown above contacts table; company badges in contacts rows also toggle the filter on click.

### LiveChat
- ~~**[LIVECHAT-INBOUND] Inbound WhatsApp messages not received**~~ ✅ **DONE (session 59)** — `_ensure_instance` now calls `_register_webhook` after creating the instance (and on every QR fetch to handle env switches). Uses `settings.effective_base_url` to build the correct URL per Railway environment. No migration needed.
- ~~**[LIVECHAT-QR] Fix WhatsApp QR code**~~ ✅ **DONE (verified session 76)** — `ChatPage.tsx` now shows a proper error state when QR fetch fails ("Couldn't load the QR code — check Evolution API is configured for this environment"); `qrError` flag drives the message; QR behind icon button (session 61).
- ~~**[LIVECHAT-QR-ICON] QR code behind icon button**~~ ✅ **DONE (session 61)** — always-visible QR panel replaced with amber `QrCode` icon button (visible only when disconnected); clicking opens modal with QR image, error state, and Evolution API attribution notice.
- ~~**[LIVECHAT-MEDIA] Send / paste / attach media in chat**~~ ✅ **DONE (session 78)** — Backend: `msg_type`/`media_url`/`media_filename`/`media_mime` columns on `ChatMessage` (migration `lm7n8o9p0q1r`); `whatsapp_service.send_media()` calls Evolution API `sendMedia` with base64 payload; `POST /chat/sessions/{id}/media` endpoint (16 MB cap, multipart). Frontend (`ChatPage.tsx`): paperclip button → hidden file input, clipboard paste intercept on textarea, attachment preview row (image thumbnail or filename chip + ✕), `mediaMutation` posts FormData, message thread renders `<img>` for images and `FileText` chip for documents. Commit in `land: session/g-20260621-livechat-media`.
- ~~**[LIVECHAT-STATUS] Message delivery status**~~ ✅ **DONE (session 65)** — `msg_status` (sent|delivered|read) + `evolution_msg_id` on `ChatMessage`; migration `a1b2c3d4e5f6`; `message.update` webhook handler maps `DELIVERY_ACK`→delivered, `READ`/`PLAYED`→read; `MsgStatusTick` component (single/double tick, blue for read) on agent messages; real-time updates via `msg_status_update` WS event.
- ~~**[LIVECHAT-TICKET] Create ticket from chat session**~~ ✅ **DONE (verified session 64)** — `createTicketMutation` + ticket chip already present in `ChatPage.tsx`.
- ~~**[LIVECHAT-CANNED] Canned responses in reply box**~~ ✅ **DONE (session 64)** — type `/` in reply box opens a picker reusing `GET /templates`; selecting inserts text; commit `92b3fc6`.
- ~~**[LIVECHAT-FILTER] Session list filters**~~ ✅ **DONE (session 64)** — Mine/Open/All filter tabs subsumed by [LIVECHAT-STATUS-MODEL]; commit `92b3fc6`.
- ~~**[LIVECHAT-HISTORY] Contact chat history**~~ ✅ **DONE (session 64)** — collapsible "Previous conversations" panel when session has a linked contact; loads past solved sessions + messages read-only; commit `92b3fc6`.
- ~~**[LIVECHAT-NOTES] Internal agent notes on session**~~ ✅ **DONE (session 64)** — Notes tab in active session; `/note` endpoint stores `sender_type="note"` (distinct render, never sent to WhatsApp); commit `92b3fc6`.
- ~~**[LIVECHAT-PERF] Performance: virtual session list + WS heartbeat**~~ ✅ **DONE (session 78)** — Backend (`chat/router.py`): both `chat_ws` + `agent_ws` spawn a 30s asyncio ping loop sending `{"type":"ping"}`; pong frames ignored silently; ping task cancelled on disconnect. Frontend (`ChatPage.tsx`): ping→pong reply; reconnect on close/error with 3s delay + 5-retry cap + `destroyed` flag to prevent reconnect after unmount. `react-window@2.2.7` installed; session list replaced with virtualised `<List rowHeight={80}>` using `ResizeObserver` for container height. Commit in `land: session/f-20260621-livechat-perf`.
- ~~**[LIVECHAT-CONTACT-POPUP] Click contact name → inline popup**~~ ✅ **DONE (session 64)** — contact name in session header opens inline-editable modal (`PATCH /contacts/{id}`); no page navigation; commit `92b3fc6`.
- ~~**[LIVECHAT-BOOKING-EMAIL] Booking via chat requires email — prompt if missing**~~ ✅ **DONE (session 78)** — In `ActionsModal.tsx`: `handleSendBooking()` checks `bookingContact.email`; if missing, shows an inline overlay prompt ("This contact has no email address. Enter one to send the booking confirmation.") with email input + Confirm/Cancel; on confirm calls `PATCH /contacts/{id}` then proceeds with `POST /booking/send`. Commit in `land: session/e-20260621-livechat-booking-email`.
- ~~**[LIVECHAT-CREATE-CONTACT] Create contact from unknown WhatsApp number**~~ ✅ **DONE (session 64)** — "Create contact" button in session header when no contact linked; pre-filled modal with phone; on save links contact to session via `PATCH /chat/sessions/{id}`; commit `92b3fc6`.
- ~~**[LIVECHAT-SESSION-ACTIONS] Right-click + bulk actions on sessions**~~ ✅ **DONE (session 65)** — `SessionContextMenu` right-click dropdown (close/reopen/delete); checkbox multi-select (visible on hover or when any selected); sticky bulk action bar (Close/Reopen/Delete N); `POST /chat/sessions/bulk` backend endpoint; commit with session 65 batch.
- ~~**[LIVECHAT-PHONE-NORM] Normalize Contact.phone to E.164 on save**~~ ✅ **DONE (session 65)** — `_normalize_phone()` in `contacts/service.py`; Dutch local `0XXXXXXXXX`→`31XXXXXXXXX`; called in create/update/import; amber warning chip in `ContactDetail.tsx` for unconverted local numbers; no migration needed.
- ~~**[LIVECHAT-SESSION-DEDUP] Partial unique index to prevent duplicate open sessions**~~ ✅ **DONE (verified session 64)** — migration `a0b1c2d3e4f6_livechat_session_dedup_indexes.py` already present with partial unique indexes on `(tenant_id, whatsapp_phone) WHERE is_open` + `(tenant_id, visitor_id, source) WHERE is_open`.
- ~~**[LIVECHAT-WIDGET-HISTORY] Widget reconnect restores message history**~~ ✅ **DONE (session 65)** — `ws.onopen` fetches `GET /chat/public/sessions/{visitor_id}/messages?tenant_slug=` (public, no auth); renders history before greeting on first connect; `greeted` flag prevents replay on auto-reconnect; greeting suppressed if history exists.
- ~~**[LIVECHAT-EVOLUTION-LICENSE] Evolution API license compliance notice**~~ ✅ **DONE (session 61)** — see [LIVECHAT-QR-ICON]; attribution notice in QR modal footer with links to Evolution API repo and Apache 2.0 license.

### Config / ops one-liners
- **[PRIV1] Railway private DB URL** — switch `DATABASE_URL` in Railway (both pairs: devsandbox/sandbox and dev/app) from the public Postgres connection string to Railway's internal private networking URL (`railway.internal` hostname). Eliminates network egress charges. No code change; env var update only in Railway dashboard. Verify the app connects successfully after each env switch.
- **getyippie.com 502 fix** — `Haiku` — Cloudflare proxy toggle (orange→grey→wait→orange) for Railway domain verification.
- **[Phase 13] Invite-link base URL** — `Haiku` — code already done (`CLIENT_BASE_URL`); just set Railway env vars: devsandbox → `https://sandbox.getyippie.com`, dev → `https://app.getyippie.com`.
- ~~**[Phase 13] Deliverability cleanup**~~ ✅ **DONE (2026-06-11)** — single DMARC + single DKIM (verified) + SPF (verified). DNS is clean.
- **`diederik@getyippie.com` personal account on live** — `Haiku` — make it the working primary address in the live pair (receiving already verified).
- **`INBOUND_EMAIL` in live Railway envs** — `Haiku` — currently unset in both live envs; set before go-live.

### Bugs & fixes (2026-06-22)
- ~~**[BK-DATE] Booking: available dates cut off around 3 July**~~ ✅ **DONE (session 82)** — `booking_window_days` column on `calendar_settings`; public slot endpoints use it.
- ~~**[DEMO-BUG] Request demo: "Something went wrong" error**~~ ✅ **DONE (session 82)** — proxy now surfaces upstream detail; schema verified.
- ~~**[EMAILTRACK-NAV] Email tracking sidebar link opens billing page**~~ ✅ **DONE (session 82 — verified)** — `MODULE_MAP.marketing` → `/marketing` already correct in code; no wrong path.
- ~~**[ROI-FIX] ROI calculator: support staff variable missing from equation**~~ ✅ **DONE (session 83 — verified)** — already in formula. No change.
- ~~**[BOOK-LOGO] Booking page shows old logo**~~ ✅ **DONE (session 82)** — `logo-lockup-onLight.svg` used across BookingPage/MeetPage/BookingManagePage.
- ~~**[PRIVACY-FIX] Privacy + terms page content errors**~~ ✅ **DONE (session 83 — verified)** — both pages already correct. No change.

### Commercial site polish (2026-06-22)
- ~~**[WEB-CENTER] Commercial site pages not centred consistently**~~ ✅ **DONE (session 84)** — Added `.sectionInner {max-width:var(--maxw); margin:0 auto}` to `content.module.css`; all section bodies in vs-zendesk, for-smbs, for-agencies, blog wrapped in `.sectionInner`.
- ~~**[WEB-USE-NAV] Add "Use cases" to commercial site header nav**~~ ✅ **DONE (session 83)** — direct link to `/for-smbs` added in `SiteNav.tsx`.
- ~~**[ABOUT-COMP] About page: remove company names, keep descriptions**~~ ✅ **DONE (session 83 — verified)** — already anonymised. No change.
- ~~**[BLOG-AUTHOR] Set blog author to Diederik Brinkman**~~ ✅ **DONE (session 83 — verified)** — already set. No change.
- ~~**[VS-ZD-FIX] vs-zendesk page fixes**~~ ✅ **DONE (session 83)** — AI section + price already correct; ✓/✗ → Yes/No.
- ~~**[FOUNDER-PLAN] Founder plan: 10 users + 50% module discount**~~ ✅ **DONE (session 82)** — `plans.py` Founder: 10 users + `module_discount: 0.5`. Web config.ts founder users fixed to 10 in session 84.

### Inbox counters, booking hours, logo & pricing (2026-06-22 additional)
- ~~**[INBOX-UNREAD] Inbox: unopened mails counter not working**~~ ✅ **DONE (session 83)** — `?? pending` fallback removed from badge logic in `InboxQueue.tsx`; badges now show true `unread`/`unread_personal` counts.
- ~~**[INBOX-SHARED-CNT] Inbox: shared mails counter looks off**~~ ✅ **DONE (session 83)** — same fix as [INBOX-UNREAD].
- ~~**[BK-HOURS-BUG] Booking: work hours not enforced — slots outside 9:00–17:00**~~ ✅ **DONE (session 84)** — `timezone` column on `calendar_settings`; `get_available_slots()` uses `ZoneInfo`; timezone dropdown in CalendarPage settings.
- ~~**[COM-LOGO-VIS] Commercial site: logo more visible in hero**~~ ✅ **DONE (session 83)** — `logo-blue-bg-mark.svg` at `opacity: 0.10` as absolute-positioned hero accent. `page.tsx` + `page.module.css`.
- ~~**[AUTH-LOGO-SIZE] Login + booking pages: larger logo**~~ ✅ **DONE (session 83)** — `w-56 mx-auto` on LoginPage, BookingPage, MeetPage, BookingManagePage.
- ~~**[PLAN-STARTER] Starter plan: max 3 users or keep at €19**~~ ✅ **DONE (session 84)** — Capped at 3 users, €19/mo unchanged; `invite_user()` enforces limit; `plans.py` + `config.ts` + pricing page updated.
---

## ✅ Done

**Foundations & infra:** Resend inbound+outbound email; 30s email poller; APScheduler jobs (poller 30s, enrichment 10s, pending-send flush 5s, retention 1h, SLA escalation 5m, auto-close 1h, go-live 60s); all four Railway environments healthy; full **Performance initiative** (Steps 1–4).

**Multi-tenant correctness:** **per-tenant webhook routing** by `inbound_email` + slug fallback (`core/tenant.py`, `email_poller.py`) — the old "route everything to tenant #1" stub is gone; **`is_active` login-blocking**, **`is_demo`** blocking real sends, **`go_live_at`** auto-activation scheduler (`go_live_job`, 60s); `set_tenant_context()` per request.

**Auth & client management:** critical path A/B/C complete — settings page (`[25]`), registration/invite (`[26]`), forgot/reset password (`[27]`), superadmin invite (`[28]`), delete client/superadmin password-gated (`[24]`), **impersonation / "view as" (`[23]`)** — `POST /admin/tenants/{id}/impersonate` 1-hr token + amber banner, client list filter + demo tick (`[5]`), bulk status change (`[6]`), company name in sidebar (`[7]`), hide own env (`[8a]`), scoped superadmin management (`[8b]`), separate add-admin + tenant-users modals. **Superadmins page icon buttons** (session 30) — ToggleRight/Left + Trash2 icons consistent with Clients page. **Platform Modules panel** (session 30) — `PATCH /admin/modules` bulk-toggles a module for all tenants; side-by-side panel next to superadmins list.

**Inbox:** stay-in-window + undo approve/reject (`[10]`), DeptReminderModal with dept+SLA in popup (`[11]`), filter processed by status (`[13]`), language-matching replies (`[15]`), reply-to-email fixed across 4 stacked bugs (`[16]`), undo send incl. compose (`[17]`) + **undo-send UI polish/auto-dismiss (`[47]`)**, attachments incl. compose (`[18]`) + **attachment chips with x-to-remove (`[45]`)**, modules order at the source (`[19]`), duplicate-send fix (`[32]`), delete tickets (`[33]`), ticket deadline banners + **glowing sidebar badge (`[34]`/`[14]`)**, `Cmd/Ctrl+Enter` send (`[35]`), **scroll-only inbox + larger compose (`[9]`)**, Sent view (`[41]`), **Spam/Bin views + bulk bin/spam action (`[12]`)**, **Spam→Bin (10d) / Bin purge (20d) retention scheduler (`[42]`)**, reply-subject language (`[44]`), nice HTML outbound email (`[46]`), per-user email signatures.

**Contacts:** tenant-defined **contact labels (`[38]`, session 31)** — label CRUD in `/settings/labels`, assign per contact, filter the list by label; foundation for the Pipeline module + demo flow.

**Email templates:** `ResponseTemplate` model + full CRUD (`GET/POST/PATCH/DELETE /tickets/templates`) + `POST /tickets/templates/ai-suggest` (Claude ranks templates by relevance to email context). `/settings/templates` CRUD page, `TemplatePicker` component with search + AI suggest wired into DraftReview reply panel and ComposeModal. "Templates" sidebar link for all users.

**AI module:** the `ai` per-tenant flag (`require_module("ai")`, on for every tenant) switches on all the AI extras across **inbox + tickets** — incoming-mail scan that **autofills the ticket fields** (`ai_suggested_subject/description/priority/category`), the inbox **briefing/customer summary** (`generate_context_summary` → `context_summary`), and the **generate / suggest-reply / improve-reply / compose-suggest** actions. Turn the module off and none of it runs. (No separate nav page — it's the AI capability layer itself.)

> Full per-item detail, bug histories and commit refs are preserved in **Appendix A — Session log**.

---

## Open questions

- **Sandbox email routing** — `devsandbox` and `sandbox` share one Sandbox DB, so inbound to either `dev-support@`/`sb-support@` surfaces in both; the inbox follows the login, not the URL. Document as intentional, or split per `INBOUND_EMAIL` if true isolation is wanted.

---

## 📎 Appendix A — Session log

---

### Session 52 — 2026-06-15 (Tier 1: Billing / plans — Tenant.plan + feature gating)

**Migration:** `u1v2w3x4y5z6` (down_revision `t0u1v2w3x4y5`) — adds `tenants.plan` (String(20), NOT NULL, `server_default='enterprise'` → backfills all existing rows). No RLS (tenants table itself). Pushed to `devsandbox` + `devsandbox:sandbox`.

Opus agent build. `app/core/plans.py`: `PlanTier` enum (free/starter/pro/enterprise), `PLAN_FEATURES` map, `features_for_plan`/`plan_allows` (core features never gated). `require_feature(name)` dependency (`auth/dependencies.py`) composes with `require_module` — **403** module-disabled, **402** plan-locked. `main.py` applies it to ADVANCED_FEATURES routers (chat/calendar/pipeline/emailtracking/ai) and exposes `plan`+`allowed_features` in `GET /tenant/config`. Superadmin Edit modal Info tab: Plan selector via `PATCH /admin/tenants/{id}` (`admin/schemas.py` + `service.py`, `TENANT_SAFE_FIELDS`). Frontend `shell/PlanGate.tsx` (sibling to ModuleGate) wraps calendar/pipeline/chat routes with an upgrade card; `api/tenant.ts` + `App.tsx` + `SuperAdminPage.tsx` updated. Distinct from billing module's `Subscription.plan_name`. No checkout/Stripe (out of scope). Verified `tsc --noEmit` exit 0 + backend `py_compile` clean; single migration head.

---

### Session 51 — 2026-06-15 (Tier 2: [I1] inbox search)

**Migration:** `t0u1v2w3x4y5` (down_revision `s9t0u1v2w3x4`) — pg_trgm GIN indexes for the inbox-search ILIKE columns. Pushed to `devsandbox` + `devsandbox:sandbox`.

Opus agent build. Shared debounced (300ms) search across Pending/Processed/Sent; query persists across tab switches (`q` in queryKey, not reset on switch). Backend: `?q=` on `GET /inbox/drafts` (ILIKE over AI/final subject + inbound subject/sender/raw_body) and `GET /emailtracking/outbound` (subject/to_email), both tenant-scoped, parameter-bound `.ilike()`; new `GET /inbox/trending` (in-Python word-frequency over 200 recent draft subjects, stopword-filtered, >1× only). Frontend (`InboxQueue.tsx`): search bar inline with tabs, trending chips (grey, clickable, 15-min refetch), Sent paginated 9/page, Processed filter pills → dropdown. Fixed a pre-existing double-slice in the draft paginator. Reverted a stray debug `print` the agent left in `database.py` (leaked DB user/host/pwd-len). Verified `tsc --noEmit` clean + backend `py_compile` clean. Signatures (`useSignatures`/`SignaturePicker`) + j/k/r/e hotkeys preserved.

---

### Session 50 — 2026-06-15 (Tier 2: [S1] multi-signature + [S2] signature image upload)

**Migration:** `s9t0u1v2w3x4` (down_revision `r8s9t0u1v2w3`) — `user_signatures` table + `tenant_isolation` RLS + backfill from `users.email_signature`. Pushed to `devsandbox` + `devsandbox:sandbox`.

Opus agent build. Backend: `UserSignature` model + `User.signatures` rel (`core/models.py`); `SignatureOut/Create/Update` + `MAX_SIGNATURE_BODY_CHARS` (`core/schemas.py`); CRUD `GET/POST /auth/me/signatures`, `PATCH/DELETE /auth/me/signatures/{id}` (`auth/router.py`) — one-default enforcement, user+tenant scope, auto-promote default on delete; `email_html._paragraphs()` preserves an allowlisted inline base64 `<img>` (svg/png/jpeg only, rebuilt with fixed style — no script vector). Legacy `users.email_signature` column **retained** for rollback (drop is a follow-up). Frontend: `useSignatures` hook (types + `readSignatureImage`/`signatureImageTag`/`swapSignature`); `SignaturePicker` dropdown; `ProfileSettingsPage` signature list (cards, reorder, default star, image upload); `InboxQueue`/`DraftReview` prefill default + picker; `TemplatesPage` preview reads default. DraftReview also keeps session-49 hotkeys (r/e) — both merged. Verified: `tsc --noEmit` clean, backend changed files `py_compile` clean.

---

### Session 49 — 2026-06-14 (Tier 3 batch + ROADMAP cleanup)

**Commits:** `4601e62` (TE4 + sonner), `707afb2` (ROADMAP cleanup × 7), `6bb678d` (hotkeys + toast) — pushed to `devsandbox` + `devsandbox:sandbox`.

**[TE4] Template editor AI tip:**
- Unlayer renders its toolbar in a sandboxed iframe — cannot inject a tooltip from React.
- Added a `<p className="text-xs text-slate-400 mx-5 mb-1 mt-5">` hint line directly above the `<EmailEditor>` div inside the full-screen modal: "💡 Tip: Use **AI → Compose** to generate rich HTML content, then copy it here using the HTML source button."
- Installed `sonner@2.0.7` in the same commit for the toast work below.

**[35-backlog] Hotkeys:**
- `InboxQueue.tsx`: added `focusedIdx` state + reset effect. j/k navigate the draft list (blue `border-blue-400 ring-2 ring-blue-200` highlight on focused row); r opens `navigate('/inbox/drafts/' + id)` for focused item. Second `useEffect` placed after `pageDrafts` definition to avoid TypeScript temporal dead zone.
- `DraftReview.tsx`: added `replyTextareaRef` + hotkeys effect placed after all mutations. r focuses the reply textarea; e triggers `reviewMutation.mutate({ action: 'approve' })` when reply text is empty and draft not yet processed.
- `/` (focus search) skipped — no search input exists in InboxQueue.

**[43] Ticket deadline toast:**
- `App.tsx`: added `<Toaster position="bottom-right" richColors />` from sonner.
- `Sidebar.tsx`: `toastShownRef` guards a one-shot `useEffect` watching `redCount`. Fires `toast.warning("N overdue ticket(s) need attention", { duration: 8000, action: { label: 'View', onClick: navigate('/tickets') } })` on first non-zero red count. Does not re-fire on subsequent refreshes.

**[48] Clickable rows:**
- `TicketList.tsx`: already uses `<Link to={/tickets/${t.id}}>` wrapping each row — confirmed in code. No change needed.

**ROADMAP cleanup (7 items already in code, marked done):**
- [30] Mail-all/broadcast — compose+queue_send system + List-Unsubscribe headers (commit `b1c52b6`)
- Mobile web — BottomNav.tsx + useMobile.ts + responsive layout (commit `b02b746`)
- [C1] Column customisation + [C2] Pre-import column mapping — ColumnPicker.tsx + contact_column_prefs (commit `9aac876`)
- [V1] Sent inbox — confirmed present in Tier 3 (session 42)
- [36b-5] Companies multi-select — ContactsPage.tsx line 102, confirmed in code
- [T1] Template editor full-screen modal — `fixed inset-0 z-50`, `editorEverOpened` flag, confirmed in code

---

### Session 44 — 2026-06-14 (Tier 1: PostgreSQL RLS policies)

**Migration:** `n4o5p6q7r8s9` — pushed to `devsandbox` + `devsandbox:sandbox`.

**PostgreSQL RLS — 8 missing tables:**
- Migration `n4o5p6q7r8s9` (revises `m3n4o5p6q7r8`): adds `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, and a `tenant_isolation` policy to all 8 tables that were created after the original RLS migration (`c3d4e5f6a7b8`) and were therefore left unprotected.
- **Standard policy** (`tenant_id = app_tenant_id()`) applied to 7 tables with a direct `tenant_id` column: `companies`, `contact_labels`, `label_click_tokens`, `outbound_emails`, `pending_sends`, `pipeline_stages`, `contact_pipeline_entries`.
- **Subquery policy** applied to `contact_label_links` (pure junction table, no `tenant_id`): `EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_label_links.contact_id AND c.tenant_id = app_tenant_id())` for both `USING` and `WITH CHECK`.
- Explicit `GRANT SELECT, INSERT, UPDATE, DELETE ... TO app_user` on each table (cheap insurance, same pattern as `k1l2m3n4o5p6`).
- Migration is idempotent (`DROP POLICY IF EXISTS` before each `CREATE POLICY`).
- All `app_user` role and `app_tenant_id()` prerequisites come from `c3d4e5f6a7b8`; `ALTER DEFAULT PRIVILEGES` from `c9d0e1f2a3b4` already covered grants, but repeating them is harmless.

---

### Session 38 — 2026-06-12 (Tier 1: Calendar module)

**Commit:** `e54009a` — pushed to `devsandbox` + `devsandbox:sandbox`.

**Calendar module:**
- Migration `k1l2m3n4o5p6` (chains from `j0k1l2m3n4o5`): `calendar_events` table (id UUID PK, tenant_id UUID NOT NULL, title VARCHAR(255), description TEXT, start_at/end_at TIMESTAMPTZ, all_day BOOLEAN, contact_id FK→contacts SET NULL, ticket_id FK→tickets SET NULL, created_by FK→users, created_at). Index on `(tenant_id, start_at)`. RLS enable/force + tenant_isolation policy + app_user grant. Migration also appends `'calendar'` to every existing tenant's `enabled_modules`.
- `calendar/models.py`: `CalendarEvent` SQLAlchemy ORM model.
- `calendar/schemas.py`: `CalendarEventCreate`, `CalendarEventUpdate`, `CalendarEventOut`, `CalendarItem` (kind: `"event" | "deadline"`) — the range response mixes both types.
- `calendar/service.py`: `list_calendar_items(db, tenant_id, start, end)` merges `CalendarEvent` rows + open/in-progress tickets where `sla_due_at` is in range. Standard CRUD with tenant-scoped FK validation to prevent IDOR.
- `calendar/router.py`: `GET /calendar/items?start&end`, `POST /calendar/events`, `GET/PATCH/DELETE /calendar/events/{id}` (204 on delete).
- `modules/__init__.py` + `config.py ALL_MODULES`: `"calendar"` registered.
- `CalendarPage.tsx`: hand-built Monday-start 6-week month grid (no external lib). Prev/next/Today nav. Today cell highlighted with `bg-yippie text-white` circle. Event chips (blue, show time). Deadline chips (red ≤24h overdue/due-soon, orange otherwise) navigate to `/tickets/{id}`. Clicking an event chip opens edit modal. "New event" button opens create modal. Modal fields: title (required), start date/time, end date/time, all-day toggle, description, contact typeahead (`/contacts?search=`), ticket typeahead (client-filtered from loaded tickets). `max-w-md` modal, consistent with platform.
- Lazy route under `ModuleGate calendar` in `App.tsx`; Calendar nav item (`Calendar` lucide icon) in `Sidebar.tsx`.
- Note: used `sla_due_at` (not `follow_up_at`) as the ticket deadline column — `sla_due_at` is the real deadline column on `tickets`; `follow_up_at` only exists on `draft_tickets`.

---

### Session 37 — 2026-06-12 (Tier 1: Phase 9C tracked-click tokens, T2 Unlayer campaign blocks, emailtracking module)

**Commits:** squash-merged to `devsandbox` via PRs #24, #25, #26.

**[Phase 9C] Tracked click / campaign buttons:**
- Migration `h8i9j0k1l2m3`: `label_click_tokens` table + `campaign_buttons_json`/`prerendered_html` columns on `pending_sends`.
- `tracking/models.py`: `LabelClickToken` (token UUID PK, tenant_id, contact_id FK→contacts CASCADE, label_id FK→contact_labels CASCADE, button_id, used_at, created_at).
- `tracking/router.py`: public `GET /track/click/{token}` — burns token (sets `used_at`), upserts into `contact_label_links` via `pg_insert().on_conflict_do_nothing()`, redirects 302 to `/track/confirm` or `/track/confirm?expired=1`.
- `core/email_html.py`: `render_campaign_buttons_html(buttons, token_map)` replaces `#` hrefs with real tracking URLs; `render_email_html()` gains `campaign_buttons_html` injection.
- `inbox/service.py`: `flush_pending_sends()` generates `LabelClickToken` rows per button×recipient, passes `token_map` to `render_campaign_buttons_html()`; `queue_send()` extended with `campaign_buttons_json` + `prerendered_html` params.
- `inbox/router.py`: compose endpoint passes `campaign_buttons_json` + `html_body` form fields; resolves contact_id from recipient email for token generation.
- `pages/TrackConfirmPage.tsx`: "Thank you for your response!" / "Link already used" based on `?expired=1`.
- `App.tsx`: `/track/confirm` route in both unauthenticated and authenticated route trees.

**[T2] Campaign buttons as native Unlayer blocks:**
- `TemplatesPage.tsx` rebuilt: removed Campaign Buttons tab; registered `campaign_button` custom tool via `options.customTools` (drag-and-drop onto canvas, inline-styled `<a>` preview); `design:updated` listener traverses design JSON to sync button count to React state; per-button config panel below canvas (text, label picker, multiple_allowed, colors); `extractButtonsFromDesign()` at save time.

**emailtracking module:**
- Migration `i9j0k1l2m3n4`: `outbound_emails` table with all tracking fields.
- `emailtracking/models.py`: `OutboundEmail` (id, tenant_id, resend_email_id unique, to_email, subject, actor_id, contact_id FK SET NULL, draft_id, kind, status, delivered/opened/clicked/bounced timestamps, bounce_type, created_at).
- `emailtracking/service.py`: `create_outbound_email()`, `get_by_resend_id()`, `handle_event()` (status state machine), `list_outbound()`.
- `emailtracking/webhooks.py`: public `POST /emailtracking/webhooks/resend`; optional HMAC verification via `RESEND_WEBHOOK_SECRET`; handles email.delivered/opened/clicked/bounced; always returns 200.
- `emailtracking/router.py`: `GET /emailtracking/outbound` (module-gated, returns list[OutboundEmailOut]).
- `core/mailer.py`: `send_email()` now returns `str | None` (Resend response `id`).
- `inbox/service.py`: after each send, calls `create_outbound_email()` with the returned Resend ID.
- `config.py`: `'emailtracking'` added to `ALL_MODULES`; `resend_webhook_secret: str = ""` in Settings.
- `modules/__init__.py`: `emailtracking_router` registered as `"emailtracking"`.
- `main.py`: emailtracking webhook router mounted as public (no auth).
- `InboxQueue.tsx`: Sent tab uses `GET /emailtracking/outbound` when module enabled (status badge: Sent/Delivered/Opened/Clicked/Bounced); falls back to activity log when disabled.

---

### Session 36b — 2026-06-12 (Tier 2: contact import/export + multi-select [29][40][20])

**Commits:** `266c4a2` (feat) + `f0e4906` (fix: wire into ContactsPage) — deployed `devsandbox` + `sandbox` by Diederik.

**Backend (`contacts` module):**
- `service.py`: `import_contacts(rows)` bulk-inserts from a list of dicts, dedupes by email (`INSERT … ON CONFLICT DO NOTHING`). `export_contacts()` returns all contacts as CSV bytes. `bulk_delete_contacts(ids)` soft-deletes via `deleted_at`.
- `router.py`: `POST /contacts/import` (multipart, accepts CSV / JSON / XLSX — `openpyxl` added to `requirements.txt`); `GET /contacts/export` (streams CSV); `DELETE /contacts/bulk` (body `{ids: [...]}` — soft-delete).
- `schemas.py`: `ContactImportRow`, `ImportResult` response.

**Frontend (`ContactsPage.tsx`):**
- Multi-select: checkbox per row; header checkbox selects all visible.
- Bulk action bar (appears when ≥1 selected): Compose (opens ComposeModal pre-filled), Export CSV (downloads current selection), Label (label picker applies to all selected), Delete (confirm modal → `DELETE /contacts/bulk`).
- Import button: file input (`accept=".csv,.json,.xlsx"`), calls `POST /contacts/import`, shows result summary (imported / skipped duplicates / errors).
- Export All button: calls `GET /contacts/export`, triggers browser download.

---

### Session 36 — 2026-06-12 (Tier 3 batch: V2, V3, V5, V6, V7, V9, V10, V11, TE1, TE2)

No backend changes. Pure frontend. No migration needed.

**`App.tsx`:**
- Removed `DepartmentsPage` lazy import (departments live on Team page).
- Changed `/settings/departments` route → removed; `/settings/labels` route → `/settings` (renders `LabelsPage` inside `ModuleGate contacts`).

**`Sidebar.tsx`:**
- Sidebar "Settings" link now points to `/settings` (was `/settings/departments`).
- Removed "Labels" sidebar link and `Tag` import.

**`TemplatesPage.tsx`:**
- `[TE1]` Added `editor: { confirmOnDelete: false }` to Unlayer `options` — deletions are now immediate, no confirmation dialog.
- `[TE2]` Signature preview moved inside the editor border as a `rounded-b-xl` footer strip attached to the bottom of the Unlayer canvas div; separate `shrink-0` card below the editor removed.

**`InboxQueue.tsx`:**
- `[V2]` Fixed "All contacts" button: `staleTime` set to `0` (always fresh), defensive `Array.isArray(data)` fallback, added `catch` block so API errors don't silently fail.
- `[V3]` Compose button now passes `{ usePersonalFrom: true, ... }` in `composeInitial` when `mailbox === 'personal'` and user has `inbound_email` set.

**`TeamSettingsPage.tsx`:**
- `[V7]` Team members list capped at `max-w-2xl` to give the departments panel more room.
- `[V6]` `DepartmentsPanel` widened to `w-80` and given `pt-[78px]` to align its header with the team table header row.

**`ProfileSettingsPage.tsx`:**
- `[V5]` Signature textarea merged into the personal-email-address form card (now one card: email + personal address + signature + hotkeys + Save). Separate signature card removed. Change Password card is now standalone below, wrapped in `max-w-sm`.

---

### Session 35 — 2026-06-12 (Tier 1: Phase 9B — Unlayer drag-and-drop template editor)

**Commit:** `f347c10` — deployed `devsandbox` + `sandbox`.

**Backend:**
- Migration `g7h8i9j0k1l2` (revises `d4e5f6a7b8c9`, idempotent): adds `design_json TEXT`, `html_body TEXT`, `campaign_buttons JSONB DEFAULT '[]'` to `response_templates`.
- `models.py`: three new nullable fields on `ResponseTemplate`.
- `schemas.py`: new `CampaignButton` Pydantic model (text, label_id, multiple_allowed, bg_color, text_color, border_radius, font_size, font_weight, border_color, border_width). `TemplateCreate`/`TemplateUpdate`/`TemplateOut` all extended; button lists serialized as JSON string for the Text column.
- `service.py`: `create_template`/`update_template` persist new fields; campaign button lists serialized with `json.dumps`.
- `core/email_html.py`: `render_email_html()` gains `prerendered_html` param — when set, embeds it directly in the accent-bar shell (skips plain-text escaping). New `render_campaign_buttons_html(buttons, base_url)` renders inline-styled `<a>` buttons with `#` hrefs (real tokens land in Phase 9C). Added `_safe_hex`/`_safe_int` validators to guard user-supplied style values.

**Frontend:**
- `react-email-editor@1.8.0` installed (Unlayer, MIT licence).
- `TemplatesPage.tsx` fully rebuilt: 280px template list (+ new, "Rich design" badge, delete with confirm, blue selected state) + editor panel with name input, **Email Design** tab (Unlayer canvas, `loadDesign` on selection, `exportHtml` on save, spinner until `onReady`, canvas kept mounted across tab switches) and **Campaign Buttons** tab (global multiple-answers toggle, drag-reorder rows with text + color/radius/font/border pickers, live email-style preview). Signature preview block below editor.
- `TemplatePicker.tsx`: new `onSelect(body, isHtml?)` signature; "Visual" badge for rich templates; `triggerClassName`/`triggerIconSize`/`direction` props for flexible placement; "Manage templates" footer link.
- `InboxQueue.tsx`: Templates button directly beneath Compose (same blue style); selecting a template opens ComposeModal pre-filled (rich HTML preview card + plain-text body, uses new `templateHtml` field on `ComposeInitialState`).
- `DraftReview.tsx`: rich template selections converted to plain text via shared `htmlToText` before insertion.
- `Sidebar.tsx`: Templates NavLink and now-unused `FileText` import removed.

**Deferred to Phase 9C:** `label_id` mapping in campaign buttons, `LabelClickToken` model, `/track/click/{token}` endpoint, and rich-HTML sending pipeline.

---

### Session 33 — 2026-06-12 (Tier 1: response templates + profile password fix)

**Backend (tickets module):**
- `schemas.py`: added `TemplateUpdate(name, body)` and `TemplateSuggestRequest(context)`.
- `service.py`: `update_template()`, `delete_template()`, `suggest_templates()` — the suggest function calls Claude Haiku via `_client()`/`_model()` from `ai_scanner.py` to rank all tenant templates by relevance to the email context; returns up to 3 most relevant.
- `router.py`: `PATCH /tickets/templates/{id}` → update, `DELETE /tickets/templates/{id}` → delete (204), `POST /tickets/templates/ai-suggest` → AI-ranked list. Static `/templates/*` routes declared before dynamic `/{ticket_id}` routes (FastAPI declaration order matters).

**Frontend:**
- New `TemplatesPage` (`/settings/templates`): list/create/edit/delete response templates. Same pattern as `DepartmentsPage` — inline edit form, confirm-on-delete. Body shows `line-clamp-3` preview. Empty state.
- New `TemplatePicker` component (`modules/inbox/components/TemplatePicker.tsx`): floating panel triggered by "Templates" button; search input + filtered list + optional AI Suggest button (calls `/tickets/templates/ai-suggest` with context string); click-to-insert calls `onSelect(body)`; closes on outside click or selection.
- `DraftReview.tsx`: TemplatePicker wired next to Generate/Improve; passes `msg.subject + msg.raw_body` as AI context; prepends selected body to existing reply text.
- `InboxQueue.tsx` (ComposeModal): TemplatePicker added next to Message label; prepends body to existing compose text.
- `App.tsx`: `/settings/templates` route (lazy `TemplatesPage`).
- `Sidebar.tsx`: "Templates" link (FileText icon) for all users, below Profile.

**Profile password fix:**
- `ChangePasswordCard` had `mt-6` pushing it below the signature card's top edge in the `grid-cols-[1fr_280px]` layout — removed.
- New/confirm password fields switched from `grid-cols-2` to stacked, preventing overflow in the 280px column.

**Commit:** `0a5091e` — deployed `devsandbox` + `sandbox`.

---

### Session 32 — 2026-06-12 (Tier 3 UX polish: U1–U6)

All six session-30 quick-win items shipped in one commit (`413568e`). No migrations, pure frontend.

**[U1] Inbox: remove duplicate select-all (`InboxQueue.tsx`):**
- Removed the header-section select-all (lines ~694–705 pre-change); retained only the sticky select-all row in the scrollable list section.

**[U2] Inbox: add Sent tab (`InboxQueue.tsx`):**
- Added `'sent'` to `Tab` type. New `sentEvents` query fetches `/activity?limit=500` and filters client-side for `email.replied` + `email.composed`.
- Sent tab renders cards with subject, to, preview, Composed/Reply badge, timestamp. Skeletons while loading. Empty state shows `Send` icon + "No sent mail yet".
- Tab bar now shows Pending / Processed / Sent.

**[U3] Client info page: remove Inactivate + Delete (`SuperAdminPage.tsx`):**
- Removed Active/inactive toggle block and Delete-client block from the Info tab body. Both live exclusively in the Actions tab.

**[U4] Client actions: remove "Copy email" (`SuperAdminPage.tsx`):**
- Removed the "Inbound email / Copy" row from the Actions tab. Copy button still accessible in the Info tab's inbound-email field.

**[U5] Departments → Team page (`TeamSettingsPage.tsx`):**
- Added `DepartmentsPanel` component (w-72, compact cards) as right column using `flex gap-8` layout.
- `DeptModal` handles create/edit inline (modal). Shows name + SLA badge + email; Pencil/Trash2 icon buttons.
- Imports: `Plus`, `Pencil`, `Trash2`, `Building` added.

**[U6] Profile two-column layout (`ProfileSettingsPage.tsx`):**
- Top card (email, personal address, hotkeys, Save) stays full-width.
- Below: `grid grid-cols-[1fr_280px]` — signature form on left, `ChangePasswordCard` on right.
- Signature now has its own Save button (calls the same `mutation`); saves hotkeys + email at the same time.

**Deployed:** `git push origin devsandbox && git push origin devsandbox:sandbox` — no migration.

---

### Session 31 — 2026-06-11 (Tier 1: [38] contact labels)

Read ROADMAP + handoff; Diederik picked **[38] Contact labels** from Tier 1.

**Backend:**
- Migration `b9c0d1e2f3a4` (revises `a7b8c9d0e1f2`, idempotent raw SQL): `contact_labels`
  (`id, tenant_id, name, color, created_at`; tenant index + case-insensitive unique name per
  tenant) and junction `contact_label_links(contact_id, label_id)` with `ON DELETE CASCADE`
  both ways — deleting a label or contact cleans up its links.
- `ContactLabel` model + `Contact.labels` relationship (`lazy="selectin"`, ordered by name —
  no N+1 in the list).
- Label CRUD in the contacts router at `/contacts/labels` — **declared above the dynamic
  `/{contact_id}` routes** (FastAPI matches in declaration order; "labels" would otherwise 422
  as a UUID). Reads `CurrentUser`, mutations `AdminUser`; duplicate names pre-checked → 409.
- `ContactCreate`/`ContactUpdate` take optional `label_ids` (cross-tenant ids silently dropped);
  `ContactOut.labels` returns full label objects; `GET /contacts?label_id=` filters via
  `Contact.labels.any(...)`. Create/update re-fetch the contact after commit so the selectin
  relationship is loaded for serialization.
- Legacy free-form `tags` column/schemas untouched (non-destructive).

**Frontend:**
- New `/settings/labels` (`LabelsPage`, DepartmentsPage as template): name + `<input type="color">`
  with live chip preview, edit/delete per row, 409 surfaced as "already exists". Sidebar "Labels"
  link (Tag icon) in the admin block, gated on the contacts module; route wrapped in ModuleGate.
- Shared `LabelChip`/`LabelPicker` (`modules/contacts/components/LabelChip.tsx`) — tinted chips
  (`color + '1A'` bg) stay readable for any hue; picker links admins to /settings/labels when empty.
- ContactList: label-filter chip row ("All" + per-label) + Labels column (≤3 chips, "+N" overflow).
- ContactNew: tags input replaced by the label picker (sends `label_ids`).
- ContactDetail: Labels block with inline edit (picker + Save/Cancel → PATCH); "Legacy tags"
  field only shown when old tag data exists.

Verified: backend `compileall` clean; frontend `tsc --noEmit` + `vite build` clean.
**Sandbox verification (Diederik):** create labels in Settings → Labels; assign on a new
contact; filter the list with the chips; edit labels from a contact's detail page; delete a
label → it disappears from contacts.

---

### Session 30 — 2026-06-11 (superadmins icon buttons + platform modules panel)

**Superadmins page — icon buttons (commit `2e395ce`):**
- Replaced text-only "Deactivate"/"Activate" pill buttons with `ToggleRight`/`ToggleLeft` icon buttons — same icons and style as the Clients page (`SuperAdminPage`).
- Delete button is now icon-only (`Trash2`, size 13) with a tooltip — matches the Clients page pattern.
- Added `ToggleLeft`, `ToggleRight`, `Trash2` imports to `SuperadminsSettingsPage.tsx`.

**Platform Modules panel (commit `5dfecbd`):**
- New `PATCH /admin/modules` backend endpoint — takes `{module, enabled}` and bulk-updates ALL tenants' `enabled_modules` (adds or removes the module for every tenant in the DB). No migration needed.
- New `GlobalModulesPanel` React component in `SuperadminsSettingsPage.tsx`: lists all 7 modules in canonical order (Inbox → Contacts → Tickets → Activity → Billing → Chat → AI) with `ToggleRight` (green, all clients enabled) / `ToggleLeft` (grey, not all enabled) icons. Clicking sends `PATCH /admin/modules` and refreshes.
- Layout changed from single-column `max-w-2xl` to side-by-side flex: superadmins section on the left (flex-1), modules panel (w-56) on the right.
- Schemas: `BulkModuleRequest(module, enabled)` added to `admin/schemas.py`.

**Design rules locked this session:**
- All modal dialogs must use a consistent size — no exceptions per modal.
- Never paginate lists unless explicitly specified.

**Items collected for next build session** — see "New items collected" block in ▶ Next session above.

---

### Session 29 — 2026-06-11 (Tier 3: client row cleanup + bulk delete)

Started with 20% context usage; focused on verified-open Tier 3 items only.

**Code-audited as already fixed (no code change):**
- Compose modal button shift — `min-w-[116px]` + `shrink-0` layout is stable; shipped PR #20.
- Email sent popup after compose — `result` state only set for `data.demo`; normal sends use undo queue. Shipped PR #20.
- TicketList clickable rows — already wraps each card in `<Link>` for full-row click.

**Client page row cleanup (commit `61f1995`):**
- Moved "Go live" button from the inline row into `EditClientModal` Actions tab (visible when `tenant.is_demo`). Row now max 3 buttons: **View as / Set demo / Edit**.
- Added `onGoLive` + `goingLive` props to `EditClientModal`; Go live calls `goLiveMutation.mutate` and closes the modal.

**[6c] Bulk delete clients (commit `61f1995`):**
- New `BulkDeleteClientsModal`: lists selected client names, password confirmation, calls `POST /admin/tenants/{id}/delete` for each — same gate as single-delete.
- Delete button added to bulk action bar — visible to root owner only.

**Deployed:** `git push origin devsandbox && git push origin devsandbox:sandbox` — no migration, pure frontend.

---

### Session 28b — 2026-06-11 (attachments fixed end-to-end — parallel with session 28)

Diederik reported attachments still broken after session 27. Traced the full pipeline against
Resend's actual API docs and found four real bugs; all fixed this session.

**Root cause #1 — inbound downloads were always empty.** Session 27 assumed
`GET /emails/receiving/{id}` returns attachment `content` inline — it doesn't (metadata only).
Bytes live behind the separate documented endpoint
`GET /emails/receiving/{email_id}/attachments`, which returns a pre-signed, expiring
`download_url` per attachment (no auth header needed). The poller was storing
`a.get("content", "")` → `""` for every attachment, so every download served a zero-byte file.

- New `inbox/attachments.py`: `fetch_attachment_list()` (the attachments endpoint) +
  `fetch_attachment_bytes()` (pre-signed URL download), shared by poller and router.
- `email_poller.py _fetch_email_data`: when the email has attachments, fetch the list, download
  each file's bytes, store base64 inline in `attachments_json` (same shape as before — survives
  Resend URL expiry/retention). Files over 10 MB store metadata only; any fetch failure degrades
  to metadata-only and never blocks ingestion.
- `router.py download_attachment`: when stored `content` is empty (legacy rows ingested before
  this fix, or over-cap files), live-fetch via `msg.resend_email_id` → fresh `download_url` →
  stream back; clear 404 "Attachment no longer available" if Resend no longer has it. Old drafts
  become downloadable without any backfill.

**Root cause #2 — outbound uploads over ~1 MB were 413'd by nginx.** `frontend/nginx.conf` had
no `client_max_body_size` (default 1 MB), so the backend's documented 10 MB/file / 25 MB/total
caps were unreachable. Added `client_max_body_size 30m;` to the `/api` location.

**Bug #3 — forward dropped the customer's original attachments.** `forward_draft` now passes
the stored attachments to `send_email` (live-fetching any without stored content); a file that
can't be recovered degrades to forwarding without it rather than blocking the forward.

**Bug #4 — silent failure UX.** New shared `frontend/src/modules/inbox/attachmentLimits.ts`
mirrors the backend caps; reply + compose file pickers now reject >10 MB files / >25 MB totals
with a visible message instead of an opaque 413 at send time. The download button detects
zero-byte responses ("{file} is no longer available.") instead of silently saving an empty file.

Verified: `py_compile` clean, `tsc --noEmit` clean, `vite build` clean. No migration.
**Sandbox verification (Diederik):** mail an attachment to `sb-support@` → download it from the
draft; download from an *older* draft (fallback path); reply with a 2–5 MB file; try a >10 MB
file (friendly rejection); forward a draft with attachments to a department.

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
- Also: `.gitignore` now excludes the ad-hoc `apps/app/frontend/pnpm-lock.yaml` (frontend isn't a
  pnpm workspace package; the lockfile is generated only for local `tsc`/`vite build`).

**Audited, no code defect found (need sandbox repro):** Activity page (`/activity` +
`/activity/stats` + route registration all correct — likely just an empty event log) and the
"Settings page broken" report (all `/settings/*` routes registered, pages build clean).

**Deployed:** merged to `devsandbox` via **PR #21** (merge `8ad082e`). Direct `git push` to
`devsandbox`/`sandbox` is blocked in the web session (git proxy returns 403 for non-session
branches), so promotion goes through PRs. **`sandbox` promotion still pending** — needs a
`devsandbox → sandbox` PR merge to deploy to the staging URLs.

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
