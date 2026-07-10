# Yippie — Roadmap
**Repo:** github.com/DBrinkman1710/obsidian-vault · **Branch:** `sandbox`

**Latest:** [UX-CONSIST] UI/UX consistency audit + mechanical sweep + drift barriers, [UXP2] kanban nudge admin toggle, kanban shift scroll fix, inbox templates under compose ✅ (2026-07-10, migration `uxp2_pipeline_nudge_toggle`) — **Audit** (Explore agent, 66 files/16 modules): 6% semantic colour adoption (794 raw palette usages), 18% input primitive adoption, CloseButton in 2/66 files, 3 competing date locales, STATUS_LABELS defined 3×; full category table in the session transcript. **Mechanical sweep** (~45 files): new `lib/format.ts` (fmtDate/fmtDateTime/timeAgo/fmtMoney, en-GB everywhere) + `lib/statusStyles.ts` (STATUS/PRIORITY maps on `--status-*` vars + shared Badge) replacing per module duplicates; `.input-base` adoption via inputCls constants (7→3 remaining); CloseButton adopted across modal headers; dingbats → lucide; DraftReview overlay bg-black/50 → /40; FlowsPage webhook copies through useCopy. **Drift barriers:** `apps/app/frontend/scripts/ui_drift_check.mjs` — 4 hard bans (blue-500 focus rings, text-3xl+ in dashboards, raw navigator.clipboard, bg-black/50) + 8 RATCHET rules (raw semantic palette 794, window.confirm 40, Loading… text 40, dingbats, ad hoc inputs/headings, unlocalised dates 74, duplicated status maps) whose baseline (`ui_drift_baseline.json`) may only go down; `pnpm run check:ui`; versioned pre commit hook `scripts/githooks/pre-commit` (activate per clone: `git config core.hooksPath yippie/scripts/githooks`) also guards single alembic head; design contract `apps/app/frontend/DESIGN.md` + mandate in apps/app/CLAUDE.md. **[UXP2] kanban notification toggle:** `tenants.pipeline_nudge_enabled` (migration, default true), surfaced in /tenant/config, admin `GET/PATCH /team/workspace-prefs`, Notifications card on Team settings (ModeToggle idiom), Sidebar dot + board query gated. **Kanban shift scroll fix:** July 2 handler scrolled by deltaY but macOS moves shift+wheel delta into deltaX and the [] dep effect attached while the spinner (not the board) was mounted — axis robust delta + effect re runs on isLoading; surfaced now because the UX PSYCH sidebar query keeps the board cache warm. **Also:** templates picker moved under the Compose button on Inbox; ~/.claude skills run.md/session.md rewritten (pointed at the forbidden ~/yippie clone + retired branches); apps/app/.env created for local docker. Verified: tsc clean, check:ui green. Open: colour mass migration rides the ratchet; marketing body size collapse; [WEB-PROOF] still blocked on real quotes. [WEB-COMPARE] + [WEB-NL] + [WEB-FEATURE-GROUPS] + [WEB-FOUNDER-COUNT] + [WEB-PRICE-DEFAULT] + [WEB-LOGO-CARRY] + [UX-PSYCH] web batch ✅ (2026-07-10, commit `fb76c7c`, migration `a3f8c2e91b4d`) — **[WEB-COMPARE]:** /vs-freshdesk + /vs-front comparison pages (clone of /vs-zendesk structure; Freshdesk ~€15/agent vs Yippie €19 flat; Front ~€19/user vs Yippie flat; both in sitemap.ts + llms.txt). **[WEB-NL]:** /nl Dutch homepage + /nl/pricing static pricing page; professional B2B Dutch copy ("je" register); NL SEO keywords (klantenservice software, gedeelde inbox, MKB); hreflang alternates in layout.tsx root metadata + per page metadata; /nl + /nl/pricing in sitemap.ts. **[WEB-FEATURE-GROUPS]:** 15 homepage feature rows reorganised into 3 groups with category labels — Support (Smart Inbox, Tickets, Contacts, Live Chat, Templates), Sales & Growth (Pipeline, Marketing, Sales, SaaS Analytics), Operations (Calendar, Departments, Billing, Activity, Team, Tracking); `.featureGroupLabel` CSS token added to page.module.css. **[WEB-FOUNDER-COUNT]:** founder banner "first 5 spots" → "{FOUNDER_SPOTS_LEFT} of {FOUNDER_SPOTS_TOTAL} spots left"; driven by `NEXT_PUBLIC_FOUNDER_SPOTS_LEFT` env var (default 5) — update in Railway to move the number without a redeploy. **[WEB-PRICE-DEFAULT]:** pricing questionnaire `teamSize` state initialised to `"4–10"` so the recommendation panel renders immediately on page load. **[WEB-LOGO-CARRY]:** migration `a3f8c2e91b4d` extends `tenants.logo_url` String(500) → Text to accept base64 data URLs; `Questionnaire` Pydantic model gains `branding_color` + `branding_logo` (max 500KB) fields; signup handler applies both to `signup_tenant.primary_color`/`logo_url` after `create_tenant` (before `set_tenant_context` switch, while still on RLS-bypassing role); `SignupForm.tsx` reads `yippie_custom_plan` localStorage (where CustomForm saves colour + logo) and merges into the signup questionnaire payload. **[UX-PSYCH]:** committed separately (c3595aa) — was edited 2026-07-09 but not staged. [FLOW-CANVAS-DD] Drag-and-drop canvas ✅ (2026-07-10, no DDL) — `ReactFlowProvider` wrapper; `useNodesState`/`useEdgesState` replace the `useMemo` for nodes/edges; node palette left sidebar (160 px) with all action chips + Wait + Branch draggable chips; `onDrop`/`onDragOver` appends dropped step at canvas position; positions saved to `localStorage` per flow ID (key `yippie_canvas_pos_{id}`), loaded on open, overlaid on auto-layout via `buildGraph(positions)`; ↻ re-layout button clears localStorage + resets to pure auto-layout; `nodesConnectable={true}` + `onConnect` moves target step after source in the tree (branch handle aware); trigger/group/action/branch nodes all draggable (removed `draggable: false` from `layout.ts`), ghost nodes stay non-draggable; modal builder unaffected; no backend change, tsc clean, single alembic head unchanged. [YIP-FLOW] Yip builds flows from chat ✅ (2026-07-10, no DDL) — `create_flow` propose/confirm write tool in `jarvis/agent.py`; admin gated; creates disabled with "Open flow" CTA; trigger/action schema generated dynamically per tenant from TRIGGER_META + ACTION_META in `_tools_for_tenant`; `list_flows` + `explain_flow_run` read tools; `explain_flow_run` narrates FlowRun.results in plain language (branch match, action success/skip/fail/attempts, wait pauses). [FLOW10] Ultra review fixes ✅ (2026-07-10, migration flows10_sla_stepwise_restore) — stepwise post breach SLA escalation restored for existing tenants (FLOW8's one shot pre breach urgent flow kept as opt in recipe escalate_before_sla_breach); moved_by_human guard restored on flow driven stage moves (StageMoveSkipped → action skip); inbound webhook payloads can no longer forge chain_depth/chain_path (stripped unless source="flow"); trigger_config now validated for ALL trigger types (BaseTriggerConfigSpec forbids stray keys); ticket/shipment flow trigger option lists derive from their enums; [FLOW-ENGINE-BATCH] backlog item added. [WEB-MINI] + [WEB-SEO1] + [WEB-GEO1] Commercial site: mini Yippie onboarding + SEO/GEO batch ✅ (2026-07-09, apps/web + one backend schema field, no migration) — from the ux-habits.md + SEO/GEO audit. **[WEB-MINI]:** live miniature workspace preview (`components/MiniYippie.tsx`) beside the /custom configurator — visitor picks a sidebar colour (8 swatches, Yippie blue default) + uploads a logo (client side object URL), modules slide in/out of the mini sidebar as they're toggled, company name appears in the mini header at step 3 (endowment/IKEA + loss aversion + the modular pricing model explains itself); step 2 CTA "Get my quote" → "Continue"; `branding_color` carried in the questionnaire payload (added to backend `CustomPlanQuestionnaire` + contact custom_fields + ticket description — Pydantic would have silently dropped it, session 47 pattern); emoji icons in the /custom module picker + homepage 🔒 replaced with the line icon set (new LockIcon). **[WEB-SEO1]:** FAQPage JSON-LD on /pricing (faqs extracted to `pricing/faqs.ts`, single source with the accordion); BreadcrumbList JSON-LD on all 5 blog posts (`blog/jsonld.ts`); real publish dates for blog posts in sitemap.ts; priceSpecification + areaServed NL/EU + inLanguage in structured-data.ts; stale pricing metadata prices corrected (€19/€39/€69). **[WEB-GEO1]:** `public/llms.txt` (plans/modules/pricing/differentiators for AI answer engines, mirrors modules.json prices); robots.txt explicit allow blocks for GPTBot/OAI-SearchBot/ChatGPT-User/ClaudeBot/Claude-Web/anthropic-ai/PerplexityBot/Google-Extended; citation friendly direct answer paragraph on /vs-zendesk. New open items: [WEB-NL] (T2), [WEB-COMPARE]/[WEB-BLOG-NL]/[WEB-PROOF]/[WEB-LOGO-CARRY]/[WEB-FEATURE-GROUPS]/[WEB-FOUNDER-COUNT]/[WEB-PRICE-DEFAULT] (T3). [FLOW8] Built in automations — full inventarisation + /flows surface ✅ (2026-07-09, migration `flows8_builtin_migration`, commits `0d67d07` FLOW6 / `c5d8de8` FLOW7 / `30d643a` FLOW8) — Flows initiative complete through phase 8. **[FLOW6] Flow chaining:** `chain_scope` ContextVar in `flow_events.py` stamps `chain_depth`/`chain_path` into every event emitted inside a flow action (zero service signature changes); `steps.py` gains `chain_of`/`next_chain`/`chain_allows` + `MAX_CHAIN_DEPTH=3`; engine SQL-filters `source="flow"` events to chainable flows only; `trigger_config {"chainable": true}` opt-in per flow (checkbox in modal builder + canvas inspector). **[FLOW7] Trigger registry:** `trigger_registry.py` assembles `TRIGGER_META` from 11 per-module `flow_triggers.py` files via filesystem scan (tickets first for picker default; avoids router import cycle); `TriggerType` Literal deleted — validated dynamically against registry; `fetch_fields` loaders replace engine's hardcoded `_fresh_entity_fields` (contacts/`contact_fields` shared loader imported by all other modules); `build_meta` includes `module` per trigger for grouped picker; 10 new triggers with emits: `conversation_started`/`conversation_solved` (chat service + router + whatsapp_service), `booking_created`/`booking_cancelled` (booking/service), `campaign_button_clicked` (tracking/router), `campaign_email_bounced` (emailtracking/webhooks), `contract_expiring` (contracts/scheduler, piggybacks `expiry_reminder_sent_at` — no DDL), `invoice_overdue` (sla_escalation), `order_received` (shipments/service), `saas_signup` (public/router); optgroup trigger picker (`groupTriggers` + `MODULE_LABELS` in flows/lib.ts). 101 tests pass. **[FLOW8] Built in automations:** `flows/builtins.py` catalogue (11 entries) served in `/flows/meta`; "Platform automations" read-only card grid on FlowsPage. `notify_user` gains `recipient="assigned agent"` (resolves from `event.fields.assigned_to`). **Retired 4 hardcoded jobs:** (1) Yip SLA nudge job removed from `jarvis/scheduler.py` → replaced by default enabled flow "Notify the assigned agent before SLA breach". (2) `escalate_overdue_tickets` removed from `sla_escalation.py` → replaced by default enabled flow "Escalate tickets before SLA breach" (once → urgent, before breach). (3) `CalendarSettings.post_booking_stage_id` column dropped; global fallback removed from `confirm_booking` → per-tenant backfill flow `booking_created → move_pipeline_stage`. (4) `Tenant.order_placed/shipped/delivered_stage_id` columns + `_resolve_order_stage` + stage settings endpoints removed → per-tenant backfill flows `order_received + status condition → move_pipeline_stage`. Migration backfills replacement flows then drops 4 columns. `seed.py` + `admin/service.py` install 2 universal SLA default flows idempotently. Campaign button hardcoded label/stage actions (items 4+5) kept permanently — the click handler in `tracking/router.py` applies label/stage directly and will stay that way; `campaign_button_clicked` flow event also emits so flows can react in addition. [TRIAL30] 30 day free trial on signup ✅ (2026-07-08, migration `trial30_trial_fields`, commit `48b9e82`) — every self serve signup now starts a 30 day free trial with no payment collected; full product immediately. Backend: migration adds `trial_ends_at` + two nudge dedup columns; signup stamps the trial BEFORE `set_tenant_context` (tenants RLS would block UPDATE from root context) and commits the full transaction (fixed latent bug where root tenant contact/Live stage work was silently rolled back); hourly `trial_nudge_check` emails at 7 days left (reciprocity: what they've built so far with real contact+ticket counts) and 2 days left (loss aversion: "your workspace is paused if you don't upgrade"); hourly `trial_expiry_check` deactivates unconverted tenants + emails prospect; Stripe conversion path wires in automatically via existing `checkout.session.completed` / `invoice.paid` / subscription-sync webhooks (code ready, Stripe webhook endpoint not yet configured in dashboard — manual fallback: superadmin sets `go_live_at` which clears the trial). Frontend: `TrialBanner` in App.tsx (brand blue, flips to amber loss aversion in final 5 days naming "your contacts and tickets stay when you upgrade"); trial chip on SubscriptionPage. Marketing: getyippie.com hero → "Start your free 30 day trial"; pricing page cards + quiz CTA → /signup; pricing FAQ corrected (previously stated "We don't offer a free trial"). [FLOW5] Webhook triggers & actions ✅ (2026-07-08, migration `flows5_webhooks`) — flows can now be triggered by and fire external webhooks. **Inbound `webhook` trigger:** each webhook flow mints a URL-safe `flows.webhook_token` (partial-unique indexed column, minted on save + regenerable) exposed at the public `POST /api/v1/flows/hook/{token}` handler (mounted no-auth in main.py, `webhook_router`); the handler is rate-limited PER TOKEN (120/60s via `rl_is_blocked`/`rl_hit` — the amendment's backstop for a future [FLOW6] webhook→external→inbound loop that the chain_depth guard can't see), 64KB size-capped (413), resolves the flow RLS-bypassed by token, flattens the JSON body's top-level scalar/flat-list keys into event fields (`webhooks.flatten_payload`, nested/non-scalar dropped), and emits one `webhook` outbox event carrying `flow_id` so the engine (`_process_event` now targets the addressed flow for `webhook` like `schedule`) fires only that flow; returns are terse (202/404/413/400/429). **Outbound `send_webhook` action:** new `app/modules/flows/webhooks.py` POSTs `{event, flow}` JSON to a tenant-configured URL, signed `X-Yippie-Signature: sha256=<hmac>` with the per-tenant `tenants.flow_webhook_secret` (minted lazily, rotatable). **SSRF guard (amendment #1 — pin the resolved IP):** `validate_target` rejects non-http/https, resolves the host ONCE via `getaddrinfo`, blocks if ANY resolved IP is private/loopback/link-local (incl. 169.254.169.254 metadata)/reserved/multicast, then a `_PinnedTransport` connects to that exact validated IP while presenting the real host for the Host header + TLS SNI (`sni_hostname` extension) — so a second DNS lookup can't rebind to a private address (TOCTOU); `follow_redirects=False`, 5s timeout. Permanent failures (bad/blocked URL) record a hard failure without retrying; transient ones (receiver down / non-2xx) raise into the [FLOW2A] retry ladder. **Builder (amendment #3):** the webhook trigger is `free_fields` (payload keys unknown at build time), so the If section renders a free-text field-name input (both the modal and the [FLOW3] canvas inspector `FieldInputs`); the When section shows a `WebhookPanel` with the copyable inbound URL + signing secret and regenerate buttons (`GET`/`POST /flows/{id}/webhook`, `POST /flows/{id}/webhook/rotate`, `POST /flows/webhook_secret/rotate`). Also folded in: `saas_health_dropped` was finally added to the `TriggerType` literal (it was in `TRIGGER_META` since [FLOW2D] but not creatable via the API). **Migration note:** commit `d3a1f25` (tenant cascade) had committed an empty merge `85f2fad0a594` whose down_revision already named `flows5_webhooks` — a deploy-breaking dangling reference; this migration is exactly that missing revision (chains from `req1_booking_requests`, parallel to `tenant_cascade_all`), so the merge now resolves to a single head. pytest 78 flows tests green (11 new: payload flatten, HMAC signing, `_is_blocked_ip`, `validate_target` scheme/private/public, webhook trigger + send_webhook registration, webhook FlowCreate, webhook dry-run), tsc clean (flows files), single alembic head. [FLOW6] chaining still open. [FLOW-CANVAS-NEW] ✅ (2026-07-08, no DDL) — "New on canvas" outline button beside the existing "New flow" button on FlowsPage; creates a minimal disabled flow (`name:"Untitled flow"`, first meta trigger, empty actions — schema already permits this via the same path as recipe installs) then navigates straight to `/flows/:id`; button disabled until meta is loaded. No backend change. [FLOW4] Branching paths (if/else inside a flow) ✅ (2026-07-08, no DDL) — `actions` generalizes from a list to a small DAG `{"nodes","edges"}` with `branch` nodes holding OR-of-AND condition groups; a legacy linear list is one chain via the new pure `app/modules/flows/graph.py` (`as_graph` — the [FLOW2B] no-migration trick), so nothing stored is rewritten and linear flows keep the plain list shape. **Validation:** `GraphSpec` validates structure on write — single root, acyclic (Kahn), ≤ 25 nodes, unique ids, branch edge discipline (≤ 1 match + ≤ 1 else, ≥ 1 total; non-branch nodes one unlabelled edge); wait rules are graph aware (amendment done): no path may end on a wait and waits sum along the LONGEST path. **Engine:** `_execute_flow` walks the graph; pending steps persist `{"graph": snapshot, "next": node id}` in the existing JSONB column (an edit mid-wait never reroutes an in-flight run; pre-FLOW4 pending rows carrying remaining-action lists still resume via the chain normalizer). **Fresh-state amendment done:** branch nodes evaluate against CURRENT entity fields (ticket status/priority/assigned_to/subject; contact email/name/tags + pipeline stage) merged over the frozen snapshot — "ticket created → wait 2 days → if *still* open → escalate" works; None values are dropped so cleared fields fall back to the snapshot. Branch outcomes are stamped into `flow_runs.results` (`{type: branch, matched}`) so replay shows which edge a run took. **Frontend:** the canvas edits a step TREE (branch legs inline) that serializes to the graph — or back to the plain list while branch-free, so the modal builder stays usable until a branch is added; violet branch card with match/else source handles + yes/no edge labels, ghost "flow ends here" markers on empty legs, recursive pure layout (still no dagre — subtree widths computed bottom-up), branch inspector edits condition groups + both legs; replay dims the untaken leg; the modal shows an "open canvas" notice for branched flows and edit/duplicate route straight to the canvas. Test fire walks the sample event's path through branches. `tests/test_flows.py` extended (normalizer, structural validation incl. rooted cycles, longest-path wait math, GraphSpec via FlowCreate, graph preview). No migration — single alembic head unchanged. [FLOW3] Visual flow canvas ✅ (2026-07-08, no DDL) — node view per flow at `/flows/:id` (`@xyflow/react` 12), modal builder kept for quick edits. New `modules/flows/canvas/` (FlowCanvasPage + nodes + layout + replay) plus shared `modules/flows/lib.ts` and `components/FieldInputs.tsx` (builder inputs extracted so both surfaces write identical flows JSON). Nodes: trigger card (shows schedule config), one card per OR condition group side by side (edges labelled if/or, conditions joined with and), action + wait cards in a vertical chain — deterministic pure layout function instead of dagre (flows are linear this phase; a real layout engine earns its keep at [FLOW4]). **Edit parity:** inspector panel (trigger config, condition rows, action config, add/remove/reorder via move up/down) PATCHes the exact same JSON as the modal. **Run replay:** runs panel on the canvas + Workflow icon link per list row; picking a run badges each action node ok/skipped/failed/retrying with `(attempt N)`, dims unreached steps, and re evaluates OR groups client side against the run's frozen event fields to show which group matched. **Amendment done:** `ActionSpec` gains a stable `id` (server minted uuid hex, client ids round trip, pattern validated) and `_execute_flow` stamps `action_id` into every results entry (success, wait, pending retry, failed after retries) so replay survives reorders and [FLOW4]'s DAG keeps working against history; legacy actions fall back to list position. pytest 56 flows tests green (5 new), tsc clean, one alembic head (no migration). Stretch (tenant wide connections overview) not built — still open in the [FLOW3] spec. [FLOW-POLISH] Flows QoL batch ✅ (2026-07-08, no DDL) — four operator quality-of-life additions plus a safety sweeper, all migration free. **Test fire (dry run):** new pure `app/modules/flows/preview.py` synthesizes a sample event for a flow's trigger (trigger-field defaults overlaid with values derived from the flow's own conditions so the happy path is exercised — `equals/contains/gte/lte` take the literal value, `in` its first item, `not_equals` a `not::` marker), evaluates the real conditions honestly against it, and describes which actions would run WITHOUT touching the engine (an action whose module is disabled reads as skipped, exactly as the live engine skips it); `POST /flows/{id}/test` (admin) returns `{sample_event, matched, actions[]}`, surfaced in a `TestFireModal` behind a flask icon on each row. **Duplicate:** `POST /flows/{id}/duplicate` clones wiring into a disabled `"… (copy)"` (counters reset, no validation — operator reviews then enables); copy button opens the builder on it. **Run stats on the list row:** `service._attach_run_stats` grabs success/fail tallies from `flow_runs` in one grouped query (`partial` counts as fail for an at-a-glance health signal; waiting/skipped counted as neither), attached as transient `success_count`/`fail_count` on `FlowOut`, rendered as `N ✓ · N ✗`. **Runs drawer status filter:** `GET /flows/{id}/runs?status=` + filter chips (all/success/partial/failed/waiting/skipped). **Stale `waiting` sweeper:** hourly `flow_waiting_sweeper` engine job marks any `waiting` run older than `MAX_WAIT` + 1 day slack with NO matching `flow_pending_steps` row as `failed` (a crash between claim-first pending delete and resume otherwise leaves the run stuck `waiting` forever). pytest 51 flows tests green (7 new preview tests), tsc clean, one alembic head. [FLOW2D] saas_health_dropped ✅ (2026-07-08, no DDL, commit `cf65285`) — emit flow event in `compute_health_for_contact` when score drops: capture `old_score` before upsert, if `score < old_score` call `emit_flow_event` with payload `{score, previous_score, drop}` in the same flush (outbox guarantee). `TRIGGER_META["saas_health_dropped"]` registered with module `"saas"` + three number condition fields. No DB column needed — threshold crossing expressed in conditions. All 44 flows tests pass, tsc clean, one alembic head. Phase 2 complete. [FLOW2C] Flows time triggers ✅ (2026-07-08, no DDL — used 2A's columns) — two triggers that fire from the scheduler instead of a user mutation. `schedule`: per flow `trigger_config` (`{frequency:daily|weekly, time:HH:MM, weekday?}`) validated by a new `ScheduleConfigSpec` (time regex, weekly requires a weekday, daily drops it, non-schedule triggers coerce config to `{}`); a 1 min `flow_schedule_tick` job in the flows engine loads enabled schedule flows + the per tenant `CalendarSettings.timezone` map and, for each due flow (via the already-built `steps.schedule_is_due`), emits one `schedule` outbox event (payload carries `flow_id` — `_process_event` fires only the addressed flow) and stamps `last_scheduled_on=today` in the SAME transaction (outbox guarantee; a missed minute self heals the same local day, never fires twice). `ticket_sla_due_soon`: a 5 min `flow_sla_emit` job in `tickets/automation/sla_escalation.py` finds tickets whose SLA lands within a fixed 60 min window (open/in_progress, not deleted, `sla_flow_emitted_at IS NULL`), emits one event per ticket (payload subject/priority/status/`due_in_minutes`/assigned_to/sla_due_at) + sets the dedup marker in the same transaction; flows wanting a tighter cutoff add a `due_in_minutes lte N` condition. `TriggerType`/`TRIGGER_META` gain both; `service._normalize_trigger_config` is the single write-side source of truth (schedule validated when enabled, drafts may be empty). Builder When section renders frequency + weekday + `<input type=time>` for schedule flows and `handleSave` now sends `trigger_config`. pytest 44 flows tests green (8 new), tsc clean, one alembic head (no new migration). [FLOW2D] saas_health_dropped still open. [FLOW2B] Flows OR condition groups ✅ (2026-07-08, no DDL) — conditions become OR-of-AND groups `[[A,B],[C]]` = (A AND B) OR C; a legacy flat list is one group via `_as_groups`, so `evaluate_conditions` keeps its name/signature (engine call site untouched) and there's no data migration; evaluator is `any(all(...))`, empty → always match. Schemas accept flat or grouped and normalize to grouped on write (`_normalize_condition_groups`: depth exactly 2, ≤ 5 groups, 1–10 conditions per group, no empty groups, mixed flat/grouped rejected); service dumps nested. Builder: each group a bordered card (action card styling) with per card "Add condition", centered `OR` divider between cards, "Add OR group" button; `toGroups()` normalizer on modal load + in `flowSummary` count. pytest 36 flows tests green (9 new: OR semantics, flat compat, normalization + depth3/empty/>5/mixed rejection), tsc clean, one alembic head. [FLOW2A] Flows engine core: delay steps + retries ✅ (2026-07-08, migration `flows2_phase_two`) — the phase 2 foundation carrying ALL phase 2 DDL in one migration (so [FLOW2B–D] stay migration free): `flow_pending_steps` durable resume queue (kind wait|retry, remaining actions + frozen results, RLS) + `flows.trigger_config`/`last_scheduled_on` + `tickets.sla_flow_emitted_at`. New pure `app/modules/flows/steps.py` (wait_delta, total_wait_days, validate_wait_placement, derive_run_status moved from engine, retry_delay ladder 60s/300s, schedule_is_due) so tests stay DB free. `wait` pseudo action (ACTION_META module None, NOT an executor — the engine special cases it): pauses the run (status `waiting`), persists remaining actions to flow_pending_steps, resumes on the same 10s tick via claim first `DELETE … RETURNING`, re checking tenant/module/flow enabled before resuming; total wait ≤ 30 days, no trailing wait, actions cap 5→10. Retries: raised actions retry ×2 with 60s/300s backoff through the same table (frozen prior results never re run, `attempts` on every result, amber pending_retry row); after 3 attempts the failure is recorded and remaining actions still run (phase 1 semantics). Engine refactored into `_execute_flow`/`_upsert_run` (single counter bump)/`_persist_pending`/`_claim_pending`/`_resume_step`; `_record_run` absorbed. Frontend: wait editor (number + unit) in Then, blue `waiting` badge, `(attempt N)` suffix + amber pending retry rows in the runs drawer. pytest 27 flows tests green, tsc clean, one alembic head; [FLOW2B] OR groups + [FLOW2C] time triggers + [FLOW2D] saas_health_dropped still open (migration free, spec in Flows initiative). [FLOW1] Flows module phase 1 ✅ (2026-07-07, commit `339f625`) — free core module turning hardcoded cross module automations into tenant configurable When/If/Then rules: flow_events transactional outbox + emitters (ticket created/status changed, contact created, pipeline stage changed, draft approved), 10s claim first engine with per action tenant scoped sessions + flow_runs audit log, condition evaluator + TRIGGER_META, action registry (create/update ticket, move stage, notify user, send email) + ACTION_META, five recipes, admin gated CRUD + GET /flows/meta, /flows builder page, source="flow" loop protection, migration flows1_flow_tables, module enabled for all tenants; phases 2–6 planned + tiered same day ([FLOW2A–D], [FLOW3]–[FLOW6], [FLOW-POLISH] — see the Flows initiative section); [YIP4] + [YIP5] + [YIP-STREAM] Yip upgrade ✅ (2026-07-06) — six new read tools (inbox drafts, waiting chats, email engagement, ticket stats, revenue, today's bookings); server side threads (yip6_jarvis_threads migration, conversation survives closing the popup) + SSE streaming replies with tool status labels and JSON fallback; morning briefing thread + toast (per user time, tenant tz) and SLA near breach nudges (sla_nudged_at dedup); [EXT1-STORE] ✅ (2026-07-06) — Chrome Web Store submission completed (manual step; Google review pending); [EML1] ✅ + [CALL1] ✅ confirmed done 2026-07-06 (one-liners in ✅ Done; VoIP integration deliberately not on roadmap — only on client demand); [CONTRACT2+3] Contract lifecycle + e-signing ✅ (2026-07-06) — CONTRACT2: start/end dates, notice period, auto renew + term roll-forward, value (amount/interval/currency Stripe-shaped), MRR/ARR rollup endpoint, 6-hourly scheduler (auto-expire, auto-renew, notice/expiry UserReminder nudges via jarvis toast), Renewals tab with deadline chips + stat cards; CONTRACT3: per-tenant contract_templates with {{merge.field}} rendering (11 fields), frozen body generated from template, PDF via fpdf2 with signature block, public /sign/:token draw-to-sign e-signing page (booking-token pattern, audit trail: name/IP/timestamp), signing link generation in peek, Templates modal with field chip picker; migrations contract2 → contract3 (single head); commit `1ce8118`; [YIP3] Yip write actions + confirm chips ✅ (2026-07-05) — five proposal-only write tools (create_ticket, update_ticket assign/close/reprioritise, create_contact incl. company get-or-create + duplicate heads-up, create_calendar_event, move_pipeline_stage); every write goes through a confirmation turn: the tool loop stages `action_taken=confirm_action` with a resolved tenant-scoped payload, the popup renders a ConfirmActionCard (title + detail rows + Confirm/Cancel), and only Confirm posts to new `POST /jarvis/confirm` which re-applies the [YIP-GATE] module gate and re-validates tenant ownership server-side before writing — Cancel changes nothing; [YIP2] Yip drafts replies in tenant tone ✅ + [YIP-GATE] module-gated Yip tools ✅ (2026-07-05) — the flagship Yip feature: new `draft_reply` agent tool drafts ticket replies from the FULL thread (customer messages, team replies, internal notes marked never-quote) plus `render_context_block` customer history, honouring `ai_profile` (tone, sign_off, reply_language, business context, terminology); fresh-email path when only a contact is named (explicit contact wins over open-ticket context); popup opens ComposeModal prefilled (subject Re:/generated, body) — human reviews and sends, never auto-sent; new `get_ticket_thread` tool powers "brief me on this ticket" summaries + message translation; [YIP-GATE]: `TOOL_MODULES` map filters TOOL_DEFS per `tenant.enabled_modules` at loop start + executor-side refusal belt-and-braces; [CONTRACT1] Contracts module — phase 1 storage ✅ (2026-07-05) — new €9/mo `contracts` module (table + RLS, CRUD + inline-document up/download, list/add/edit UI, company+contact pickers); deployed to sandbox (commit `fb9a782`) and verified end-to-end via authed API (create→patch→PDF upload→byte-identical download→delete); enabled for all 31 sandbox tenants; à-la-carte add-on (not plan-gated); [CONTRACT2] lifecycle + [CONTRACT3] e-signing tracked in tiers; [CTX1] Customer data + AI briefing ✅ (2026-07-05) — architecture decision resolved: full contact history stays in the module-owned RLS Postgres tables; new canonical read-side aggregator `app/core/customer_context.py` (`build_customer_context` + `render_context_block`, section-gated by `enabled_modules`) now feeds ALL AI surfaces — inbox briefing, ticket briefing/suggest-reply/improve-reply (which previously passed empty history and read the nonexistent `contact.company` attr), and Yip's `get_contact_briefing`; history spans profile+labels, pipeline stage, tickets, billing, live chat, email engagement, SaaS health, active shipments, upcoming meetings, activity timeline; pgvector memory ([AI-MOD1] Phase 2) slots in behind the same function; [YIP-AGENT] ✅ (2026-07-04) — Yip rebuilt from intent routing into agentic tool loop (`jarvis/agent.py`, 13 tenant-filtered tools, `assistant_memories` table + save_memory, conversational ⌘K popup with history, CTA chips under replies, Anthropic prompt caching); open follow-ups tracked as [YIP2]–[YIP5] in the tiers; Untracked batch (2026-06-27→30, around/after sessions 89–91, reconciled from git 2026-07-04) — bidirectional iCal calendar sync (Apple/Outlook) + personal calendar invitations; Train Yip (per-tenant `ai_profile` + training modal in Settings); Yip compose_email/help/math actions; agent performance section on Activity; ERP order webhook → contact sync + kanban stage (tracking module); `/docs` page with live manual + HelpTip component + manual PDF in Profile; security hardening waves (OWASP P1, pentest phases 1–4: PyJWT, HttpOnly cookie auth, Redis rate limits, WhatsApp webhook HMAC); Ndugu Coffee pilot-readiness UX fixes; self-serve signup wired to /custom; Sales/SaaS page error+loading states; 91 — [EXT1] Chrome extension inbox analyser (gmail.metadata scope, local processing, settings panel, coming soon section on getyippie.com, store listing copy at apps/extension/store-listing.md); 90 — [CUSTOM1] /custom bespoke package configurator (3-step form, module picker, live pricing, lead capture); 89 — [JARVIS1] quick-capture assistant (⌘K popup, AI routing, reminders, contact/ticket notes, context query); 88 — [SALES-MOD1] + [SAAS-MOD1] ingest infra; 87A — LiteLLM proxy ([AI-MOD1 Phase 1]); 86 — [STRIPE1] SaaS billing; 85 — [BK8] + security audit [FIX-PLAN]; 84 — BK-HOURS-BUG/WEB-CENTER/PLAN-STARTER. See Appendix A for full history.

---

## 🧭 How this roadmap is organized

Open work is grouped into **three tiers** by size/complexity, and each tier is mapped to the
Claude model to build it with:

| Tier | Nature of work | Model |
|---|---|---|
| 🟣 **Tier 1** | Big, complicated & creative | `Fable` |
| 🔵 **Tier 2** | Medium | `Opus` |
| 🟢 **Tier 3** | Quick & easy fixes / wins | `Sonnet` |

*(Mapping updated 2026-07-08 — model labels on already shipped ✅ items are historical and were not rewritten.)*

Item numbers (`[11]`, `[38c]`, …) are kept so each item still maps to its history in the
**Session log** (Appendix A). Finished work is collapsed under **✅ Done**; full architecture /
environment / deploy reference lives in **Appendix B**.

---

## ⚠️ How to maintain this file — read before editing

When an item ships, update **two places** — missing either causes drift.

| Section | Role | What to do when an item ships |
|---|---|---|
| **Line 4 header** | Running session log | Prepend `[ITEM-ID] ✅ — one-line summary` at the start |
| **Tier sections + ✅ Done** | Authoritative open-work list | Remove the item from its tier, add a one-liner to **✅ Done** |

*(The go-live checklist is closed — the platform went live 2026-06-23. Don't add new items there.)*

**The Tier sections** now list only genuinely open/deferred work. When something ships, remove it from the tier and add a one-liner to **✅ Done**. The tier body is the authoritative source of truth — if it says "not built", Claude Code treats it as open.

**Before starting a session**, scan for items the user says are done and verify the code before marking them. `grep` for the key symbol/function/component name — if it exists, it's done.

**When in doubt about status**, the code is the truth. The roadmap is a summary, not a source of truth.

> **Note (2026-06-11):** the tiers were reconciled against the actual `apps/app` code. A batch of
> items previously listed as open turned out to be shipped (impersonation, bulk bin/spam, retention
> scheduler, `is_active`/`go_live_at` enforcement, per-tenant webhook routing, undo-send polish,
> attachment chips, response-template backend, …) and were moved to **✅ Done**. Only verified-open
> work remains in the tiers below.

---

## 🎯 Go-live scope — ✅ COMPLETE (live since 2026-06-23 at app.getyippie.com)

**Historical.** Every item in this checklist shipped; the platform is live in production. Kept for item-ID reference only — current open work lives in the Tier sections below.

**Prep (do first):**
- [x] [GOLIVE-CHECKLIST] Write `GOLIVE.md` ✅ session 60 — 9-section checklist at `/yippie/GOLIVE.md`; covers Railway env vars, DNS, Resend, first deploy, smoke tests, post-deploy ops

**Tier 3 / ops (quick):**
- [x] [LIVECHAT-QR] Fix WhatsApp QR code ✅ already working (session 59 webhook fix); QR moved behind icon button (session 61)
- [x] [LIVECHAT-EVOLUTION-LICENSE] Evolution API attribution notice ✅ session 61 — Apache 2.0 notice inside QR modal
- [x] [CO-CLICK] Companies clickable → contact list ✅ session 60
- [x] [36b-6] XLSX import fix ✅ session 60
- [x] [V4] Profile: narrow email/signature box ✅ session 60
- [x] [PRIV1] Railway private DB URL ✅ session 89 — switched to private networking URL
- [x] [Phase 13] Set invite-link base URL env vars ✅ session 89
- [x] Set `INBOUND_EMAIL` + `diederik@getyippie.com` in live Railway envs ✅ session 89

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

**Still open after launch (verified against code 2026-07-04):**
[Phase 11C T2] "Connect your inbox", Customer data + AI briefing, [AI-MOD1] phases 2–3 (Phase 1 LiteLLM ✅ session 87A), [AI-CTRL], [CLUSTER1], [LANG1] *(more UI languages beyond EN/NL — deferred, not urgent)*. Dropped: [WEB-CONS1] (2026-07-04, spec lost — re-add if it resurfaces).
Shipped from the old deferred list: ~~[CUSTOM1]~~ ✅ s90, ~~[SALES-MOD1]~~ ✅, ~~[SAAS-MOD1]~~ ✅, ~~[TRACK1]~~ ✅, ~~[EMBED1]~~ ✅, ~~[JARVIS1]~~ ✅ s89.

**Post-launch build order:**

| Priority | Item | Effort | Why |
|---|---|---|---|
| ~~1~~ | ~~[EMBED1] Lead capture embed widget~~ | ~~Low~~ | ✅ Shipped — `ecf4fb5` (lead-widget.js + Developer Tools tab + `/public/embed/{slug}` endpoint) |
| ~~2~~ | ~~[SALES-MOD1] Sales module~~ | ~~Medium~~ | ✅ Shipped — `4d98765` (sales events ingest, sales.js embed, settings modal, superadmin dashboard) |
| ~~3~~ | ~~[SAAS-MOD1] SaaS product analytics~~ | ~~Medium~~ | ✅ Shipped — `4d98765` (saas events, saas.js auto-embed, health summary, SaaS settings modal) |
| ~~4~~ | ~~[TRACK1] Track & trace~~ | ~~Medium~~ | ✅ Shipped — `92b3dd1` (Sendcloud integration, shipments module, track & trace settings modal) |
| 5 | [AI-MOD1] Cloud LLM | High | Biggest long-term moat — but only compounds with volume. At 5 tenants it's a cheaper Anthropic replacement. At 50+ tenants with real conversation history it becomes defensible. Build last, after data exists to train on. |
| 6 | [CLUSTER1] Issue cluster generator | Medium | Depends on [AI-MOD1]. Groups open tickets by theme to surface recurring problems — turns raw volume into actionable insight for agents and content teams. |
| ~~7~~ | ~~[JARVIS1] Quick-capture assistant~~ | ~~High~~ | ✅ Shipped — `ca9b2f8` (⌘K popup, AI routing, reminders WebSocket, contact/ticket notes, context query + inline edit, user prefs, right-click menus) |

**The differentiation:** No SMB competitor combines behavioral tracking ([SALES-MOD1]) with a learning, tenant-aware AI ([AI-MOD1]). Intercom has AI but it's stateless and expensive at scale. Zendesk has tracking but it's disconnected from the AI. The combination is the moat — build [SALES-MOD1] first so the data is already accumulating when [AI-MOD1] is ready to consume it.

**[AI-CTRL] Cloud LLM control panel** — `Sonnet` — *post-launch. Superuser only.* A dedicated page in the superadmin UI (`/superadmin/cloud-llm`) listing every Cloud LLM feature. Each tool has: an on/off toggle (globally or per-tenant), a description of what it does, and a "Test" button that runs the feature against a selected tenant with sample data and shows raw output. Accessible only to superusers (same guard as `SuperAdminPage`). Ships new features dark — toggle them on per-tenant as they're validated. Depends on [AI-MOD1].

**[AI-MOD1] Self-hosted AI module** — `Opus` — *post-launch. Trigger: >100K AI calls/month.* Replace the Mistral API with a self-hosted open-source LLM on Hetzner (Germany/Finland — EU data residency, GDPR-native). Unlike any external API, the self-hosted model accumulates context: fine-tuned over time on real tenant conversations, fed full customer + tenant memory without per-token cost pressure, and queryable against the existing RLS-isolated Postgres on Railway. Two context scopes: (1) tenant context — what the client's business does, their product, tone, config; (2) customer context — who this end-user is, full conversation history, behavioral data.

**Infrastructure target:**
- **Model:** `Qwen 2.5 7B` for classification/routing (best structured-output benchmarks at this size); `Qwen 2.5 72B` or `Llama 3.1 70B` for reply drafting once volume justifies it
- **Serving:** vLLM (793 TPS, multi-GPU, Prometheus metrics, OpenAI-compatible endpoint) — not Ollama (41 TPS, single-user queue, no multi-GPU)
- **Hardware:** Hetzner AX102 (RTX 4000 Ada 20GB, €184/mo) for 7B models; Hetzner GEX130 (RTX 6000 Ada 48GB, €838/mo) for 70B @ INT4
- **Proxy:** LiteLLM in front of vLLM — `ai_completion()` in the codebase stays unchanged; swap is one env var (`AI_PROVIDER=self-hosted`, `AI_BASE_URL=http://hetzner-ip:8000/v1`, `AI_MODEL=Qwen/Qwen2.5-7B-Instruct`)
- **Memory layer:** pgvector on existing Railway Postgres for embeddings/retrieval
- **Break-even vs Mistral API:** ~100K–500K calls/month depending on model size

**AI provider progression (all transparent via LiteLLM):**
1. **Now:** Mistral API (EU, €0.10/1M tokens at ministral-8b, zero infra)
2. **Scale:** Self-hosted vLLM on Hetzner (zero marginal cost, full data control)
3. **Moat:** Fine-tuned on tenant conversation history (more tenants → smarter model → better product)

Data collected from day one (conversation transcripts, routing outcomes, reply quality signals) must be in a clean, labeled format ready for fine-tuning. This is the core product moat: more tenants → more training data → smarter model → better product.

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

**Backend:** `POST /quick-capture {body, context_type, context_id}` → Mistral Small classifies intent, extracts entities, executes action, returns `{action_taken, summary, inline_data?}` where `inline_data` carries editable fields for the context-query path. Mistral API now (EU, GDPR-safe); swap to [AI-MOD1] self-hosted when volume justifies. Gated via `[AI-CTRL]`; counts against AI usage.

**The vision:** this is the Jarvis layer — one always-available input that understands where you are, who you're looking at, and what your business does. Phase 1: notes, reminders, customer context. Phase 2: natural-language queries ("how many open tickets does Acme have?"), task delegation ("create a follow-up ticket for Jan in 3 days"). Phase 3: multi-step workflows and proactive nudges. All from the same small popup.

**[EMBED1] Lead capture embed widget** — `Sonnet` — *post-launch. Optional per tenant.* Clients generate a snippet in their Yippie settings and paste it on their own website. When a visitor clicks the button, a small branded modal appears (name, email, optional message field). On submit: a Contact is created in the tenant's Yippie environment (or matched if the email already exists) and automatically placed into a pre-configured Kanban stage. Use cases: "Request a demo", "Get a quote", "Book a callback", "Join the waitlist" — the button label and target stage are both configurable per tenant. Implementation: `POST /public/embed/{tenant_slug}` (unauthenticated, rate-limited); snippet generator in Settings → Integrations that outputs a `<script>` tag + optional `<a>` button; snippet carries a signed `tenant_slug` + `stage_id`. No iframe required — lightweight JS that injects a modal. Same pattern as `POST /public/request-demo` (Phase 12) but white-labelled per tenant.

**[SALES-MOD1] Sales module — website tracking tag** — `Opus` — *post-launch. €20/month add-on.* A lightweight JS snippet (`<script>`) that clients embed in their frontend (commerce or SaaS). Fires events (page views, clicks, purchases, feature usage, checkout abandonment) to a dedicated ingest endpoint, stored in Postgres under the tenant's RLS partition. This behavioral data feeds directly into [AI-MOD1]'s customer context — the AI knows what a customer *did* before they asked a question ("browsed checkout 3× before contacting support"). The combination is the differentiator vs Intercom/Zendesk. Ingest: thin FastAPI endpoint or Cloudflare Worker for edge latency. Tag: CDN-hosted JS or npm package to minimize client dev friction. Must handle GDPR/CCPA consent signals from day one. Optional: basic behavioral dashboard (customer timelines, top drop-off pages before support tickets) to make the €20 feel like a standalone product.

**[SAAS-MOD1] SaaS product analytics module** — `Sonnet` — *post-launch. SaaS/software clients only. €20/month add-on.* A lightweight JS snippet that SaaS clients embed in their own product frontend. Fires structured events (feature usage, onboarding step completions, errors, session activity, upgrade-intent signals) to a Yippie ingest endpoint, stored per-tenant under RLS. The primary surface is the support agent's view — when a ticket comes in, the CustomerPanel shows exactly what that customer has and hasn't done in the product. Agents stop asking "have you tried X?" and start saying "I can see you haven't enabled X yet — let me walk you through it."

**What gets tracked (client-controlled event taxonomy):**
- `feature_used` — which feature, timestamp, duration
- `onboarding_step` — step name, completed/skipped/abandoned
- `error_encountered` — error code, feature context, count
- `session` — start/end, pages visited, depth
- `upgrade_intent` — visited pricing/billing page, opened upgrade modal
- `feature_abandoned` — started a multi-step flow, didn't finish (e.g. set up 3/5 steps of a wizard)

**Integration (same pattern as [SALES-MOD1]):**
```html
<script src="https://cdn.getyippie.com/saas.js" data-token="TENANT_TOKEN"></script>
```
```js
yippie.identify('user_id', { email: 'jan@acme.nl', name: 'Jan', plan: 'starter' });
yippie.track('feature_used', { feature: 'csv_export' });
yippie.track('onboarding_step', { step: 'connect_inbox', status: 'completed' });
yippie.track('error_encountered', { code: 'QUOTA_EXCEEDED', feature: 'ai_scan' });
```
Anonymous events are tracked until `identify()` links them to a Yippie contact by email. CDN-hosted, <5 KB gzipped, no dependencies.

**Health score** — computed hourly per contact, stored as a single integer (0–100) on a denormalized `saas_health` row for fast reads. Composite of: recency (days since last active, weighted 40%), feature breadth (distinct features used ÷ total features, weighted 40%), error penalty (recent error count, weighted -20%). Color-coded: green ≥70, amber 40–69, red <40.

**Where it surfaces inside Yippie:**

1. **CustomerPanel on TicketDetail** — "Product usage" card (collapsed by default, expandable): health score badge, last active timestamp, onboarding completion bar (e.g. "4 / 6 steps"), top 3 features used this month, recent errors (if any), and a warning chip for features the customer hasn't touched in 30+ days. Agents see this before writing a single word.

2. **ContactDetail** — full event timeline tab ("Product activity") showing every tracked event in chronological order, filterable by type.

3. **Pipeline (Kanban)** — health score badge on contact/deal cards: green/amber/red dot. Lets CSMs spot at-risk accounts at a glance without opening each record.

4. **Activity page** — tenant-level health dashboard: % of all contacts who completed onboarding, top features by adoption rate, most common errors across all customers this week. Useful for the SaaS client's own product decisions, not just support.

5. **AI context (when [AI-MOD1] ships)** — the AI reads health + event history automatically when scanning a ticket or chat. "Customer hasn't used the API feature despite being on Pro plan and asking about it 3 tickets ago" becomes part of the AI's reply suggestion context.

**Backend:**
- `saas_events` table: `id, tenant_id, contact_id (nullable), anonymous_id, event_type, properties JSONB, session_id, sdk_version, created_at` — RLS-isolated, append-only, indexed on `(tenant_id, contact_id, event_type, created_at)`.
- `saas_identity` table: `tenant_id, anonymous_id, contact_id, identified_at` — maps anonymous sessions to Yippie contacts once `identify()` fires.
- `saas_health` table: `tenant_id, contact_id, score INT, recency_score, breadth_score, error_penalty, last_computed_at` — one row per contact, updated by the hourly APScheduler job.
- `POST /public/saas/track` — unauthenticated ingest, validates tenant token, rate-limited per IP + tenant token, writes to `saas_events`. Accepts batched event arrays to reduce round-trips.
- `GET /saas/contacts/{id}/events` — paginated event timeline for ContactDetail.
- `GET /saas/health/summary` — tenant-wide aggregates for the Activity dashboard.
- APScheduler: hourly `compute_saas_health()` job (recomputes scores for contacts with new events); weekly `saas_health_digest()` job emails tenant admins a list of contacts with score < 40 ("at-risk this week").
- New module key: `"saas"` in `ALL_MODULES` + `MODULE_PRICES` (€20/mo).

**Frontend:**
- `SaasUsageCard.tsx` — collapsible card for CustomerPanel; skeleton loader while fetching; "No product data yet" empty state if tenant hasn't installed the snippet.
- `SaasActivityTab.tsx` — event timeline in ContactDetail, same visual style as the ticket timeline.
- `SaasHealthBadge.tsx` — reusable dot + score chip, used on Kanban cards and the contact list.
- Settings → Integrations: snippet generator card showing the `<script>` tag with the tenant's token, a copy button, and a live "last event received" indicator so clients can verify installation.

**Why this is different from [SALES-MOD1]:** SALES-MOD1 is aimed at commerce/retail clients (page views, purchases, cart abandonment — behavioral signals around a buying funnel). SAAS-MOD1 is aimed at software companies whose customers *use* their product — the signal is adoption depth and onboarding friction, not purchase intent. The event taxonomy, health score model, and surfaces are all designed for SaaS CSM workflows. Both modules share the same ingest infrastructure (`/public/saas/track` can serve both with an `event_domain: "saas" | "commerce"` field) — build SALES-MOD1 first, then extend it.

**The insight for support agents:** Every ticket from a SaaS customer now arrives with a silent briefing — what they've done, what they've skipped, where they got stuck. The agent doesn't need to ask "what plan are you on?" or "have you connected your inbox?" — they already know. That's the headcount-reduction pitch applied to SaaS support specifically.

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

## ▶▶ Performance initiative — ✅ COMPLETE

All four steps shipped (sessions 19–24): composite indexes + nginx gzip/cache; async ingest; loading skeletons + vendor chunking; `pg_trgm` indexes + lazy compose + pool tuning.

---

## ⚡ Flows initiative — [FLOW1] ✅ shipped, phases 2–9 planned (phases 7–9 added 2026-07-08)

**Phase 1 (shipped, commit `339f625` / merge `12ec1ca`)** turned the recurring hardcoded cross module automations into tenant configurable When/If/Then rules: `flow_events` transactional outbox (`app/core/flow_events.py`, written in the same transaction as the mutation) with emitters in tickets/contacts/pipeline/inbox services; 10s claim first engine (`app/modules/flows/engine.py`) with per action tenant scoped sessions and a `flow_runs` audit log; condition evaluator + `TRIGGER_META` (`conditions.py`); action registry + `ACTION_META` (`actions.py`); five recipes; admin gated CRUD + `GET /flows/meta`; `/flows` builder page. Loop protection: `source="flow"` events are never evaluated.

**Phase 2 is fully designed and user approved** — detailed plan at `~/.claude-account2/plans/build-phase-2-of-sequential-pelican.md` (read it at session start; the spec below is the summary). Split into four sessions, [FLOW2A] first.

### Phase 2 sessions

**[FLOW2A] Engine core: delay steps + retries** — `Opus` — ✅ **shipped 2026-07-08** (migration `flows2_phase_two`). Its single migration carried ALL phase 2 DDL so [FLOW2B–D] are migration free (no parallel head races). Full summary in the Latest line + ✅ Done.
- Migration: `flow_pending_steps` table (tenant_id, flow_id, run_id FK→flow_runs, kind `wait|retry`, event JSONB, remaining `actions` JSONB, `results` JSONB, attempt INT, resume_at, full RLS block copied from flows1) + `flows.trigger_config JSONB NOT NULL DEFAULT '{}'` + `flows.last_scheduled_on VARCHAR(10)` + `tickets.sla_flow_emitted_at TIMESTAMPTZ`.
- `wait` pseudo action `{"type":"wait","config":{"minutes"|"hours"|"days": n}}` — registered in `ACTION_META` (module None) but **not** `ACTION_EXECUTORS`; the engine special cases it: append a wait result, upsert the run as `"waiting"`, persist the remaining actions to `flow_pending_steps`, return. Resume folded into the 10s `flow_engine_tick` (claim via `DELETE … RETURNING`, re check tenant/module/flow exists **and enabled** before resuming). Total wait per flow ≤ 30 days; a flow may not end with a wait; `actions` max_length 5 → 10.
- Retries: raised (never skipped) actions retry ×2 with 60s/300s backoff through the same pending steps table (`kind="retry"`, remaining = failed action onward, frozen prior results never re run); every result dict gains `"attempts": n`. Run row lifecycle: unchanged insert at end for never pausing runs; created early as `"waiting"` only when a pending step needs the FK; resume UPDATEs it terminal; `run_count`/`last_run_at` bump once.
- New pure `app/modules/flows/steps.py` (`wait_delta`, `total_wait_days`, `validate_wait_placement`, `derive_run_status` moved from engine, `retry_delay`, `schedule_is_due`) so tests stay DB free. Frontend: wait rows in Then ("Wait for" number + unit select writing exactly one config key), `waiting` badge + `(attempt N)` + amber pending retry rows in the runs drawer.

**[FLOW2B] OR condition groups** — `Sonnet` — ✅ **shipped 2026-07-08** (no DDL). Summary in the Latest line + ✅ Done.
- `conditions` becomes a list of groups: `[[A,B],[C]]` = (A AND B) OR C. Legacy flat list = one group via `_as_groups` normalizer — **no data migration**, `evaluate_conditions` keeps its name/signature so the engine call site is untouched. Evaluator: `any(all(...))`, empty → True.
- Schemas: `list[ConditionSpec] | list[list[ConditionSpec]]`, normalized to nested on write, depth exactly 2, ≤ 5 groups, 1–10 conditions per group. Builder: each group a bordered card (action card styling) with per card "Add condition", centered `OR` divider between cards, "Add OR group" button; `toGroups()` normalizer on load + in `flowSummary`.

**[FLOW2C] Time triggers: schedule + ticket_sla_due_soon** — `Sonnet` — ✅ **shipped 2026-07-08** (no DDL, used 2A's columns). Summary in the Latest line + ✅ Done.
- `schedule` trigger: `trigger_config` `{"frequency":"daily","time":"09:00"}` or `{"frequency":"weekly","time":"09:00","weekday":0}` (0=Mon), validated by a `ScheduleConfigSpec` (time regex, weekly requires weekday; other triggers coerce config to `{}` so the builder can't smuggle keys). New 1 min `flow_schedule_tick` job in engine.py (`skip_if_locked("flow_schedule", ttl=55)`): loads enabled schedule flows + `CalendarSettings.timezone` map (yip_briefing pattern), `steps.schedule_is_due` decides, emits a `schedule` outbox event (payload carries `flow_id` — the engine fires only the addressed flow) and sets `last_scheduled_on = today` **in the same transaction**; missed ticks self heal the same local day.
- `ticket_sla_due_soon`: 5 min job in `tickets/automation/sla_escalation.py` mirroring `yip_sla_nudge_job`'s query (due within a fixed 60 min window, open/in_progress, not deleted, `sla_flow_emitted_at IS NULL`), emits one event per ticket (payload: subject, priority, status, `due_in_minutes`, assigned_to, sla_due_at) + sets the marker in the same transaction. Flows wanting a tighter window condition on `due_in_minutes lte N`.
- Builder When section: frequency select + `<input type="time">` + weekday select (weekly only) when trigger is schedule; `FlowOut` += `trigger_config`.
- **Review amendments (2026-07-08):** (1) stamp `last_scheduled_on = today` when a schedule flow is created or re enabled after its configured time has already passed that local day — otherwise `schedule_is_due`'s self heal fires it within a minute of saving, a surprise first run; (2) reset `sla_flow_emitted_at = NULL` wherever `sla_due_at` gets pushed out (SLA snooze in the ticket cockpit, priority changes that recompute the deadline) — the marker is currently one shot forever, so a ticket whose SLA was extended after the event fired would never emit again for the new deadline.

**[FLOW2D] saas_health_dropped trigger** — `Haiku` — ✅ **shipped 2026-07-08** (no DDL, commit `cf65285`). Summary in the Latest line + ✅ Done. Phase 2 complete.

**Every phase 2 session:** extend `tests/test_flows.py` (DB free), keep every new trigger/action registered in `TRIGGER_META`/`ACTION_META` so `/flows/meta` + builder pick them up automatically, `python3 -m alembic heads` must print one line before push, `pytest` + `tsc --noEmit` green, no modules.json change expected, no hyphens in commits. **Do not run two flows sessions in parallel** — they all touch `schemas.py` and `FlowsPage.tsx`.

### Phases 3–9 — next (directional specs, refine at session start)

**[FLOW3] Visual flow canvas** — `Opus` — ✅ **shipped 2026-07-08** (no DDL). Summary in the Latest line + ✅ Done. Stretch (connections overview) still open; dagre deliberately skipped (pure layout function, linear flows) — revisit at [FLOW4]. Original spec: the visual mapping layer: a node canvas per flow using `@xyflow/react` (React Flow) at `/flows/:id`, keeping the modal builder for quick edits. Nodes: trigger (with schedule config), one node per OR condition group, action, wait — auto laid out top to bottom (dagre), edges labelled and/or. **Edit parity:** canvas mutations write the exact same flows JSON as the modal (no schema change this phase). **Run replay:** pick a run from the drawer → highlight the path taken with per node ok/skipped/failed/attempts badges from `flow_runs.results`. **Amendment (2026-07-08):** stamp a stable per action id into each `flow_runs.results` entry in this phase — replay by list index works while flows are linear, but [FLOW4] turns actions into a DAG and retrofitting node ids into historical results is painful; adding them now is one line in `_execute_flow`. Stretch: a tenant wide "connections" overview mapping every enabled flow as trigger module → action module edges — the "how is my business wired" picture.

**[FLOW4] Branching paths (if/else inside a flow)** — `Opus` — ✅ **shipped 2026-07-08** (no DDL). Summary in the Latest line. Both amendments done (fresh entity state at branches; graph aware wait math). The canvas builder writes trees (branch legs never reconverge) — the stored DAG shape is more general, so a later phase can add reconvergence without touching storage. Original spec: *after [FLOW3] (canvas is the editing surface for branches).* Generalize `actions` from a list to a small DAG: `{"nodes":[{id,type,config}],"edges":[{from,to,when:"match"|"else"|null}]}` with a `branch` node type holding condition groups; legacy linear list = single chain via a normalizer (same no migration trick as [FLOW2B]). Engine walks the graph; waits/retries reuse `flow_pending_steps` (pending step stores next node id + graph snapshot instead of a remaining list). Schemas validate the DAG (single root, no cycles, ≤ 25 nodes). Canvas branch node gets match/else output handles; the modal builder goes read only for branched flows. **Amendment (2026-07-08):** branch nodes must evaluate against **fresh entity state**, not the frozen event snapshot — the flagship use case ("ticket created → wait 2 days → if *still* open → escalate") is impossible on frozen fields, since conditions would see the status at trigger time. At branch evaluation the engine re fetches the entity's current fields (ticket status/priority/assigned_to, contact tags/stage) and merges them over the snapshot (snapshot keys like `old_status` stay). Also make `total_wait_days`/`validate_wait_placement` graph aware (sum waits along the longest path) — they currently assume a linear list.

**[FLOW5] Webhook triggers & actions** — ✅ DONE (2026-07-08, migration `flows5_webhooks`) — `Sonnet` — *after phase 2, independent of [FLOW3]/[FLOW4].*
- Inbound `webhook` trigger: per flow tokened URL `POST /public/flows/hook/{token}` (booking token pattern — rate limited, regenerable from the builder), JSON body top level keys flattened into event fields (64KB cap), emitted through the normal outbox.
- Outbound `send_webhook` action: POST JSON (event fields + flow metadata) to a tenant configured URL with an HMAC SHA256 signature header (per tenant secret), 5s timeout, SSRF guard (https/http only, block private/loopback/link local IPs after DNS resolution); failures ride the [FLOW2A] retry ladder.
- **Review amendments (2026-07-08):** (1) the SSRF guard must **pin the resolved IP** — resolve once, validate, then connect to that IP with the original Host header; validating and then letting the HTTP client re resolve is open to DNS rebinding (TOCTOU); (2) inbound rate limit must be **per token**, not just per IP — with [FLOW6] chaining, an outbound webhook → external system → inbound webhook loop bypasses the chain_depth cycle guard entirely, and the per token limit is the only backstop; (3) webhook trigger condition fields are unknown at build time, so the builder's If section needs a free text field input for this trigger (other triggers keep the select).

**[FLOW6] Flow chaining (flows trigger flows)** — ✅ **shipped 2026-07-09, no DDL, commit `0d67d07`**. See ✅ Done / Latest. Chain identity via ContextVar (zero service signature changes); chain_depth ≤ 3 + cycle path guard; opt in per flow.

**[FLOW-POLISH] Flow QoL batch** — `Haiku` — ✅ shipped 2026-07-08 (no DDL). See ✅ Done / Latest. Test fire button (synthesize a sample event for the trigger, dry run: evaluate conditions + list which actions would run, execute nothing), duplicate flow, per flow success/fail counts on the list row (from `flow_runs`), status filter in the runs drawer. **Added from review (2026-07-08):** a stale `waiting` run sweeper — [FLOW2A]'s claim first resume means a crash between claiming a pending step and finishing the resume leaves the run row `"waiting"` forever with no pending step behind it; a slow job (hourly is fine) closes `waiting` runs older than max wait (30 days) + slack that have no matching `flow_pending_steps` row.

**[FLOW-ENGINE-BATCH] Batch the per event DB sessions** — `Sonnet` — *backlog, not urgent — fine at current flow adoption.* The engine opens N separate DB sessions per event: one per matching flow, each doing the `FlowRun` insert plus the `Flow.run_count`/`last_run_at` bump (`_upsert_run` in `engine.py` opens its own `db_session()` per call, and `_process_event` calls it once per matching flow). With few flows per trigger this is negligible, but as a tenant's flow count on a single trigger grows it multiplies the session/transaction overhead on every event. Batch the audit inserts + counter bumps for all flows matched on one event into a single session/transaction. Watch out for: the per action tenant scoped sessions (RLS lifecycle) stay separate on purpose — this is only about the run bookkeeping writes; keep the single `run_count` bump per run semantics and the "skipped condition miss doesn't bump the counter" rule intact.

**[FLOW-CANVAS-DD] Drag-and-drop canvas (n8n-style)** — `Opus` — *independent of [FLOW7]–[FLOW8]; can be built any time after [FLOW4].*
- **What's already built:** `@xyflow/react` is installed, `GraphSpec` nodes+edges is the right data model, the inspector side panel + all config field components exist. React Flow does bezier routing, zoom/pan, and drag natively — none of that needs to be written.
- **What's blocked today:** `nodesConnectable={false}` (edges can't be drawn), no `onNodesChange` (positions are recomputed from the layout function on every render, never stored), no node palette, `deleteKeyCode={null}`.
- **Drag nodes freely:** enable `nodesDraggable` + wire `onNodesChange` to capture `NodePositionChange` events; persist x/y per node as extra keys on each node dict in the existing `actions` JSONB (no migration — JSONB, unknown keys ignored by the engine). Auto-layout still runs on first open when no positions are stored; add a "Re-layout" button to snap back. `useNodesState`/`useEdgesState` replace the current derived nodes/edges memo so React Flow owns the live position.
- **Draw connections:** set `nodesConnectable={true}`; add React Flow `<Handle type="source" />` + `<Handle type="target" />` to each node component in `nodes.tsx`; wire `onConnect` → insert an edge into the graph (`{from, to, when: null}` for regular nodes, `"match"/"else"` for branch output handles which get two labelled handles). React Flow routes and renders curves automatically. `onEdgesDelete` removes the edge. Guard: trigger node has no target handle; branch nodes get two source handles (match/else).
- **Node palette:** thin left sidebar (160px, scrollable) listing draggable chips grouped by kind — Trigger (one per enabled trigger from meta), Action (one per enabled action), Wait, Branch. Standard React Flow `onDragOver`+`onDrop` pattern: drop fires → add a node at the canvas position with blank config + a stub edge from the nearest upstream node (best-effort; user can rewire) → node is selected and the inspector opens. No new API endpoint needed — same `PATCH /flows/:id` on save.
- **Delete:** re-enable `deleteKeyCode="Backspace"` for edges (safe, reconnectable); for nodes show a 1s confirmation toast with an undo before removing (a branch node removal also removes its two edges and orphans downstream steps which stay on canvas disconnected).
- **Saving:** `onNodesChange` + `onEdgesChange` mark dirty (same `dirty` flag as today); "Save flow" PATCH sends the full graph with positions. The engine ignores x/y keys — only `id/type/config` on nodes and `from/to/when` on edges are read.
- **Modal builder stays** for quick linear-flow edits from the list page. Canvas becomes the rich editor; branched flows still route straight to the canvas (existing behaviour).
- **No backend changes.** Frontend only: `FlowCanvasPage.tsx`, `nodes.tsx`, `layout.ts`.

**[FLOW7] Trigger registry: per module trigger declarations + full trigger coverage** — ✅ **shipped 2026-07-09, no DDL, commit `c5d8de8`**. See ✅ Done / Latest. 11 per-module `flow_triggers.py` files; TriggerType Literal deleted; 10 new triggers with emits; optgroup picker.
- **Problem:** adding one trigger today touches three places — `TRIGGER_META` in `flows/conditions.py` (centrally owned by the flows module), the duplicated `TriggerType` Literal in `flows/schemas.py:13`, and the `emit_flow_event` call in the emitting service. That does not scale to "every module exposes its events".
- **Registry:** each module gains an optional `flow_triggers.py` exporting its trigger declarations (key, label, condition `fields`, optional `fetch_fields` async loader). At startup the flows module assembles them into the existing `TRIGGER_META` dict by iterating the module registry (`modules/__init__.py` pattern) — the name and shape stay identical, so `build_meta`, the engine, the evaluator and all tests keep working untouched. Adding "booking cancelled" then touches only the calendar module: one declaration + one `emit_flow_event` call.
- **Kill the duplication:** drop the `TriggerType` Literal (schemas keep validating through the existing `_known_trigger` validator at `schemas.py:206`, which checks against the registry). Same treatment for `ActionType` if convenient.
- **Fresh entity loaders:** `engine._fresh_entity_fields` hardcodes per entity re fetch logic used by [FLOW4] branch evaluation; move each loader into the trigger declaration (`fetch_fields`) so new entity types (bookings, conversations, contracts) get correct fresh state branching without touching the engine.
- **Picker grouping:** `build_meta` currently drops the `module` key — include it per trigger; the builder's When `<select>` and the canvas trigger node picker group with `<optgroup>` per module (Tickets, Contacts, Pipeline, Bookings, …). Revisit as a searchable picker only if the catalogue passes ~25 triggers.
- **Coverage batch** (each = one declaration + one emit at the mutation site): livechat `conversation_started` / `conversation_solved`; calendar `booking_created` / `booking_cancelled`; marketing/emailtracking `campaign_button_clicked` / `campaign_email_bounced`; contracts `contract_expiring` (from the existing 6h lifecycle job, same one shot marker trick as `ticket_sla_due_soon`); billing `invoice_overdue` (from the existing daily check); shipments `order_received` (ERP webhook); saas `saas_signup`.
- **Drift guard test:** a DB free test iterates the registry and asserts every declared trigger key (module not None) appears in an `emit_flow_event(...)` callsite somewhere under `app/` (source scan) — the catalogue can never advertise a trigger nothing emits. Payload discipline: emitted payload keys must be a superset of the declared condition field keys; assert per trigger where an example payload is declared.

**[FLOW8] Built in automations — full inventarisation + /flows surface** — ✅ **shipped 2026-07-09, migration `flows8_builtin_migration`, commit `30d643a`**. See ✅ Done / Latest. 11-card builtins catalogue; 4 hardcoded jobs retired into default flows (SLA nudge, SLA escalation, booking stage, order stages); 4 columns dropped via backfill migration. Campaign button actions kept hardcoded (permanent decision).

**Complete inventarisation (verified against code 2026-07-08):**

| # | Automation | Where today | Module | Flows-expressible? | Notes |
|---|---|---|---|---|---|
| 1 | SLA escalation: bump priority when ticket SLA overdue | `sla_escalation.py` every 5 min | tickets | ✅ yes | `ticket_sla_due_soon` trigger + `update_ticket` action; retire job on migration |
| 2 | Auto-close stale tickets after N days without update | `sla_escalation.py` every hour | tickets | ❌ no | Needs a "time since last update" scan; no engine equivalent — Phase A card |
| 3 | Inbox AI scan: inbound email/WhatsApp → draft ticket | `inbox/ai_scanner.py` | inbox | ❌ no | Needs AI call + entity creation; Phase A card |
| 4 | **Campaign email button clicked → move contact to pipeline stage** | `tracking/router.py` GET `/track/click/{token}` + `LabelClickToken.action_type="pipeline_stage"` | emailtracking + pipeline | ✅ yes | The tracking click should emit `campaign_button_clicked` flow event; a flow with that trigger + `move_pipeline_stage` handles it; `LabelClickToken.stage_id` config deprecated → flow. This is the key one Diederik flagged. |
| 5 | Campaign email button clicked → apply label to contact | same as #4, `action_type="label"` | emailtracking | ✅ yes | Same pattern: emit event, flow handles it; label action not yet in ACTION_META |
| 6 | ERP order webhook → auto-create/update contact, tag `order-system` | `shipments/service.py handle_erp_order_webhook` | shipments | ⚠️ partial | Create-contact-from-order-data is complex payload mapping; show as Phase A card for now; `order_received` trigger in [FLOW7] lets flows react AFTER the contact is synced |
| 7 | ERP order webhook → move contact to pipeline stage (placed/shipped/delivered) | same function, `_resolve_order_stage` + tenant `order_placed/shipped/delivered_stage_id` columns | shipments + pipeline | ✅ yes | Replace the 3 Tenant stage FK columns with 3 flows: `order_received` trigger + condition on `status` + `move_pipeline_stage` action. This is the tracking-to-kanban Diederik wants in flows. |
| 8 | Booking confirmed → move contact to post-booking pipeline stage | `booking/service.py confirm_booking` line 1072, uses `CalendarSettings.post_booking_stage_id` | booking + pipeline | ✅ yes | `booking_created` trigger + `move_pipeline_stage`; retire `post_booking_stage_id` column in same deploy |
| 9 | Booking token created → send calendar invitation email | `booking/service.py _send_booking_invitation` | booking | ❌ no | Always fires, not configurable; Phase A card |
| 10 | Contract auto-expire / auto-renew / expiry reminder nudge | `contracts/scheduler.py` every 6h | contracts | ❌ no | Date-arithmetic scan; Phase A card. `contract_expiring` trigger ([FLOW7]) lets flows react |
| 11 | Invoice flipped to overdue when due_date passes | `sla_escalation.py` daily | billing | ⚠️ partial | Status flip stays hardcoded (no engine equivalent); `invoice_overdue` trigger ([FLOW7]) lets flows react after the flip |
| 12 | Yip SLA nudge (10 min) — notify agent when SLA near | `jarvis/scheduler.py` | jarvis | ✅ yes | `ticket_sla_due_soon` + `notify_user`; retire the Yip-specific job on migration |
| 13 | Yip morning briefing (daily at configurable time) | `jarvis/scheduler.py` | jarvis | ⚠️ partial | `schedule` trigger + new `send_briefing` action (not yet in ACTION_META); defer to later |
| 14 | Campaign scheduled send (1 min), A/B winner (15 min), drip sequences (hourly), engagement decay (monthly) | `marketing/scheduler.py` | marketing | ❌ no | Campaign machinery; Phase A card |
| 15 | SaaS health compute (hourly) + Monday at-risk digest | `saas/scheduler.py` | saas | ❌ no | Per-contact scan; Phase A card. `saas_health_dropped` trigger ([FLOW2D]) lets flows react |
| 16 | Livechat auto-claim on first agent reply | `chat/` session logic | chat | ❌ no | Real-time session assignment; Phase A card |

**Never show (platform-internal only):** demo nudge/expiry, subscription expiry, contact retention purge, onboarding drip (Yippie-to-tenant emails), external calendar sync, Jarvis thread cleanup, flow engine ticks.

- **Phase A — visibility:** static catalogue `flows/builtins.py` (key, name, description, module, cadence, optional settings deep link for the non-expressible ones), served in `/flows/meta`, filtered by `enabled_modules`. FlowsPage gets a "Platform automations" section (read-only cards, like the recipes strip) — the "what Yippie does for you" picture.
- **Phase B — migrate the expressible ones:** items 1, 7, 8, 12 all shipped in [FLOW8]. Items 4+5 (campaign button label/stage) kept hardcoded permanently — the `campaign_button_clicked` flow event emits so flows can react in addition, but `LabelClickToken.action_type/stage_id/label_id` and the click handler stay as-is.

**[YIP-FLOW] Yip builds flows from chat** — `Fable` — *after [FLOW7] (wants the registry serialized into the tool schema; technically possible against today's `TRIGGER_META` if sequenced earlier).* The scalability answer for the trigger catalogue is to stop making users browse it: describe the automation in chat, Yip assembles it.
- New Yip write tool `create_flow` following the [YIP3] propose → Confirm/Cancel pattern (`jarvis/agent.py` — write tools only propose; nothing persists until the user confirms). Tool input schema is **generated at request time** from `TRIGGER_META` + `ACTION_META` filtered to the tenant's enabled modules — every trigger/action added to the registry is instantly usable by Yip with zero extra work.
- Confirm path calls the same `service.create_flow` (admin gated — non admins get a polite refusal), created **disabled** so the user reviews before it runs; the confirmation toast deep links to `/flows/:id` (canvas). Validation errors from `FlowValidationError` are fed back into the tool loop for one repair attempt.
- Companion read tools: `list_flows` (so Yip can answer "what automations do I have?") and `explain_flow_run` (read `flow_runs.results` and narrate which conditions matched, which actions ran/failed — run debugging in plain language).
- Later (separate item): suggestion mode — Yip notices repeated manual patterns (e.g. urgent WhatsApp tickets always reassigned to the same person) and proposes a flow.

**[FLOW-CANVAS-NEW] New flow straight onto the canvas** — `Sonnet` — the canvas at `/flows/:id` (`App.tsx`) needs an existing flow; today a new flow must go through the modal first. Add a second header button on FlowsPage ("New on canvas", `Workflow` icon): POST `/flows` with a minimal disabled flow (`{name: "Untitled flow", trigger_type: <first meta trigger>, actions: [], enabled: false}` — schema already allows empty actions, recipes install the same way) then `navigate('/flows/' + id)` (same pattern as duplicate). No backend change expected.

---

## 🟣 Tier 1 — Open (verified against code 2026-07-04)

Full specs for [AI-MOD1] live in the **Post-launch build order** section above; full specs for the [FLOW…] items live in the **Flows initiative** section above.

- **[FLOW2A] Flows engine core: delay steps + retries** — `Opus` — ✅ shipped 2026-07-08 (migration `flows2_phase_two` — pending steps table + all phase 2 columns). See ✅ Done.
- **[FLOW3] Visual flow canvas** — `Opus` — ✅ shipped 2026-07-08 (no DDL): React Flow node canvas per flow at /flows/:id, edit parity inspector, run replay via stable action ids. See ✅ Done / Latest. Stretch (connections overview) still open.
- **[FLOW4] Flow branching (if/else paths)** — `Opus` — ✅ shipped 2026-07-08 (no DDL): actions list → validated DAG with branch nodes, engine walks the graph, fresh entity state at branch evaluation, canvas branch editing. See ✅ Done / Latest.
- **[AI-MOD1] Self-hosted AI module, phases 2–3** — `Fable` — *trigger: >100K AI calls/month.* Phase 1 (LiteLLM proxy, provider routing incl. `self-hosted` in `config.py`) ✅ session 87A. Open: vLLM on Hetzner deployment, pgvector memory layer, fine-tuning data pipeline.
- **[YIP-FLOW] Yip builds flows from chat** — ✅ shipped 2026-07-10 (no DDL): `create_flow` propose/confirm write tool (admin gated, disabled on create, "Open flow" CTA to canvas); `list_flows` + `explain_flow_run` read tools; trigger/action schema generated dynamically from TRIGGER_META + ACTION_META filtered to tenant's enabled modules in `_tools_for_tenant`. No migration, no new DB models. All in `jarvis/agent.py`.
- **[UX-PSYCH] UX psychology overhaul** — ✅ shipped 2026-07-10 (no DDL): all six items. See ✅ Done.
- **[TRIAL30] 30 day free trial on signup** — ✅ shipped 2026-07-08 (migration `trial30_trial_fields`, commit `48b9e82`). See ✅ Done / Latest. ⚠️ Stripe webhook endpoint not yet configured in dashboard — code path ready; conversion via superadmin `go_live_at` in the meantime.

---

## 🔵 Tier 2 — Open (verified against code 2026-07-04)

- **[FLOW2B] Flows: OR condition groups** — `Sonnet` — ✅ shipped 2026-07-08 (no DDL). See ✅ Done.
- **[FLOW2C] Flows: time triggers (schedule + ticket_sla_due_soon)** — `Sonnet` — ✅ shipped 2026-07-08 (no DDL). See ✅ Done.
- **[FLOW-CANVAS-DD] Drag-and-drop canvas (n8n-style)** — `Opus` — ✅ shipped 2026-07-10 (no DDL, no migration). See ✅ Done.
- **[FLOW7] Flows: trigger registry + full trigger coverage** — `Opus` — ✅ shipped 2026-07-09, commit `c5d8de8`. See ✅ Done.
- **[FLOW8] Flows: built in automations — full inventarisation + /flows surface** — `Opus` — ✅ shipped 2026-07-09, migration `flows8_builtin_migration`, commit `30d643a`. See ✅ Done.
- **[FLOW5] Flows: webhook triggers & actions** — `Opus` — ✅ shipped 2026-07-08 (migration `flows5_webhooks`, commit `77e7a7d`). See ✅ Done. All review amendments applied: IP-pinned SSRF guard, per-token rate limit, free-text condition fields for webhook trigger.
- **[FLOW6] Flows: flow chaining** — `Sonnet` — ✅ shipped 2026-07-09, no DDL, commit `0d67d07`. See ✅ Done.
- **[CLUSTER1] Issue cluster generator** — `Opus` — *not built* (no `ticket_clusters` table or insights code). Spec above. Note: no longer hard-blocked on [AI-MOD1] — Mistral/Anthropic fallback works for early tenants.
- **[AI-CTRL] Cloud LLM control panel** — `Opus` — *not built* (no `/superadmin/cloud-llm` route in `App.tsx`). Spec above.
- **[LANG1] More UI languages** — `Opus` — *deferred, not urgent (confirmed 2026-07-04).* Platform currently supports English + Dutch; add more languages when market expansion (BE/DE/FR) demands it. No build planned for now.
- **[WEB-NL] Dutch marketing site** — ✅ shipped 2026-07-10 (no DDL, commit `fb76c7c`). See Latest.
- **[UX-CRAFT] Visual craft polish pass** — `Sonnet` — ✅ ALL BATCHES SHIPPED. Batch 1.5 ✅ 2026-07-09; Batches 1+2+3 ✅ 2026-07-10 (no DDL). Batch 1 commit `49cd798` (soft shadow token pass both apps, `.heading-xl/lg/md/sm` utilities applied to ad hoc headings incl. 26px TicketList title capped at 24px, shared `useCopy` hook across 12 clipboard sites; scrims N/A — no text-on-image overlays existed; marketing type scale done in batch 3). Batch 2 landed inside `c3595aa` (semantic `success/warning/danger/info` tokens + `yippie` 50→900 ramp with DEFAULT alias in tailwind.config, `.btn-primary/secondary/danger/ghost-danger` + `.input-base/.input-error` primitives, adopted on 7 surfaces). Batch 3 commit `abb8597` (visible ⋮ action menus on ticket rows + kanban cards reusing ContextMenu, real € savings amounts computed from displayed prices on SubscriptionPage + web pricing + PricingTeaser, "Everything in {tier}, plus:" delta framing on web pricing only — app plan bullets kept per tier since limits aren't additive, plan name de emphasised/price emphasised at the 24px cap, real /shots screenshots replace the CSS mockups on the landing hero + dark section, capped 6 step marketing type scale tokens in globals.css). Left open deliberately: fine grained marketing body size collapse (13/13.5/14/14.5px near duplicates across ~20 css modules); pricing toggle default mismatch (monthly on web vs annual in app) still a flagged open question, NOT aligned. Original spec follows. companion to [UX-PSYCH] + [UX-CONV] (those cover conversion/behaviour psychology; this covers pure visual craft). From two uxpeak videos — "Every UI UX Concept Explained in Under 10 Minutes" + "redesign a vibe coded app into a pro product" — analysed 2026-07-09. All frontend, no migrations. Split into three batches by risk. **Batch 1 — quick polish (`Haiku`, one session):** **(A) Typography** — systematise tight heading tracking (letter spacing about −2% to −3%) + line height 110% to 120% on large headings via shared classes/tokens (only ~11 ad hoc `tracking-tight` uses today), and cap the type scale (≤ 6 sizes on marketing, nothing above 24px in dashboards for information density). **(C) Soft shadow token pass** — lower opacity + higher blur on the shadow tokens, popovers/overlays heavier than cards; if the shadow is the first thing you notice it is too strong. **(E) Copy confirm micro interactions** — the 14 `navigator.clipboard` buttons (booking, /sign token, webhook URL copies) get a "Copied ✓" chip or sonner confirmation instead of silent copies. **(F) Image overlay scrims** — replace flat overlays on logo/hero/card images with a linear gradient scrim (optional progressive blur on top) so overlaid text stays readable without flattening the image. **Batch 1.5 — consistency debt (`Haiku`, one session; from the Opus codebase audit vs `ux-habits.md`, 2026-07-09):** **(J) Loading state standardisation** — peer list pages use three treatments (skeletons on Tickets/Contacts/Inbox, plain "Loading…" text in ~23 files incl. InvoiceList/ContractList, centered spinner on ShipmentList); standardise data lists on the existing `Skeleton` primitives (`shell/Skeleton.tsx`), spinners reserved for pending buttons. **(K) Shared modal CloseButton** — all 112 modal close buttons lack `aria-label`/`title` and X icon sizes drift (18/16/14); one shared component fixes both. **(L) Focus ring brand fix** — 47 usages of `focus:ring-blue-500` (#3B82F6) vs 77 brand `focus:ring-yippie/30`, sometimes both in the same file (`InvoiceList.tsx:59` vs `:617`); mechanical replace with the brand pattern. **(M) Dingbat glyphs → lucide** — `⚠ ✓ ✕` used as icons in `TicketList.tsx:295`, `AccessLevelBadge.tsx`, `DraftReview.tsx`; swap for `AlertTriangle`/`Check`/`X` sized to line height. **(N) Card radius token** — `rounded-2xl` (41 files) vs `rounded-xl` (54 files) on identical card types; pick one token and standardise. **(O) Status badge token reuse** — InvoiceList/ContractList hardcode `bg-blue-100 text-blue-700` style badges while TicketList already drives colour from `--status-*` CSS vars; route invoice/contract statuses through the same layer (feeds Batch 2 B). **(P) KPI number treatment** — unify size + weight across dashboard stat cards (`text-xl font-semibold` on Sales/Saas vs `font-bold` on Contracts). **Batch 2 — colour + state foundation (`Sonnet`):** **(B) Semantic colour tokens + brand ramp** — `tailwind.config.js` has exactly one custom token (`yippie: #5BA4F5`); add `success` (green), `warning` (amber), `danger` (red), `info`/`primary` (brand blue) plus a 50→900 ramp derived from the brand blue for chips/states/charts, then audit usages so colour carries meaning, not decoration. Dark mode is OUT of scope — only 1 `dark:` usage exists in the whole frontend. **(D) Interaction state audit** — every button covers default/hover/active/disabled (+ loading spinner where it fetches); every input covers focus/error/warning. Extends the [UX-PSYCH] micro animation work with state completeness. **Batch 3 — layout + surfaces (`Sonnet`/`Opus`, DISCUSS before building — touches areas flagged as sometimes intentional):** **(G) Card hierarchy + de clutter** — busy CRM peek / ticket row / kanban cards: collapse row actions into a triple dot menu, dense chips to icon only, apply size/position/colour hierarchy (most important large + top, differentiated value colour). **(H) Pricing page upgrade** — on SubscriptionPage + getyippie pricing, show the actual discount amount, frame "what the next tier adds that this one doesn't", de emphasise plan name / emphasise price; confirm against the two intentional pricing tracks first (don't flatten deliberate differences). **(I) Landing page graphics** — swap generic icons for real product screenshots / lightly skewed product cards on getyippie.com; presentation drives conversion. Already fine, left as is: 0 emojis in the UI (V2's top gripe N/A); 30 gradient letter avatars kept (established pattern, not treated as an "AI tell").
- **[UX-DASH] Analytics & sidebar upgrade** — `Sonnet` — ✅ shipped 2026-07-09 (GET /sales/sparklines, no migration). from the Opus codebase audit vs `ux-habits.md` (2026-07-09); companion to [UX-CRAFT] Batch 3, discuss sequencing with it. **(1) KPI sparklines:** one shared inline SVG sparkline component replaces the decorative icon tiles on `SalesPage.tsx:80` (4 cards), `SaasPage.tsx:66` (3 cards), and the Contracts MRR/ARR rollup (`ContractList.tsx:1015`); a small history series endpoint per module is the only backend work, no migrations. **(2) Period toggle + deltas:** 7d/30d/90d segmented control plus a "vs previous period" delta chip on each KPI — today every analytics surface is a fixed window with zero user control (`SalesPage.tsx:36`, `SaasPage.tsx:30`, marketing strip hardcoded to 30d at `MarketingPage.tsx:326`). **(3) Sidebar account card + settings popover:** the footer is bare 11px email text + a plain sign out button (`Sidebar.tsx:391`) — replace with a gradient letter avatar account card that opens a popover (Profile, Sign out, collapse toggle), and collapse the flat Profile/Settings/Team/Superadmins links (`Sidebar.tsx:337`) behind it to free the rail; Billing stays in the module nav (product surface, not account plumbing). **(4) Small cuts:** collapse the contract modal "Term & value" six field block behind a disclosure (`ContractList.tsx:305`); dedupe marketing KPIs between the workspace strip (`MarketingPage.tsx:326`) and campaign `AnalyticsTab.tsx:62` (reframe as this campaign vs account average); drop the low information "Total events" card on SalesPage (`SalesPage.tsx:82`) in favour of a more decision relevant metric. Checked and N/A: no geographic data exists anywhere (map + shaded regions principle does not apply); creation flows are already proper modals, not sparse flyouts.

---

## 🟢 Tier 3 — Open ops items

- **[FLOW-POLISH] Flows QoL batch** — `Haiku` — ✅ shipped 2026-07-08 (no DDL): test fire (dry run), duplicate flow, success/fail run stats on the list row, runs drawer status filter, stale `waiting` run sweeper. See ✅ Done / Latest.
- **[FLOW-CANVAS-NEW] New flow straight onto the canvas** — `Sonnet` — ✅ shipped 2026-07-08 (no DDL). See Latest.
- **getyippie.com 502 fix** — Cloudflare proxy toggle (orange→grey→wait→orange) for Railway domain verification if ever needed.
- **[UX-CONV2] Conversion psychology follow up** — `Sonnet` — ✅ shipped 2026-07-09 (no DDL). sequel to shipped [UX-CONV], from the Opus codebase audit vs `ux-habits.md` (2026-07-09). All frontend, no migrations. **(1) Smart defaults sweep:** invoice date / due date default to today / today+30 (`InvoiceList.tsx:152` — the notes placeholder already says "Payment within 30 days"); calendar event end defaults to start + `slot_minutes` or 1 h (`CalendarPage.tsx:309`); contract `start_date` defaults to today (`ContractList.tsx:364`); campaign subject seeds from the name field until the user edits it directly (`MarketingPage.tsx:26`); homepage AI demo preloads example 1 so the "Analyze with AI" CTA is instantly actionable instead of disabled (`apps/web .../InboxDemo.tsx:36`). **(2) Pipeline starter template (endowed progress):** an empty pipeline offers one click "Start with a standard pipeline" (Lead → Contacted → Demo → Won/Lost) instead of building from zero stages (`PipelinePage.tsx:745`). **(3) SubscriptionPage anchoring + loss framing:** annual price gets an "≈ €X/mo" reframe and a "Most popular" ribbon on Growth (`SubscriptionPage.tsx:224`); upgrade CTA copy uses already computed state — "Upgrade — keep AI running" at `usagePct>=90`, "Upgrade before trial ends in {n} d" at `trialDaysLeft<=5` (`SubscriptionPage.tsx:272`). **(4) Flows empty state CTA:** replace the inert "No flows yet" copy with an "Install a recipe" / "New flow" button pair (`FlowsPage.tsx:998`). **(5) Billing urgency framing:** when overdue invoices exist, show a "{n} overdue" badge near the InvoiceList header so the first number frames urgency (`InvoiceList.tsx:607`). OPEN QUESTION (do not change without confirming): the public pricing page toggle defaults to monthly (`apps/web .../pricing/page.tsx:164`) while SubscriptionPage defaults to annual — possibly an intentional lower first number anchor, confirm before aligning.

- **[WEB-COMPARE] More comparison pages** — ✅ shipped 2026-07-10 (no DDL, commit `fb76c7c`). See Latest.
- **[WEB-BLOG-NL] First Dutch blog post** — ✅ shipped 2026-07-10 (no DDL, commit `3500fb6`). `/blog/klantenservice_software_voor_mkb` — "De twee extremen van klantenservice" targeting "klantenservice software voor MKB". English companion post also shipped at `/blog/two_extremes_customer_support_smb`. Both in blog index + sitemap + llms.txt.
- **[WEB-PROOF] Social proof section** — `Sonnet` — **Blocked on real quotes from Diederik** (sandbox test clients, Ndugu pilot?). Build the section component when 2–3 real quotes exist; never fabricate.
- **[WEB-LOGO-CARRY] Persist onboarding logo into the tenant** — ✅ shipped 2026-07-10 (migration `a3f8c2e91b4d`, commit `fb76c7c`). See Latest.
- **[WEB-FEATURE-GROUPS] Homepage feature grouping** — ✅ shipped 2026-07-10 (no DDL, commit `fb76c7c`). See Latest.
- **[WEB-FOUNDER-COUNT] Live founder spots counter** — ✅ shipped 2026-07-10 (no DDL, commit `fb76c7c`). Set `NEXT_PUBLIC_FOUNDER_SPOTS_LEFT` in Railway to update the count. See Latest.
- **[WEB-PRICE-DEFAULT] Pricing page smart default** — ✅ shipped 2026-07-10 (no DDL, commit `fb76c7c`). See Latest.

All other Tier 3 items shipped. See **✅ Done** below.

---

## ✅ Done

**[WEB-COMPARE] + [WEB-NL] + [WEB-FEATURE-GROUPS] + [WEB-FOUNDER-COUNT] + [WEB-PRICE-DEFAULT] + [WEB-LOGO-CARRY] web batch (2026-07-10, migration `a3f8c2e91b4d`, commit `fb76c7c`):** [WEB-COMPARE] /vs-freshdesk + /vs-front cloned from /vs-zendesk pattern; sitemap.ts + llms.txt updated. [WEB-NL] /nl Dutch homepage (full copy translated to B2B Dutch) + /nl/pricing static page; hreflang in layout.tsx + per-page metadata alternates; sitemap entries for /nl + /nl/pricing. [WEB-FEATURE-GROUPS] 15 feature rows grouped into Support/Sales & Growth/Operations with `.featureGroupLabel` category headers. [WEB-FOUNDER-COUNT] founder banner "first 5 spots" → "{FOUNDER_SPOTS_LEFT} of 5 spots left" driven by `NEXT_PUBLIC_FOUNDER_SPOTS_LEFT` env var. [WEB-PRICE-DEFAULT] pricing questionnaire teamSize initialised to "4–10". [WEB-LOGO-CARRY] migration extends tenants.logo_url to Text; `Questionnaire` model gains branding_color + branding_logo; signup handler applies both to new tenant after create_tenant; SignupForm reads CustomForm's localStorage and merges branding into signup payload. **[UX-PSYCH] (2026-07-10, commit `c3595aa`, staged from 2026-07-09 edits):** six items — micro-animations (card_exit + check_pulse keyframes in tailwind.config.js; kanban pop-in); empty states as conversion funnels (EmptyState component on Contacts/Contracts/Invoices/Shipments); daily-work closure feedback (dailyStats.ts sessionStorage counters + "All caught up" sonner toast on queue drain); keyboard shortcut discovery overlay (HotkeyOverlay + ? key); pipeline engagement nudge sidebar badge (amber dot + tooltip when newest entered_at > 48h); inline undo toasts on label/template/campaign delete (5s Undo sonner).

**[FLOW-CANVAS-DD] Drag-and-drop canvas (2026-07-10, no DDL, no migration):** pure frontend; `FlowCanvasPage.tsx` + `layout.ts` only. `ReactFlowProvider` wrapper so `useReactFlow` (for `screenToFlowPosition`) is available inside the canvas component. `useNodesState`/`useEdgesState` replace the previous `useMemo`-derived nodes/edges — React Flow now owns visual positions. `handleNodesChange` tracks drag-end events and saves per-node positions to `localStorage` (keyed `yippie_canvas_pos_{flowId}`) so they survive page reloads; backend `ActionSpec` strips unknown fields so positions are client-only, which is the right split. `useEffect` syncs RF state whenever draft/meta/replay/selection changes, overlaying saved positions from the `positionsRef` so inspector edits don't reset the layout. **Node palette** (`NodePalette` component): 160 px left sidebar listing all enabled actions + Wait + Branch as draggable chips; standard HTML5 `dataTransfer` + `onDrop`/`onDragOver` on the canvas wrapper; dropped nodes use `screenToFlowPosition` to convert screen coords to canvas coords, store their drop position in `positionsRef`, and are appended to the end of the main chain (or show a toast if the chain ends in a branch). **Re-layout button** (↻ in header): clears `positionsRef` + localStorage entry, re-runs `buildGraph` with an empty positions map → auto-positions snap back. **User-drawn connections** (`nodesConnectable={true}`, `onConnect`): drawing an edge from action/trigger/group node to a step node detaches the target from its current tree position and reinserts it after the source (or into a branch leg when source is a branch node with match/else handle). All nodes except ghost nodes are now draggable (removed `draggable: false` from `buildGraph` for trigger, group, action, and branch nodes). tsc clean, no backend change, single alembic head unchanged.

**[UX-PSYCH] UX psychology overhaul (2026-07-10, no DDL):** all six items, pure frontend. **(1) Micro-animations:** `card-exit` + `check-pulse` keyframes in tailwind.config.js; kanban cards pop-in on move (`justMoved` state + `animate-pop-in` in PipelinePage); resolve/bin/spam in TicketList + InboxQueue play `card-exit` before removing the row (with checkmark overlay). **(2) Empty states as conversion funnels:** shared `EmptyState` component (`components/EmptyState.tsx` — icon, title, subtitle, CTA button) used on ContactsPage (no contacts → "Add your first contact"), ContractList (no contracts), InvoiceList (no invoices), ShipmentList (no shipments). **(3) Daily-work closure feedback:** client-side `lib/dailyStats.ts` (sessionStorage counters scoped to today, zero DB writes) — InboxQueue fires `recordDailyActions` on each approval and shows "All caught up — N emails processed today" sonner toast when the queue empties; DraftReview fires on approve; TicketList fires on resolve. **(4) Keyboard shortcut discovery overlay:** `HotkeyOverlay` component mounted in App.tsx behind a `?` keydown listener (ignores inputs/textareas/contenteditable) — shows a modal grouped by page (Global, Inbox, Tickets) listing all active hotkeys. **(5) Engagement nudge sidebar badge:** Sidebar polls `/pipeline/board` (shared React Query cache with the kanban page, 5 min interval) and shows an amber dot on the Pipeline nav icon with tooltip "No pipeline activity in 2 days" when the newest `entered_at` across all contacts is >48 h ago. **(6) Inline undo toasts:** LabelsPage and TemplatesPage delete immediately (no confirm modal) and show a 5s "Deleted — Undo" sonner toast; Undo re-POSTs with the same name/colour. MarketingPage delete also converted. Contacts and invoices kept their existing patterns (deletion is less routine there).

**[YIP-FLOW] Yip builds flows from chat (2026-07-10, no DDL):** `create_flow` proposal/confirm write tool in `jarvis/agent.py` — admin gated (non-admins get a polite refusal), always creates disabled so the user reviews on the canvas before enabling, surfaces an "Open flow" CTA chip post-confirm. Tool schema (trigger_type enum, action type enum, conditions OR-of-AND groups) generated at request time in `_tools_for_tenant` from `TRIGGER_META` + `ACTION_META` filtered to the tenant's enabled modules — every trigger/action added to the registry is instantly usable with zero extra work. `list_flows` read tool returns name/trigger/enabled/run stats. `explain_flow_run` read tool takes a flow name (fuzzy match), fetches the most recent `FlowRun`, and narrates each result entry in plain language (branch match/miss, action success/skip/fail/attempts, wait pauses). `create_flow` + `list_flows` + `explain_flow_run` registered in `TOOL_MODULES` under "flows" so tenants without the module never see them. `_build_create_flow_tool()` helper builds the dynamic JSON schema. `UserRole` added to the models import. Confirm path catches both `FlowValidationError` and pydantic `ValidationError` and feeds the error string back to the model for a repair attempt. No new files, no migration, single alembic head unchanged.

**[WEB-MINI] + [WEB-SEO1] + [WEB-GEO1] Commercial site: mini Yippie onboarding + SEO/GEO batch (2026-07-09, no migration):** see the Latest header for the full breakdown — mini workspace preview on /custom (colour/logo/live module sidebar, `MiniYippie.tsx` + two column layout in `custom.module.css`), `branding_color` end to end (CustomForm payload → web API route passthrough → backend `CustomPlanQuestionnaire` + contact custom_fields + ticket description), emoji purge on /custom + homepage, FAQPage JSON-LD on /pricing, BreadcrumbList on 5 blog posts, real blog dates in sitemap, schema enrichment (priceSpecification/areaServed), llms.txt, AI crawler robots.txt, vs-zendesk direct answer paragraph, stale pricing metadata fixed (€19/€39/€69).

**[FLOW8] Built in automations (2026-07-09, migration `flows8_builtin_migration`, commits `0d67d07`/`c5d8de8`/`30d643a`):** 11-entry `flows/builtins.py` catalogue served in `/flows/meta`; "Platform automations" read-only card grid on FlowsPage. `notify_user` gains `recipient="assigned agent"`. Retired 4 hardcoded automations: Yip SLA nudge (jarvis/scheduler.py) → default flow; `escalate_overdue_tickets` (sla_escalation.py) → default flow (once → urgent, before breach); `CalendarSettings.post_booking_stage_id` + booking fallback → per-tenant backfill flow; `Tenant.order_placed/shipped/delivered_stage_id` + shipments stage settings → per-tenant backfill flows. Migration backlists then drops 4 columns. seed.py + admin/service.py install 2 universal SLA flows idempotently. 101 tests pass. Campaign button hardcoded label/stage (items 4+5) kept as-is permanently — `campaign_button_clicked` event emits so flows can react in addition. **[FLOW7] Trigger registry + 10 new triggers (2026-07-09, no DDL, commit `c5d8de8`):** `trigger_registry.py` assembles `TRIGGER_META` from 11 per-module `flow_triggers.py` files (filesystem scan; tickets first). `TriggerType` Literal deleted. `fetch_fields` loaders replace hardcoded `_fresh_entity_fields`. `build_meta` includes `module` per trigger. 10 new triggers with emits: conversation_started/solved, booking_created/cancelled, campaign_button_clicked, campaign_email_bounced, contract_expiring (rides expiry_reminder_sent_at — no DDL), invoice_overdue, order_received, saas_signup. Optgroup trigger picker. **[FLOW6] Flow chaining (2026-07-09, no DDL, commit `0d67d07`):** `chain_scope` ContextVar stamps chain_depth/chain_path into flow-caused events; engine SQL-filters to chainable flows; depth ≤ 3 + cycle guard; `chainable` opt-in per flow.

**[UX-CONV] Conversion psychology batch (uxpeak six) (2026-07-08, no migration):** all six sub items shipped, no DDL (both `demo_expires_at` and `logo_url` already existed on the tenant). **(1) Smart defaults:** `ContactNew` reads `?company=<id>` and pre-fills the company; `CompanyPeekModal` gained an "Add contact to {company}" action (wired from `CompaniesPage` + `ContactsPage`) and `ContactList`'s new-contact links carry the active company filter; `SendBookingModal` propose mode prefills the next 3 free working-hour slots (`computeNextSlots`) and focuses the calendar there; `YipTrainModal` got a per question Skip button backed by a `DEFAULTS` array. **(2) Endowed progress:** `SetupChecklist` now has an always-done "Account created" first gate so it opens at "1 of N" and the bar never starts empty (`WelcomeTour` already filled step 1). **(3) Endowment gate:** new `MakeItYoursModal` (brand colour + logo) as a "Make it yours" checklist gate; reused `PATCH /team/branding`, extended with an optional `logo_url` (schema + service + router, no migration). **(4) Loss aversion:** `ModuleGate` renders a `PlanGate` style locked card (module name + Upgrade plan CTA + à la carte contact line) instead of silently redirecting to `/`; demo banner shows a concrete deadline from `demo_expires_at` ("Your demo ends Friday"), added to `TenantConfigOut` + `/tenant/config` + frontend `TenantConfig`; AI scans ≥90% shows an amber banner on `SubscriptionPage` + a once-per-session sonner toast. **(5) Anchoring:** new `PricingTeaser` client component replaces the homepage static plan grid with an annual/monthly toggle (Save 10%), "10% off (was €X/yr)", billed-basis line, and per-user framing ("≈ €X/user/mo for up to N users"), reusing shared `PLAN_LIMITS`. **(6) Dismiss copy audit:** no soft "maybe later" upgrade prompts existed; applied the "I'll risk it" acknowledgment as the AI-usage toast cancel action; no em dashes in new user copy. Verified: backend files compile, app + web tsc clean of new-file errors (pre-existing missing-dep/stale-cache noise only).

**[TRIAL30] 30 day free trial on signup (2026-07-08, migration `trial30_trial_fields`, commit `48b9e82`):** every self serve signup starts a 30 day free trial with no payment collected. Migration adds `trial_ends_at`/`trial_nudge_sent_at`/`trial_final_nudge_sent_at` to tenants. Signup stamps the trial BEFORE `set_tenant_context` (tenants RLS would block the UPDATE from root context) and commits the full transaction — this also fixed a latent bug where the root tenant contact/Live stage work was silently rolled back on every signup. `handle_signup_payment` no longer called at signup. Hourly `trial_nudge_check` sends a reciprocity email at 7 days left (showing real contact+ticket counts) and a loss aversion email at 2 days left. Hourly `trial_expiry_check` deactivates unconverted tenants and emails the prospect ("nothing is deleted, upgrade to restore access"). Conversion clears `trial_ends_at` automatically via existing Stripe webhook handlers (`checkout.session.completed`, `invoice.paid`, subscription sync) — Stripe webhook endpoint not yet configured in dashboard but code is live-ready; manual fallback: superadmin sets `go_live_at` which now also clears the trial (side effect in `update_tenant`). `trial_ends_at` added to `TENANT_SAFE_FIELDS`, `TenantUpdate`, `TenantOut`, `TenantConfigOut`, and `tenant/config` response. `TrialBanner` component in App.tsx (brand blue, flips to amber loss aversion in final 5 days with "your contacts and tickets stay when you upgrade"). Trial chip on SubscriptionPage. Marketing: getyippie.com hero, plan card CTAs, bottom CTA → "Start your free 30 day trial" pointing to /signup; pricing FAQ corrected (previously said "we don't offer a free trial").

**[FLOW2D] saas_health_dropped trigger (2026-07-08, no DDL, commit `cf65285`):** `compute_health_for_contact` captures `old_score = row.score` before the upsert; if the row pre existed and `score < old_score`, emits `saas_health_dropped` via `emit_flow_event` in the same flush (outbox guarantee with the hourly job's per contact commit). Payload: `{score, previous_score, drop}`. No DB column needed — threshold crossing expressed as `score lte X AND previous_score gte X+1` in flow conditions; a stable low score never re emits. `TRIGGER_META["saas_health_dropped"]` registered with `module="saas"` (auto gated by module key) + three number condition fields (score/previous_score/drop). All 44 flows tests pass, tsc clean, one alembic head. Phase 2 complete.

**[FLOW2C] Flows time triggers — schedule + ticket_sla_due_soon (2026-07-08, no DDL):** two triggers that originate in the scheduler rather than a user mutation, both riding the phase 1 outbox so nothing else in the engine changed. **schedule:** the `schedule` trigger stores a `trigger_config` `{frequency: daily|weekly, time: "HH:MM", weekday?}` validated by a new `ScheduleConfigSpec` (time regex `^([01]\d|2[0-3]):[0-5]\d$`, weekly requires a weekday 0–6, daily nulls it); `service._normalize_trigger_config` is the single write-side gate — non-schedule triggers always store `{}` (the builder can't smuggle keys), a disabled schedule flow may be a draft with empty config, enabling one requires a valid schedule (raises `FlowValidationError` → 422). A 1 min `flow_schedule_tick` job on the flows engine loads enabled schedule flows + the per tenant `CalendarSettings.timezone` map (yip_briefing pattern), and for each flow that `steps.schedule_is_due` (built in 2A) approves emits one `schedule` outbox event whose payload carries `flow_id` (so the engine's `_process_event` targeting — also added in 2A — fires only the addressed flow, no skipped rows on siblings) and sets `last_scheduled_on=today` in the SAME transaction: the outbox guarantee means a missed minute self heals the same local day and a flow never fires twice a day. **ticket_sla_due_soon:** a 5 min `flow_sla_emit` job in `tickets/automation/sla_escalation.py` selects tickets whose `sla_due_at` is within a fixed 60 min window (open/in_progress, not deleted, `sla_flow_emitted_at IS NULL` — the one-per-ticket dedup column from 2A, mirroring [YIP5]'s `sla_nudged_at`), emits one event per ticket (payload subject/priority/status/`due_in_minutes`/assigned_to/sla_due_at) and stamps the marker in the same transaction; a flow wanting a tighter cutoff adds a `due_in_minutes lte N` condition. `TriggerType` + `TRIGGER_META` gain both (schedule module None + a weekday condition field; sla module tickets with due_in_minutes/priority/status/subject fields), so `/flows/meta` and the builder pick them up automatically. Frontend `FlowsPage`: the When section renders a frequency select + weekday select (weekly only) + `<input type="time">` when the trigger is `schedule`, `handleSave` now sends `trigger_config` (`{}` for non-schedule). Verified: pytest 44 flows tests (8 new — ScheduleConfigSpec daily/weekly/bad-time, `_normalize_trigger_config` matrix incl. draft vs enabled, both triggers registered), `tsc --noEmit` clean, one alembic head (`flows2_phase_two`, no new migration), both jobs register on their schedulers.

**[FLOW2B] Flows OR condition groups (2026-07-08, no DDL):** conditions moved from a flat AND list to OR-of-AND groups. Stored shape `[[A,B],[C]]` = (A AND B) OR C; a legacy flat list `[A,B]` is treated as a single group by a new `_as_groups` normalizer in `conditions.py`, so `evaluate_conditions` keeps its name and signature (the engine call site at `_process_event` is untouched) and there is **no data migration** — existing flat flows and flat recipes keep working. The evaluator is now `any(all(evaluate_condition(...)))`, empty conditions → always match. Schemas: `FlowCreate`/`FlowUpdate` `conditions` typed `list[list[ConditionSpec]]` with a `mode="before"` validator (`_normalize_condition_groups`) that accepts flat or grouped input and normalizes to grouped, enforcing depth exactly 2, ≤ 5 groups, 1–10 conditions per group, no empty groups, and rejecting mixed flat/grouped lists; `service.create_flow`/`update_flow` dump nested. Frontend `FlowsPage`: `toGroups()` normalizes flat/grouped on modal load and for the `flowSummary` condition count; the If builder holds `Condition[][]` state — each group is a bordered card (action card styling) with its own condition rows + per card "Add condition", a centered `OR` divider between cards, and an "Add OR group" button; empty groups are dropped on save so the backend never sees one. Verified: pytest 36 flows tests (9 new — OR semantics, flat backward compat, flat→group normalization, grouped passthrough, and depth3/empty group/>5 groups/mixed rejection), `tsc --noEmit` clean, one alembic head (`flows2_phase_two`, no new migration). Open: [FLOW2C] time triggers, [FLOW2D] saas_health_dropped.

**[FLOW2A] Flows engine core: delay steps + retries (2026-07-08, migration `flows2_phase_two`):** the phase 2 foundation. One migration carries all of phase 2's DDL — `flow_pending_steps` (tenant_id, flow_id, run_id FK→flow_runs, kind wait|retry, event/actions/results JSONB, attempt, resume_at, RLS block copied from flows1) plus `flows.trigger_config`/`last_scheduled_on` and `tickets.sla_flow_emitted_at` — so the sibling sessions [FLOW2B/C/D] add no DDL. New pure `app/modules/flows/steps.py` keeps the engine's time/outcome math DB free: `wait_delta` (exactly one of minutes/hours/days, positive, ≤ 30 days), `total_wait_days` + `validate_wait_placement` (no trailing wait, ≤ 30 days total), `derive_run_status` (moved verbatim from the phase 1 engine), `retry_delay` (60s/300s ladder, MAX_ATTEMPTS 3) and `schedule_is_due` (daily/weekly, once a day, self healing — pre built for [FLOW2C]). `wait` is a pseudo action: registered in `ACTION_META`/`ACTION_MODULES` (module None) but deliberately **not** in `ACTION_EXECUTORS`; the engine special cases it — appends a wait result, upserts the run `"waiting"`, persists the remaining actions to `flow_pending_steps` and returns. Resume is folded into the 10s `flow_engine_tick`: `_claim_pending` deletes-and-returns due steps (claim first, same crash philosophy as `_claim_events`), then `_resume_step` re checks tenant + flows module + flow-still-enabled before continuing (abandoning the tail — guarded `flow_runs` update — if any was torn down mid wait). Retries ride the same table (`kind="retry"`, remaining = failed action onward, frozen prior results never re run, `attempts` on every result dict, a transient amber `pending_retry` row on the run only); after 3 attempts the failure is recorded and the rest of the flow still runs (phase 1 keep going semantics). Engine refactored: `_execute_flow` walks the remaining actions; `_upsert_run` inserts fresh (bumping run_count/last_run_at once, at the first non skipped insert) or updates a paused run to terminal; `_persist_pending`/`_claim_pending`/`_resume_step`/`_abandon_run` added, `_record_run` absorbed. Schemas: `ActionType` += `wait` with a model validator that runs `wait_delta`, `actions` max_length 5 → 10; `service._validate_enabled` calls `validate_wait_placement`. Frontend `FlowsPage`: `WaitConfig` (number + unit) rendered for wait actions in Then, blue `waiting` badge, `(attempt N)` suffix + amber pending retry rows in the runs drawer. Verified: `alembic heads` one line (`flows2_phase_two`), pytest 27 flows tests pass, `tsc --noEmit` clean, no modules.json change. Open: [FLOW2B] OR groups, [FLOW2C] time triggers, [FLOW2D] saas_health_dropped (all migration free — see the ⚡ Flows initiative section). Not yet pushed.

**[FLOW1] Flows module phase 1 (2026-07-07, commit `339f625` / merge `12ec1ca`):** free core Flows module — tenant configurable trigger → condition → action automations. Backend: `flow_events` transactional outbox (`app/core/flow_events.py`, written in the same transaction as the mutation) with service level emitters for ticket_created, ticket_status_changed, contact_created, pipeline_stage_changed and draft_approved (the draft approval path previously created tickets with no event at all); `app/modules/flows/` (models, schemas, service, router, condition evaluator + TRIGGER_META, action registry + ACTION_META: create_ticket, update_ticket, move_pipeline_stage, notify_user via reminder toast, send_email via queue_send; five installable recipes; 10s engine with claim first batching, per action tenant scoped sessions, flow_runs audit log incl. skipped condition misses); loop protection via `source="flow"`; migration `flows1_flow_tables` (3 tables + RLS, chained from yip6_jarvis_threads, single head) enabling the module for every tenant. Frontend: FlowsPage with recipe cards, flow list with enable toggle + runs drawer, When/If/Then builder modal fed by `GET /flows/meta`; registered in modules.json (core, free), sidebar, routes, translations, superadmin module lists. Verified: pytest 46 passed, tsc clean, check:config in sync. Phase 2 designed + approved the same day and split into tiered sessions [FLOW2A]–[FLOW2D]; phases 3–6 spec'd ([FLOW3] canvas, [FLOW4] branching, [FLOW5] webhooks, [FLOW6] chaining, [FLOW-POLISH]) — see the **⚡ Flows initiative** section.

**[YIP4] + [YIP5] + [YIP-STREAM] Yip upgrade (2026-07-06):** the three open Yip items shipped in one session. **[YIP4]** six read tools in `jarvis/agent.py` (`list_pending_drafts`, `list_waiting_chats` chat-gated, `check_email_engagement` on OutboundEmail opens/clicks, `get_ticket_stats` + resolved today/7d, `get_revenue_summary` contracts-gated via `renewals_summary`, `list_todays_bookings` in tenant tz from CalendarSettings). **[YIP-STREAM]** migration `yip6_jarvis_threads` (jarvis_threads + jarvis_messages, RLS, + `tickets.sla_nudged_at`); `jarvis/threads.py` persistence (server side history when `thread_id` set, 30 day retention job); `GET /jarvis/threads` + `/threads/{id}/messages`; SSE `POST /jarvis/capture/stream` (`run_agent_stream` generator in agent.py, `ai_stream_tools` in ai/client.py via litellm `stream=True` + `stream_chunk_builder`, DB session opened inside the generator, `X-Accel-Buffering: no` + dedicated nginx `proxy_buffering off` block); frontend `jarvisStream.ts` fetch/ReadableStream client + QuickCapturePopup rework (streaming bubble with tool status labels, preamble discarded on status events — terminal result authoritative, JSON fallback on transport failure, conversation resumes on reopen, new thread + history buttons). **[YIP5]** `jarvis/briefing.py` deterministic plain text digest (SLA breached/due today, meetings, waiting chats, pending drafts, overdue reminders — module gated, skips empty days); `yip_briefing` job every 15 min (tenant tz, `jarvis_prefs.briefing_enabled/briefing_time/briefing_last_sent_on` dedup, delivered as a `kind='briefing'` thread + `jarvis_briefing` toast; `force_user_email` test hook); `yip_sla_nudge` job every 10 min (due within 60 min, `sla_nudged_at` set only when the toast reached an online agent); briefing prefs UI in the Yip settings panel.

**[EXT1-STORE] Chrome Web Store submission (2026-07-06):** extension submitted to the Chrome Web Store (manual step completed by Diederik — developer account, zip upload, listing assets). Store review pending on Google's side; no further build work open.

**[EML1] Gmail/Outlook OAuth email linking (2026-07-06, confirmed done):** all 4 sessions shipped (commit `1459cdc`) — `email_accounts` table + Fernet token encryption, provider abstraction (Google/Graph, httpx + raw MIME), `poll_oauth_inboxes` sync job, linked-account send path in `flush_pending_sends` with From-picker in ComposeModal/DraftReview, unit tests + module README. Ops reminder: Google restricted-scope verification takes weeks; Microsoft Graph rotates refresh tokens on every refresh.

**[CALL1] Click to call + call recording (2026-07-06, confirmed done):** Call button in ContactDetail → Continuity call, local helper daemon (HTTPS :8765) drives Handy full-call recording via BlackHole aggregate, transcript → AI analyze → review → save (activity event, notes, reminders, email draft). Superadmin-gated on production (personal local daemon). Possible follow-up — proper multi-tenant VoIP integration — deliberately **not on the roadmap**; only if a client asks.

**[CONTRACT2+3] Contract lifecycle + e-signing (2026-07-06):** CONTRACT2 adds start/end dates, notice period, auto renew + renewal term, value/interval/currency (Stripe-shaped), MRR/ARR rollup at `GET /contracts/renewals/summary`, and a 6-hourly APScheduler job (`contracts/scheduler.py`) that auto-expires lapsed contracts, rolls auto-renewing ones forward by term, and queues notice/expiry nudges as UserReminder rows delivered by the jarvis toast channel. Frontend: Term & value section in the form, End date/Value columns, All|Renewals tabs with deadline chips and MRR/ARR stat cards. CONTRACT3 adds per-tenant `contract_templates` table (RLS), `{{merge.field}}` rendering (11 fields), frozen body generated from a template, PDF download via fpdf2 with signature block, Templates modal with field chip picker, signing section in the peek (generate/edit/PDF/signing link), and a public `/sign/:token` draw-to-sign e-signing page reusing the booking-token pattern (rate-limited, single-use, 14-day expiry, full audit trail). Migrations chain: contract1 → contract2 → contract3 (single head). Commit `1ce8118`.

**[Phase 11C T2] "Connect your inbox" ROI estimate ✅ (2026-07-06):** CSV/mailbox-export upload parsed in-browser for inbox ROI estimation.

**[YIP3] Yip write actions + confirm chips (2026-07-05):** five write tools in `jarvis/agent.py` — `create_ticket`, `update_ticket` (assign/status/priority; 'me' resolves to current user), `create_contact` (company get-or-create by name, duplicate heads-up row on the card), `create_calendar_event` (default 1h duration, contact link), `move_pipeline_stage` (exact then fuzzy stage match; lists available stages on miss). The tool loop never writes: each executor resolves entities to tenant-scoped ids and stages `action_taken=confirm_action` + `inline_data={tool, args, title, details}` (one proposal per turn); `QuickCapturePopup.tsx` renders `ConfirmActionCard` with Confirm/Cancel; Confirm posts to `POST /jarvis/confirm` → `agent.execute_confirmed` re-applies TOOL_MODULES gating and re-validates tenant ownership before writing (client payload never trusted), returns `write_done` + CTA chips (Open ticket/contact/calendar/kanban). Cancel is local and appends a "nothing was changed" turn so the model sees the outcome.

**[YIP2] + [YIP-GATE] (2026-07-05):** Yip drafts replies in tenant tone — `jarvis/service.py` gains `load_ticket_thread` (oldest-first, internal notes flagged, User join for author names), `draft_ticket_reply` (full-thread prompt + `_profile_reply_rules` from `ai_profile`) and `draft_fresh_email` (JSON subject+body); `jarvis/agent.py` gains `draft_reply` + `get_ticket_thread` tools, `_resolve_context_ticket` helper (open ticket → subject search; named contact beats open-ticket context) and the `TOOL_MODULES` gate (list filtered per tenant + executor-side refusal); `QuickCapturePopup.tsx` handles `action_taken=draft_reply` → `openCompose` prefilled with recipients/subject/body. Drafts are never auto-sent.

**[CTX1] Customer data + AI briefing (2026-07-05):** architecture decided — full history stays in module-owned RLS tables; canonical aggregator `app/core/customer_context.py` (module-gated sections: profile/labels, pipeline, tickets, billing, chat, email engagement, SaaS health, shipments, upcoming meetings, activity) feeds inbox briefing, all three ticket AI endpoints (previously empty history + wrong `contact.company` attr) and Yip's contact briefing via one code path.

**Late-June untracked batch (2026-06-27→30, reconciled from git 2026-07-04):** bidirectional iCal calendar sync (Apple/Outlook) + personal calendar invitations + shared/personal slider; **Train Yip** (per-tenant `ai_profile`, training modal, Settings card); Yip actions: compose_email, help (manual-backed), math pre-classifier; agent performance section on Activity page; **ERP order webhook** — syncs contacts + moves kanban stage (tracking module); `/docs` page on getyippie.com with live manual fetch + `HelpTip` component + `help_tips_enabled` toggle + Platform Manual PDF download in Profile; **security hardening** (OWASP P1 headers/auth logging/webhook fail-close; pentest phases 1–4: python-jose→PyJWT, passlib→bcrypt, JWT→HttpOnly cookie, Redis rate limits, CSP tighten, WhatsApp webhook HMAC; RLS on calendar_event_invitations); Ndugu Coffee pilot-readiness UX fixes; self-serve signup wired to /custom ("Build your plan" CTAs, founding plan remembered); booking minimum advance notice; em-dashes removed from all user-facing copy; labels module deleted (`/settings/labels` → workspace); Sales/SaaS page error+loading states.

**[Phase 11C T2] "Connect your inbox" ROI estimate ✅ (2026-07-06):** CSV/mailbox-export upload parsed in-browser for inbox ROI estimation.

**[CONTRACT1] Contracts module — phase 1: storage ✅ (2026-07-05):** new €9/mo `contracts` module. `contracts` table (title, type, status, `direction` issued|received, company/contact counterparty + free-text fallback, tags, notes, inline BYTEA document with a deferred `file_data` column) + tenant RLS; backend CRUD + file up/download/remove at `/contracts`; frontend list with inline status edit, issue/receive filter, add + edit-peek modals, company & contact typeaheads, PDF/Word/image upload. Registered in modules.json (`pnpm sync:config`), MODULES registry, migrations/env (`contract1_contracts_table`), both SuperAdmin module lists, Sidebar, i18n. Left out of `ADVANCED_FEATURES` (pure à-la-carte add-on, no plan gate — like sales/saas). Deployed to sandbox (commit `fb9a782`) and verified end-to-end via authed API: create→resolve counterparty→patch→PDF upload→byte-identical download→delete all pass; module bulk-enabled for all 31 sandbox tenants. Open follow-ups: [CONTRACT2] lifecycle (Tier 2), [CONTRACT3] e-signing (Tier 1).

**Modules shipped (16, per `ALL_MODULES` in config.py):** inbox, contacts, tickets, calendar, pipeline, booking, activity, billing, contracts, chat, departments, marketing, tracking, sales, saas, ai — plus [JARVIS1] quick-capture (⌘K), [EMBED1] lead-widget.js, [CUSTOM1] /custom configurator, [STRIPE1] SaaS billing, [EXT1] Chrome extension (code shipped; store submission open, see Tier 3).

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

- ~~**Sandbox email routing**~~ — obsolete: the `devsandbox` branch/env was retired 2026-06-20 (merged into `sandbox`); there is no longer a second env sharing the Sandbox DB.

---

## 📎 Appendix A — Session log

> ⚠️ **Incomplete:** detailed logs exist for sessions 2–52 only. Sessions 53–91 were never
> written up here — their one-liners lived in the header "Latest" line (itself truncated to
> ~84+) and the go-live checklist. For anything in that range, git history is the source of truth.

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

### Deploy workflow (current — devsandbox/commercial branches retired 2026-06-20)

```
git push origin sandbox      # → Railway Watch Paths deploy apps/app (Sandbox env) + apps/web (Commercial env)
git checkout production && git merge sandbox && git push   # → promote to app.getyippie.com
```

⚠️ Before any push with migrations: `python3 -m alembic heads` must return exactly ONE head
(see `apps/app/CLAUDE.md` → Migration safety). ⚠️ Railway only rebuilds on watch-path changes —
bundle a `src/` change with screenshot-only pushes.

### Review workflow

1. Build on `sandbox`
2. `/code-review ultra` + `/security-review` + `/verify`
3. If approved: merge `sandbox → production`

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

### Environments (current as of 2026-07-04)

| Environment | URL | Branch | Purpose |
|---|---|---|---|
| Production | app.getyippie.com | production | **LIVE since 2026-06-23** — real clients |
| Sandbox | sandbox.getyippie.com | sandbox | Staging + feature development |
| Commercial | getyippie.com | sandbox (watch: apps/web) | Next.js marketing site |

Sandbox DB ≠ Production DB — never cross them. **Promotion workflow:** `sandbox → production`.
Retired: `devsandbox` + `commercial` branches (merged into `sandbox`, 2026-06-20), dev.getyippie.com pair.

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

### Migrations

The hand-maintained list that used to live here went stale (it stopped at `a5b6c7d8e9f0`, dozens
of migrations ago). The source of truth is `apps/app/backend/migrations/versions/` +
`python3 -m alembic heads` (must always return exactly one head — see `apps/app/CLAUDE.md`).

> `migrations/env.py` takes `pg_advisory_xact_lock(912021)` before migrating — concurrent
> deploys of the staging pair can no longer race DDL on the shared DB.
