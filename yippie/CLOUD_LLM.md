# Yippie — Cloud LLM Roadmap
**Created:** 2026-06-21
**Status:** Post-launch initiative. Go-live is 2026-06-28 — none of this is in launch scope.
**Roadmap item:** [AI-MOD1]

---

## What it is

Replace the Anthropic API key with a self-hosted open-source LLM running on Digital Ocean. The fundamental difference: Anthropic's API is stateless — every call forgets everything. A self-hosted model **accumulates context**, gets fine-tuned on real tenant conversations, and improves with every interaction across the platform.

Two context scopes feed every feature:
- **Tenant context** — what the client's business does, their product, tone, config, SLAs
- **Customer context** — who this end-user is, full conversation history, behavioral data (from Sales module), order history (from Track & Trace)

No per-token cost means AI runs on **every event by default** — not as a button agents press, but as a background layer processing everything continuously.

---

## Infrastructure

**Subject to change** — specific model names, hosting providers, and serving stacks will be decided when the time comes based on actual load, budget, and what the open-source landscape looks like then. Do not lock anything in early.

**What won't change:**
- A separate server from Railway (Cloud provider TBD) hosts the LLM
- **LiteLLM proxy** sits between the app and whatever model is running — this is the one non-negotiable. It means swapping models, providers, or falling back to Anthropic is a config change, not a code change.
- **pgvector** on the existing Railway Postgres handles vector memory — avoids a separate vector DB as long as scale allows
- The model is replaced by a better open-source option when one becomes available — LiteLLM makes this painless

**The only infrastructure decision to make now:** wrap all current Anthropic calls in LiteLLM. Everything else is decided later.

---

## Data strategy (start now, before [AI-MOD1] is built)

The model is only as good as the data it trains on. From day one, store:

- Conversation transcripts with outcome (resolved / escalated / auto-closed)
- Agent edits to AI-drafted replies (signal: what did the human change?)
- Ticket resolution time + customer satisfaction (from CSAT when built)
- Behavioral events from Sales module (SALES-MOD1)
- Order/shipment events from Track & Trace (TRACK1)

**Schema requirement:** All training data must be stored in a clean, labeled format with `tenant_id` + `outcome` + `timestamp`. Do not retrofit this later — design it into every feature from the start.

---

## Control panel [AI-CTRL]

A dedicated superuser-only page at `/superadmin/cloud-llm`. Every Cloud LLM feature has:
- On/off toggle (globally or per-tenant)
- Description of what it does
- "Test" button — runs the feature against a selected tenant with sample data, shows raw output

**Ship every feature dark.** Toggle on per-tenant as each one is validated. This keeps the product clean for clients while allowing controlled rollout.

---

## MoSCoW — Feature priority

### Must Have — Cloud LLM v1

| Task | Feature | Notes |
|---|---|---|
| #14 | Control panel (superuser only) | Foundation — manage everything from here |
| #2 | Auto-triage & urgency scoring | Immediate visible value on day one |
| #6 | Real-time agent copilot | Daily driver — agents feel it on every reply |
| #5 | Full auto-resolution | Headline feature clients will pay for |
| #18 | Duplicate ticket detection | Works from day one, no data accumulation needed |

### Should Have — Cloud LLM v2

| Task | Feature | Notes |
|---|---|---|
| #25 | Auto-generated customer profiles | Builds the context advantage that compounds |
| #16 | Email tone adjustment | Practical daily value for every agent |
| #15 | Knowledge base auto-generation | Direct ROI — reduces future ticket volume |
| #22 | Ticket deflection suggestions | Easy ROI story for clients |
| #19 | Weekly ROI digest | Retention weapon — see section below |
| #4 | Customer health scoring | High value once data accumulates |
| #8 | Churn prediction | Especially valuable for SaaS clients |

### Could Have — Year 2

| Task | Feature | Notes |
|---|---|---|
| #3 | Incident detection across tenants | Needs ticket volume |
| #11 | Topic clustering & analytics | Good insight but passive |
| #9 | Self-service chatbot per tenant | Big standalone feature, own product thinking needed |
| #10 | Proactive outreach triggers | Powerful but complex to configure |
| #21 | Product feedback extraction | Useful but tenants may not know what to do with it |
| #13 | Embed widget qualification questions | Enhancement to EMBED1, not core LLM |
| #23 | Predictive workload forecasting | Marginal benefit for small SMB teams |
| #17 | Smart reply scheduling | Marginal for SMB |
| #20 | Competitive intelligence tracking | Nice but not core to support |

### Won't Have (now)

| Task | Feature | Why not |
|---|---|---|
| #7 | Cross-tenant pattern learning | Needs scale + complex privacy/data governance |
| #26 | Contract & SLA context (B2B) | Too enterprise/niche for SMB focus |
| #27 | A/B testing reply styles | Too data-science for the market |
| #24 | Automated CSAT surveys | Low differentiation — standalone tools do this better |

---

## Weekly ROI digest [Task #19]

The most powerful retention mechanic in the platform. Every Monday, tenant admins receive:

> **"Yippie saved your team 6.2 hours this week."**

Breakdown:
- X tickets auto-resolved without agent involvement
- X replies drafted by AI (avg. draft-to-send time saved)
- X duplicate tickets caught before agents opened them
- X knowledge base deflections (customers self-served)

**Cumulative line:** "Since you joined Yippie, we've saved your team 312 hours — equivalent to €4,840 in staff time."

This justifies the subscription before the client even logs in. Churn becomes very hard when the tool tells you in euros what it saved you.

**What's needed to make it accurate:**
- `avg_hourly_cost` field on Tenant (ask during onboarding, default €25/hr)
- Track agent handle time per ticket (ticket open → close timestamps, already partially available)
- Count AI auto-resolutions separately from agent-touched tickets
- Count draft assists (agent used AI suggestion vs typed from scratch)

**Feeds the commercial site:** The Hour Counter on getyippie.com becomes real, tenant-specific data instead of an estimate.

---

## The compounding moat

More tenants → more training data → smarter model → better product → more tenants.

No competitor in the SMB space combines:
- Behavioral tracking (Sales module) 
- Order context (Track & Trace)
- Learning AI that's tenant-aware and cost-flat at scale

Intercom has AI — stateless, expensive at scale. Zendesk has tracking — disconnected from the AI. The combination of [SALES-MOD1] + [AI-MOD1] is the moat. Build SALES-MOD1 first so data accumulates while the LLM is being built.

**Volume matters:** At 5 tenants this is a cheaper Anthropic replacement. At 50+ tenants with real conversation history it becomes defensible. Build the Cloud LLM after the data exists to train on.

---

## Build order (post-launch)

1. **[EMBED1] Lead capture embed widget** — Low effort, immediate value, reuses Phase 12 pattern
2. **[SALES-MOD1] Sales module** — Starts accumulating behavioral data
3. **[TRACK1] Track & trace** — Adds order context layer
4. **[AI-MOD1] Cloud LLM** — Now data exists; build the model on top of it
