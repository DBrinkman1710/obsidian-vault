# Yippie Platform — Complete Product Manual

> Last updated: September 2026 (full code audit). Reflects what is built and deployed on sandbox and production.

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Getting Around](#2-getting-around)
3. [Module: Inbox](#3-module-inbox)
4. [Module: Contacts](#4-module-contacts)
5. [Module: Tickets](#5-module-tickets)
6. [Module: Calendar](#6-module-calendar)
7. [Module: Pipeline (Kanban)](#7-module-pipeline-kanban)
8. [Module: Chat (Live Chat)](#8-module-chat-live-chat)
9. [Module: Marketing (Email Campaigns)](#9-module-marketing-email-campaigns)
10. [Module: Billing (Invoices)](#10-module-billing-invoices)
11. [Module: Activity](#11-module-activity)
12. [Module: Tracking (Shipments)](#12-module-tracking-shipments)
13. [Module: Sales (E-Commerce Tracking)](#13-module-sales-e-commerce-tracking)
14. [Module: SaaS (Product Analytics)](#14-module-saas-product-analytics)
15. [Module: Booking (Calendar Scheduling)](#15-module-booking-calendar-scheduling)
16. [Departments](#16-departments)
17. [Settings: Profile](#17-settings-profile)
18. [Settings: Team](#18-settings-team)
19. [Settings: Templates](#19-settings-templates)
20. [Settings: Organisation](#20-settings-organisation)
21. [Subscription & Plans](#21-subscription--plans)
22. [Superadmin: Client Management](#22-superadmin-client-management)
23. [Superadmin: Diagnostics & Operations](#23-superadmin-diagnostics--operations)
24. [Integrations Reference](#24-integrations-reference)
25. [Automation & Background Jobs](#25-automation--background-jobs)
26. [Public Pages (No Login Required)](#26-public-pages-no-login-required)
27. [Security & Access Control](#27-security--access-control)
28. [Module: AI Assistant (Jarvis)](#28-module-ai-assistant-jarvis)
29. [Onboarding & Setup](#29-onboarding--setup)
30. [Module: Flows (Automation Builder)](#30-module-flows-automation-builder)
31. [Module: Contracts (Documents & E-Signing)](#31-module-contracts-documents--e-signing)
32. [Chrome Extension (Inbox Analyser)](#32-chrome-extension-inbox-analyser)

---

## 1. Platform Overview

Yippie is an all-in-one customer service and sales automation platform built for small and medium businesses. It replaces the patchwork of separate inbox, helpdesk, CRM, campaign, and booking tools with a single unified workspace.

### What Yippie Does

- Converts raw inbound emails and WhatsApp messages into structured support tickets using AI — no manual write-up required
- Tracks customer relationships across a full contact timeline (emails, tickets, pipeline stage, bookings)
- Automates follow-up via drip campaigns and pipeline stage moves triggered by customer clicks
- Provides booking links so customers schedule themselves, with automatic confirmation emails
- Tracks shipments, subscriptions, e-commerce events, and product usage all from one place

### Architecture

Yippie runs as a monorepo with two main applications:

- **Platform app** (`apps/app`): the full customer service workspace — FastAPI Python backend, React/TypeScript frontend, PostgreSQL database
- **Marketing site** (`apps/web`): the public `getyippie.com` website — Next.js, no database

Both deploy to Railway. The platform app runs on `sandbox.getyippie.com` (staging) and `app.getyippie.com` (production). The marketing site runs on `getyippie.com`.

### Module System

Every feature in Yippie is packaged as a **module**. All modules are always compiled into the codebase, but each tenant (workspace) has its own set of enabled modules stored in the database. Modules not in a tenant's list are invisible — the sidebar items don't appear and API calls return 403.

The full module list is: `inbox`, `contacts`, `activity`, `flows` (always-on core modules), plus the add-on modules `tickets`, `calendar`, `pipeline`, `booking`, `billing`, `contracts`, `chat`, `departments`, `marketing`, `tracking`, `sales`, `saas`, and `ai` (AI Inbox).

Four modules are **core** and always enabled for every tenant: Inbox, Contacts, Activity, and Flows. Everything else is a paid add-on that a superadmin (or the tenant via Stripe checkout) enables per workspace.

Superadmins can enable or disable modules per tenant at any time from the Superadmin panel — no code change or restart required.

### Plans

| Plan | Monthly | Annual | Seats | AI scans/mo | Flows | Module discount |
|---|---|---|---|---|---|---|
| **Founder** | €9 | €97 | 10 | 500 | 10 | **50% off add-on modules** |
| **Starter** | €19 | €205 | 3 | 2,000 | 3 | — |
| **Growth** | €39 | €421 | 10 | 5,000 | 10 | — |
| **Pro** | €69 | €745 | 25 | 10,000 | 25 | — |
| **Enterprise** | Custom | Custom | Unlimited | Unlimited | Unlimited | — |

All plans include unlimited contacts. "AI scans" are the inbox AI draft generations (they require the AI Inbox add-on). "Flows" is the cap on active custom automations. Founder gets a permanent 50% discount on every add-on module.

Source of truth for all plan and module pricing is `packages/config/modules.json` — edit it and run `pnpm sync:config`.

### Add-On Module Pricing

Core modules (Inbox, Contacts, Activity, Flows) are always included. The add-on modules are priced per workspace per month:

| Module | Price/mo | Notes |
|---|---|---|
| Calendar | €7 | Includes Booking (bundled free) |
| Pipeline | €7 | — |
| Billing | €7 | — |
| Departments | €7 | — |
| Tickets | €9 | — |
| Contracts | €9 | — |
| Live Chat | €9 | Web widget + WhatsApp |
| Marketing | €9 | — |
| Shipment Tracking | €9 | — |
| AI Inbox | €15 | Unlocks all inbox/ticket AI features |
| Sales | €20 | — |
| SaaS Analytics | €20 | — |

Booking has no separate price — enabling **Calendar** includes it.

### Deployment

- **Sandbox** (`sandbox.getyippie.com`): staging environment; deploys from the `sandbox` git branch
- **Production** (`app.getyippie.com`): live environment for real clients; deploys from the `production` git branch
- The two environments have completely isolated databases — data never crosses between them

---

## 2. Getting Around

### Sidebar Navigation

The left sidebar is the main navigation. It shows only the modules enabled for the current tenant. Each item can show a live badge:

- **Inbox** badge: count of pending (unreviewed) messages
- **Chat** badge: count of open (unassigned or in-progress) chat sessions
- **Tickets** badge: count of overdue tickets (past SLA deadline)
- **Calendar** badge: count of pending event invitations you have not yet responded to

The sidebar collapses to icon-only on narrower screens. On mobile, the sidebar is replaced by a **bottom navigation bar** with the most common destinations.

Right-click any sidebar item to access a **Reorder** option — drag module items to change the order they appear in the sidebar.

### Keyboard Shortcuts

| Keys | Action |
|---|---|
| `g` then `i` (within 1 second) | Navigate to Inbox |
| `c` | Open Compose (new outbound email) — when in Inbox |
| `j` / `k` | Move selection down / up in inbox list |
| `r` | Open the focused inbox item |
| `Cmd+Enter` / `Ctrl+Enter` | Send email / reply (in compose windows) |
| `Cmd+K` / `Ctrl+K` | Open Quick Capture popup (AI natural-language input) |

Keyboard shortcuts can be toggled off per user in **Settings → Profile**.

### Impersonation Banner

When a superadmin is impersonating a tenant, an amber banner at the top of the screen shows the tenant name and user email. Clicking **Exit** ends the impersonation session and returns to the superadmin view.

### Demo Banner

When a workspace is in demo mode, a second amber banner shows: "Demo environment — data may be reset at any time." This is informational only and visible to all users in that workspace.

---

## 3. Module: Inbox

The Inbox is the nerve center of Yippie. Every inbound customer message — whether from email or WhatsApp — lands here first as a draft for AI review before becoming a ticket.

### What It Does

Every inbound message is turned into a **draft ticket** the moment it arrives (subject + first lines), so intake never waits on AI. If the workspace has the **AI Inbox** add-on enabled *and* auto-scan turned on, a background job then enriches the draft — reading the message and suggesting a refined subject, priority, description, category, and a short customer briefing. Agents review the draft, edit if needed, and approve with one click. Approved drafts become structured tickets. This eliminates manual ticket write-up entirely.

> **AI note.** The AI features here (auto-scan, Suggest/Improve reply, briefings) are part of the paid **AI Inbox** module (€15/mo) and are hidden when it is disabled. Auto-scan is also **off by default** — until it is switched on, drafts arrive un-scanned and an agent clicks **Generate** to run the AI on demand. The AI provider is **Mistral Small** (EU-hosted, GDPR-safe) by default; Anthropic Claude is an optional fallback.

### Trending Topics

A **Trending** indicator in the Inbox header shows the most common keywords appearing in recent inbound messages — refreshed every 15 minutes. Use it to spot recurring issues (e.g., "delivery delay", "invoice") before opening individual messages.

### Tabs

- **Pending**: Draft tickets awaiting agent review. This is the primary working view.
- **Processed**: Drafts that have been approved (converted to tickets), rejected, forwarded, marked spam, or binned — with sub-filters for each outcome.
- **Sent**: Outbound emails composed and sent from the inbox. Each entry shows delivery status: Sent, Delivered, Opened, or Bounced.

### Shared / Personal Mailbox & Search

- A **Shared / Personal** toggle switches between the whole team's shared mailbox and mail addressed to you.
- A search box filters drafts; when it is empty, **trending topic** chips summarise the most common keywords across recent drafts so you can spot recurring issues at a glance.
- Per-mailbox **unread** counts appear as blue badges.
- A **Scheduled** button lists send-later batches you have queued.

### Draft Review

Clicking a pending message opens the **Draft Review** page. Here you can:

- **Edit the subject line** suggested by AI
- **Change the priority** (Low / Medium / High / Urgent)
- **Link to a contact**: type a name or email to associate the message with an existing contact, or create a new one
- **Assign** the draft to an agent, and/or **route** it to a department
- **View the full original message** body and download any attachments
- **Approve** the draft → opens a Route & Approve step (optionally set a follow-up SLA in days) → creates a ticket
- **Reject** the draft with a reason (thank-you / spam / duplicate / no action) — the reason feeds triage stats
- **Undo review** → revert an approved draft (its ticket is soft-deleted)
- **Generate / regenerate AI scan** (requires AI Inbox) → asks the AI to (re)read the message and produce a fresh suggestion
- **Forward** the draft to a department (sends the customer an auto-reply and forwards the original + attachments to the department email)
- **Clear follow-up date** → remove a previously set follow-up reminder
- **Right-click context menu** on any draft in the list: assign, route to department, move to bin, mark as spam

### Compose (New Outbound Email)

Click **Compose** to open a new outbound email form. Options include:

- **To / CC / BCC** recipients
- **Subject** line
- **Body** with rich text formatting
- **Template picker**: select a pre-built response template to insert
- **Signature picker**: choose from your saved signatures
- **From address**: send as the shared address, a configured alias, or a linked Gmail/Outlook mailbox
- **Attachments**: attach files from your computer (10 MB per file, 25 MB per send)
- **Send later**: schedule the email for a future time (1 minute to 90 days out); manage or cancel queued sends from the **Scheduled** list
- **5-second undo**: after clicking Send, a brief window appears to cancel the send before it goes out

### AI Reply Assist (in Draft Review — requires AI Inbox)

Within the Draft Review page, when composing a reply (only shown when the AI Inbox module is enabled):

- **Suggest reply**: AI reads the inbound message and writes a draft reply, grounded in your knowledge base and tenant AI profile, in the customer's language
- **Improve reply**: AI offers up to three rewrites of your draft to pick from
- These tools work in the reply composer, not on the ticket itself

### Bulk Actions

In the list, select multiple drafts with checkboxes:

- **Assign** → route to a specific agent and/or department
- **Move to bin** → delete drafts
- **Mark as spam** → flag and archive

### Personal Work Inbox

Each agent can switch on **own inbox only** (Settings → Profile) to narrow the shared mailbox to just the mail assigned to them or sent to their personal addresses — useful for focused work.

### Retention

Spam is moved to the bin after 10 working days; the bin is emptied after 20 working days.

### Attachment Download

Messages with attachments show a download link per file. Attachments are stored and retrievable at any time from the draft or the resulting ticket.

---

## 4. Module: Contacts

Contacts is the CRM layer of Yippie. Every customer, lead, or company you interact with lives here.

### What It Does

A contact record holds the full history of a customer: every email exchange, ticket, pipeline stage, booking, and note — all in one place. No switching to a separate CRM.

### Contacts List

The main list view shows all contacts with:

- **Search**: full-text search across name, email, and company
- **Filter by label**: show only contacts with a specific label
- **Filter by company**: show only contacts belonging to a company
- **Filter by tag**: contacts can carry tags (e.g. `order-system`, set by integrations) that you can filter on
- **Import**: upload a CSV, JSON, or XLSX file to bulk-create contacts (name, email, phone, company, notes columns supported; companies are auto-created by name; duplicates deduped by email)
- **CSV export**: download all, filtered, or selected contacts as a CSV
- **Multi-select**: tick contacts to act on several at once (e.g. export the selection)
- **Column picker**: choose which columns appear in the contacts table
- **Context menu** (right-click a row): Send email (opens compose modal directly to this contact)

### Contact Detail

Click any contact to open their detail page, which contains:

- **Profile fields**: full name, email address, phone, company (all inline-editable)
- **Labels**: colored tags applied to this contact (inline-editable)
- **Engagement score**: colored badge (0–100) based on email open/click history — visible when the Marketing module is enabled
- **Pipeline stage**: which Kanban stage this contact is currently in (editable inline)
- **Activity timeline**: chronological log of all platform events for this contact (ticket created/updated, pipeline moves, notes, bookings, etc.)
- **New Ticket button**: opens the New Ticket form pre-filled with this contact's details
- **Send booking link**: open the booking flow directly from the contact record
- **Send email**: compose a new message to this contact
- **Log a call**: open the call modal, paste or dictate what was discussed, and AI structures it into a summary, action items, and a follow-up email draft. Saving logs a `call_logged` activity, appends to the notes, and auto-creates reminders for any future-dated action items.

**Invoicing fields.** A contact record also carries invoicing details used by the Billing module: **BTW-nummer**, street address, postal code, city, and country. (The workspace-level KvK/BTW numbers in Settings → Organisation are separate — they identify *your* company on invoices.)

### Creating and Editing Contacts

Click **New contact** to open the creation form with these fields:

- **Full name** (required)
- **Email** (optional; validated if provided)
- **Phone** (optional)
- **Company** (optional; picked from existing companies)
- **Labels** (optional; assign one or more labels at creation time)
- **Notes** (optional; internal agent notes)

Saving navigates directly to the new contact's detail page.

- **Edit**: click any field in the contact detail view to edit it inline
- **Soft delete**: mark a contact as deleted — they disappear from the list but data is retained
- **Restore**: undelete a soft-deleted contact
- **Permanent delete**: irreversibly remove the contact and all associated data

### Companies

Companies group multiple contacts under one account:

- **Create a company**: give it a name (companies hold a name, optional domain, and notes)
- **Link contacts to a company**: on any contact record, assign a company
- **Filter contacts by company**: see all contacts belonging to an account
- **Bulk delete**: select multiple companies and delete

### Labels

Labels are colored tags used for segmentation:

- **Create a label**: choose a name and color
- **Apply to contacts**: add one or more labels to any contact
- **Filter by label**: in the contacts list, filter to show only labeled contacts
- **Use in campaigns**: audience picker in Marketing uses labels to define campaign recipients

---

## 5. Module: Tickets

Tickets are the structured work items that support agents resolve. Every approved inbox draft becomes a ticket. Tickets can also be created manually.

### What It Does

A ticket tracks a customer issue from creation to resolution, with assignee, priority, SLA deadline, status, and the full conversation thread — all in one place.

### Ticket List

The list view shows all tickets with:

- **Filter by status**: Open, In Progress, Waiting for customer, Resolved, Closed
- **Toggle — Assigned to me**: show only tickets assigned to the current agent
- **SLA badges**: colored deadline indicator — red when overdue, orange when due within 2 days
- **Context menu** (right-click a row): Assign to me, Assign to agent/department, Mark resolved, Close ticket

### Ticket Detail

Clicking a ticket opens a two-column detail page.

**Left column — conversation and reply:**

- **Subject and description**: the AI-generated or manually written summary
- **Comments list**: unified chronological thread of all email replies and internal notes. Email replies are white; internal notes are amber-tinted and labeled "Internal note."
- **Reply tab**: compose and send an email reply to the customer
  - Template picker (select a canned response and insert it into the reply body)
  - Signature picker (choose your email signature)
  - Attach files
  - **Generate reply** button (AI — requires `ai` module): drafts a full reply based on ticket and contact context
  - **Improve reply** button (AI — requires `ai` module): rewrites your current draft with labelled variant suggestions to pick from
- **Internal note tab**: add a private note visible only to agents — not sent to the customer

**Right column — customer panel:**

- **Contact card**: linked customer's name, email, phone, company, labels, and ticket count. Agents can change the linked contact mid-ticket ("Change" button) or open a slide-over panel to edit contact details inline ("View contact")
- **Status / Priority / Assignee / SLA deadline**: edit these fields directly in the right panel
- **AI Briefing card** (requires `ai` module): auto-fetches a customer summary the first time the reply tab is focused. Shows a text briefing plus 2–3 suggested action chips (e.g. "Mark as resolved", "Route to Finance", "Move to Awaiting Payment"). Clicking a chip executes the action immediately.
- **Recent contact history**: last few touchpoints with this customer across all tickets — prior email replies, internal notes, outbound emails, and resolved chat sessions. Each item is expandable inline; email entries link to their originating ticket.
- **Orders**: linked shipment records for this contact
- **Website activity**: Sales module events (page views, add-to-cart, purchases) for this contact
- **Product usage**: SaaS module health score and recent usage events for this contact

**Other actions:**

- **Snooze**: extends the SLA deadline by 24 hours. Only available when the ticket is approaching or past its SLA deadline.
- **Merge**: combine this ticket with another ticket from the same contact

### Creating a Ticket Manually

Click **New ticket** in the ticket list (or navigate to `/tickets/new`) to open the creation form:

- **Subject** (required)
- **Contact** (required; search by name, email, or company)
- **Priority**: Low / Medium / High / Urgent (defaults to Medium)
- **Department** (optional)
- **Description** (optional)

Saving navigates directly to the new ticket's detail page.

### Bulk Actions

Select multiple tickets in the list:

- **Merge**: combine exactly 2 selected tickets (same contact required)
- **Delete**: soft-delete selected tickets (removed from the list, history preserved — not a permanent wipe)

### SLA Deadlines & Escalation (Automatic)

SLA deadlines are set automatically when a ticket is created, based on priority: Urgent = 4h, High = 8h, Medium = 24h, Low = 72h.

- **Sidebar badge**: the Tickets sidebar badge counts tickets approaching or past their deadline. The red/orange thresholds are configurable per workspace (default: orange within 2 days).
- **SLA reminder (every 5 minutes)**: a background job emits a `ticket_sla_due_soon` event roughly 60 minutes before a ticket breaches its deadline. This event feeds the default **escalation Flow**, which steps a ticket's priority up over time (there is no separate "Overdue" status — overdue is a badge colour computed from the deadline).
- **Auto-close (hourly)**: tickets left in **Waiting** status untouched for the configured number of days are closed automatically.

Escalation behaviour lives in Flows (see §30), so you can customise it — for example notify the assigned agent, raise priority, or route to a manager before breach.

---

## 6. Module: Calendar

The Calendar shows a unified view of events, ticket SLA deadlines, and customer bookings on a single monthly grid. Team members can also invite each other to events.

### What It Does

Agents use the calendar to track their schedule alongside their support workload — deadlines, meetings, and teammate invitations in one place.

### Shared / Personal Toggle

A **Shared / Personal** slider at the top of the Calendar page switches between two views:

- **Shared**: all team events visible to everyone in the workspace
- **Personal**: your own personal (private) events, plus any shared or personal events you have been invited to and accepted. Personal events are only visible to you.

If you have pending invitations, the Personal tab shows a badge with the count.

### Calendar Grid

- **Monthly view**: displays the full month with all events and deadlines
- **Event colour**: your own events appear in **blue**; events you were invited to (and accepted) appear in **violet**
- **Ticket deadlines**: SLA due dates appear as coloured entries — red for overdue (≤1 day), orange for due soon (≤2 days)
- **Booking confirmations**: when a customer books a meeting via the booking link, the confirmed slot appears on the calendar automatically
- **Right-click a day**: quick option to create a new event on that date

### Creating Events

Click any day or the **+ New Event** button:

- **Title**: name of the event
- **Date and time**: start and end datetime; optional end date/time
- **All day**: toggles to a full-day event with no time component
- **Visibility**:
  - **Shared (team)**: visible to all team members in the workspace
  - **Personal (only me)**: visible only to you, even in the Shared view of others
- **Description**: optional context or agenda
- **Link to contact**: optionally associate the event with a contact record
- **Link to ticket**: optionally associate with a support ticket
- **Invite teammates**: search and add one or more team members to the event. Each invitee receives an email notification and an in-app invitation they can respond to.

### Editing and Deleting Events

- Click any event to open its detail view
- Edit any field and save
- On the edit form, existing invitees are shown as read-only status chips (Invited / Accepted / Declined / New time proposed)
- Delete the event (no soft delete — this is permanent; also removes all associated invitations)

### Inviting Teammates

When you create an event, you can invite any other team member in your workspace:

1. In the **Invite teammates** field, type a name or email to search
2. Select team members to add — they appear as chips below the field
3. Save the event — each invitee receives an email: "You're invited to: [event title]"
4. The **Invitations** button in the header shows a count of pending invitations across the team

Invitees can only be added at creation time. Existing invitees are shown on the edit form.

### Responding to Invitations

Click the **Invitations** button in the Calendar header to open the Invitations panel. For each pending invitation you see:

- The **event title**, **date and time**, and who organised it
- Three response options:
  - **Accept**: the event is added to your Personal calendar view in violet
  - **Decline**: the invitation is closed; the organiser is notified by email
  - **Propose time**: pick an alternative start and end date/time and send it to the organiser as a counter-proposal

When you respond, the organiser receives an email notification with your response (and any proposed times if you counter-proposed).

### Sidebar Badge

The **Calendar** sidebar item shows a badge when you have pending invitations waiting for a response. The badge clears as soon as you accept or decline each invitation.

---

## 7. Module: Pipeline (Kanban)

The Pipeline is a drag-and-drop Kanban board for tracking contacts through your sales or onboarding process.

### What It Does

Contacts move through custom stages (columns) as they progress — from first touch to closed deal. Marketing campaigns can automatically move contacts between stages when they click action buttons in emails.

### Board View

- Each **stage** is a column on the board
- Each **card** represents a contact in that stage, showing name, email, and how many days they've been in the current stage
- Cards sitting in a stage whose name contains "demo" for **3 days or more** show a **stale** badge (a demo-follow-up nudge). There is no generic all-stages 30-day stale rule.
- **Drag and drop** a card to move a contact to a different stage — the move is saved immediately and marked as a human move
- **Human moves always win**: automations (flows, bookings, tracking) will never override a card you placed by hand

The default stages seeded for a new workspace are New, In Progress, Waiting for Customer, and Resolved.

### Stage Management

Click the gear icon on any stage column, or go to **Settings → Organisation → Pipeline stages**:

- **Create stage**: add a new column with a name and optional color
- **Rename**: change a stage name at any time
- **Reorder**: drag stages left or right to change column order
- **Set color**: choose a color used in the calendar for SLA deadline entries
- **Delete**: remove the stage. ⚠️ Deleting a stage also drops the pipeline entries of any contacts currently in it (the contacts themselves are untouched) — move cards out first if you want to keep their pipeline position.

### Flowchart View

The Pipeline page has a second tab, **Flowchart** — a visual canvas that documents how your pipeline works:

- Drag stage nodes, decision diamonds, and start/end markers onto the canvas and connect them with edges
- An **unplaced stages** tray lists any stages not yet on the chart; the chart auto-reconciles against your live board (deleted stages drop off)
- Yippie reads the flowchart into the Yip assistant's context so it understands your funnel
- **Automation suggestions**: from the edges you draw, Yippie generates draft automations (stage → stage moves) that pre-fill the Flows builder in one click

### Send Campaign from Pipeline

When a campaign has been linked to a pipeline stage (configured in the campaign's **Actions** tab), a context menu appears on that stage column:

- **Right-click** the stage column header → **Send campaign**
- A popup shows the linked campaign name, a preview, and the recipient count (all contacts currently in that stage)
- Click **Send** to dispatch the campaign to those contacts immediately

This allows targeted outreach to every contact at a specific point in your funnel — for example, emailing everyone in "Demo requested" with a personalised follow-up.

### Bulk Move

Select multiple contact cards with checkboxes:

- **Move to stage**: shift all selected contacts to a different stage at once

---

## 8. Module: Chat (Live Chat)

Chat provides a live messaging channel directly embedded on your website, plus WhatsApp integration — all conversations appear in the same workspace.

### What It Does

Visitors on your website can open a chat widget and message your team in real time. WhatsApp messages from customers also land here. All sessions are managed from the Chat module — no separate apps needed.

### Session List

The session list has three tabs:

- **Mine**: sessions assigned to the current agent
- **Open**: unassigned sessions waiting to be claimed
- **All**: every active session across the team

Each session card shows the contact name (if matched), the channel (web or WhatsApp), the last message preview, and the time since the last message.

### Claiming and Assigning Sessions

- Click **Claim** on any open session to take ownership
- Click **Assign** to route a session to a specific agent
- Agents see only their assigned sessions in **Mine**

### Chat Session Detail

Open a session to see the full conversation thread:

- **Message input**: type and send text replies
- **Canned responses**: type `/` to open a picker and insert a saved canned response
- **Media attachments**: send images or documents (up to 16 MB; WhatsApp and web widget)
- **Internal note**: add a private note visible only to agents — never sent to the customer or WhatsApp
- **Create contact**: turn an unknown web/WhatsApp visitor into a contact record
- **Chat history**: view this contact's past conversations inline
- **Create ticket**: convert this chat session into a support ticket (session status becomes "ticket")
- **Send booking link**: send a booking invitation link directly in the chat
- **Delivery receipts** (WhatsApp): messages show sent / delivered / read status as they progress
- **Claim / Assign**: opening an unassigned open session auto-claims it to you; you can also assign it to any agent
- **Solve / Reopen**: mark the session solved (it hides after the configured delay) or reopen it

### WhatsApp Pairing

To enable WhatsApp, a superadmin or admin connects the WhatsApp account:

1. Go to the **Chat** settings (accessible from the superadmin panel or team settings)
2. A QR code is displayed — scan it with the WhatsApp mobile app
3. Once paired, inbound WhatsApp messages appear in the Chat session list alongside web chat sessions

### Broadcast WhatsApp Message

From the Chat module, admins can send a message to multiple WhatsApp contacts at once:

- Select contacts or filter by label
- Compose the message
- Optionally **append a booking link** to the broadcast — a unique booking URL is generated per recipient and appended to the message automatically
- Send — each contact receives it as a direct WhatsApp message from your number

### Bulk Actions

Select multiple sessions:

- **Close**: batch-close (solve) open sessions
- **Reopen**: reopen closed sessions
- **Delete**: remove sessions

### Chat Settings & Reset

In team settings, configure:

- **Hide solved sessions after N hours**: solved sessions disappear from the list after the configured time (default 72h)

Admins also have a **Reset Live Chat** action that disconnects WhatsApp and wipes all sessions — useful when re-pairing a number or clearing test data.

### Live Chat Widget Embed

To embed the chat widget on any website, add one script tag:

```html
<script
  src="https://app.getyippie.com/widget.js"
  data-token="YOUR_WIDGET_TOKEN"
  async>
</script>
```

The widget:
- Appears as a chat bubble in the bottom-right corner
- Opens a chat panel when clicked
- Persists the session across page loads using a browser session ID
- Connects to the platform via WebSocket for real-time messaging (keyed to your workspace slug)
- Widget appearance and behaviour are configured in **Settings → Team → Widget settings**

---

## 9. Module: Marketing (Email Campaigns)

Marketing is a full email campaign builder with drag-drop design, audience segmentation, A/B testing, drip sequences, and pipeline automation — all built into the workspace.

### What It Does

You design an email, pick an audience, and send it. Contacts who click specific buttons in the email automatically advance to the next pipeline stage — no manual CRM update required. Opens, clicks, and unsubscribes are tracked in real time.

### Campaign List

- **Create campaign**: starts a new blank campaign draft — choose **Email** or **WhatsApp** as the delivery channel
- **Duplicate**: copy an existing campaign to reuse its design and settings
- **Delete**: only draft campaigns can be deleted; sent campaigns are read-only

### Email vs WhatsApp Campaigns

When creating a campaign, select the channel:

- **Email**: sends via Resend using the GrapesJS visual HTML editor. Supports open tracking, click tracking, drip sequences, and A/B testing.
- **WhatsApp**: sends via Evolution API. Compose a plain-text message; each recipient receives it as a direct WhatsApp message from the connected WhatsApp number.

### Campaign Detail — Tabs

Each campaign has six tabs:

#### Design Tab

- **GrapesJS email editor**: drag-and-drop blocks (text, image, button, divider, spacer)
- **Style panel**: set fonts, colors, padding, and backgrounds for any block
- **Personalization tokens**: insert `{{first_name}}`, `{{company}}`, etc. — filled from the contact record at send time
- **Yippie Button component**: a special CTA button block that can be linked to a pipeline stage (see Actions tab). Each button has a stable UUID used for click tracking.
- **Preview mode**: see how the email looks rendered
- **Test send**: send the current design to your own email address for review

#### Actions Tab

The Actions tab connects the campaign to your pipeline automation:

- **Mail sent → stage**: when this campaign is dispatched, move all recipients to a specified pipeline stage
- **Reply received → stage**: if a contact replies to this campaign email, automatically move them to a specified stage
- **Per-button action**: each **Yippie Button** in the email design can carry an action. Tracked actions move the contact to a pipeline stage or apply a label when clicked; direct-link actions open a website, start an email, or dial a phone number. Buttons are listed by label.
- **Linked Kanban stage**: link this campaign to a pipeline stage column. When linked, the **Send campaign** option appears in the right-click menu of that stage on the Pipeline board — allowing you to send this campaign to all contacts in that stage with one click.

#### Audience Tab

Define who receives the campaign:

- **All contacts**: every contact in the workspace
- **By label**: contacts with a specific label
- **By company**: contacts belonging to a specific company
- **By pipeline stage**: all contacts currently in a Kanban stage
- **Engagement score filter**: optionally restrict to contacts above a minimum engagement score (0–100, based on past email opens and clicks, decays 10% monthly)

#### Schedule Tab

- **Send now**: dispatch the campaign immediately when you click Send
- **Schedule for later**: pick a future date and time; the campaign scheduler processes it automatically

#### Analytics Tab

After sending, the analytics tab shows live metrics:

- **Sent count**: total recipients
- **Open rate**: percentage who opened the email (tracked via a pixel)
- **Click count**: total clicks across all links and buttons
- **Per-button click count**: individual click totals for each Yippie Button
- **Bounce count**: emails that could not be delivered
- **Unsubscribe count**: contacts who clicked Unsubscribe

#### Drip Sequences

Add follow-up emails to the campaign:

- Click **Add drip step** and set a **day delay** (e.g., 3 days after the previous email)
- Design the follow-up email using the same GrapesJS editor
- The campaign scheduler sends each drip step to contacts who have not yet replied
- Add as many drip steps as needed; each can have its own subject, body, and delay

### A/B Testing

- Click **Add variant** to create a second version of the campaign email (variants A and B)
- On launch, the campaign is split **50/50**: the first half of the audience is split evenly between A and B (the split percentage is not configurable)
- After 2 hours, the system automatically picks the winner **by open rate** and sends the winning version to the held-back second half of the audience

### Unsubscribes

- View the list of contacts who have unsubscribed
- Click **Re-enable** on any contact to re-add them to the mailing list (use carefully — only with explicit consent)

### How Tracking Works

- **Opens**: a 1×1 pixel image in the email body; loading the email loads the pixel and records the open
- **Clicks**: all links and Yippie Buttons go through a click-tracking redirect that records the click, then forwards to the destination
- **Reply matching**: inbound emails are matched to a campaign by the sender's email address (looked up against the campaign's recipients); a match triggers the reply-received stage move
- **Reply classification**: matched replies are AI-classified as Interested, Opt-out, Out of office, or Other. An Opt-out automatically unsubscribes the contact; others can move the contact to the configured reply stage.
- **Bounce suppression**: bounced addresses are recorded and automatically skipped on future sends. Unsubscribed contacts are always skipped, and every send includes List-Unsubscribe headers and a one-click unsubscribe footer.

### Transactional Email Tracking

The Marketing module also surfaces an **Outbound** view listing tracked one-off/transactional emails (ticket replies and other agent sends) with their delivery and open status.

---

## 10. Module: Billing (Invoices)

Billing lets you create, send, and track invoices directly from the workspace — no separate billing tool needed.

### What It Does

Create invoices with line items, send them to customers by email, record payments, and export for your accountant. Dutch KvK and BTW numbers are supported natively, and the PDF is Dutch-labelled (Factuurnummer / Factuurdatum / Vervaldatum).

**Compliance — issued invoices are locked.** Once an invoice is *issued* it claims its number and can no longer be edited or deleted. The lawful way to correct or reverse an issued invoice is a **credit note**, which Yippie generates for you. You can also **issue** an invoice (finalise + lock the number) without emailing it.

**Invoice templates.** Build reusable invoice templates in a block editor with merge fields and a live PDF preview, and set a default template for new invoices.

### Invoice List

- **Search**: find invoices by contact name, invoice number, or amount
- **Filter by contact**: show all invoices for a specific customer
- **Status badges**: Draft, Sent, Paid, Overdue
- **Bulk delete**: select multiple invoices and delete
- **CSV / XLSX export**: download the invoice list as CSV or Excel
- **CSV / XLSX import**: upload a CSV or Excel file (using the provided template) to bulk-create records

### Creating an Invoice

Click **New Invoice**:

- **Contact picker**: link the invoice to a contact in your workspace
- **Invoice number**: auto-generated or manually set
- **Issue date** and **due date**
- **Currency**: select the currency for this invoice
- **Line items**: add rows with description, quantity, unit price, and VAT rate
- **Notes**: add a footer note or payment instructions
- **Save as draft** or **Send** (sends the invoice to the contact's email address)

### Recording a Payment

On any invoice:

- Click **Record payment**
- Enter the payment date and amount
- The invoice status updates to **Paid**

### Sending a Payment Reminder

On any invoice with status **Sent** or **Overdue**:

- Click **Send reminder**
- Yippie sends a follow-up email to the contact with the invoice details and a polite payment reminder

### Subscriptions

A basic subscription management view is available:

- **Create a subscription**: link a contact to a recurring plan with a monthly or annual amount
- **List subscriptions**: view all active recurring plans

---

## 11. Module: Activity

Activity gives you a real-time view of everything happening across your workspace — both a high-level KPI dashboard and a per-contact timeline.

### What It Does

Every action in the platform — email sent, ticket created, contact moved, booking confirmed — is logged as an activity event. The Activity module surfaces these in a chronological feed and aggregated dashboard.

The Activity page has three tabs: **Overview**, **Users**, and **Automation**. The Users and Automation tabs are visible to admins and superadmins only.

### Activity Feed (Overview tab)

- **Chronological log**: every action across the platform in order of occurrence, showing who did it and when
- **Filter by pipeline stage**: chips at the top of the feed narrow it to activity for contacts in a given stage
- Rows are informational (they show the actor and a plain-language description of the event)

### Users & Automation Tabs (admin)

- **Users**: deep per-agent KPIs with sparklines and week-over-week deltas — emails sent, open rate, time-to-open (shared vs personal), tickets created/open/resolved/reopened, First Time Right, average resolution time, first-response time, and chats handled/solved.
- **Automation**: statistics on your flows and automations.

### KPI Dashboard (Overview tab)

The dashboard at the top of the Overview tab shows aggregated stats:

- **Pipeline breakdown**: contact counts per stage
- **Ticket stats**: open, resolved, overdue counts and trends
- **Contact growth**: new contacts over time
- **Email stats**: outbound sent, delivered, opened, bounced, and open rate

The dashboard refreshes automatically every 60 seconds.

### Per-Contact Activity Timeline

On any **Contact Detail** page, the **Activity** section shows the full history for that specific contact:

- Every email sent to or received from them
- Every ticket created for them
- Every pipeline stage move
- Every booking confirmed
- Every note added by an agent

---

## 12. Module: Tracking (Shipments)

Tracking brings carrier shipment data into the workspace so agents see delivery status alongside the customer's tickets and messages — without switching to a carrier portal.

### What It Does

Add a tracking number to a contact or ticket and get live carrier status updates inside Yippie. Sendcloud integration pulls updates automatically via webhook.

### Shipment List

- **Filter by status**: Registered, In Transit, Out for Delivery, Delivered, Exception, Returned, Cancelled
- **Filter by carrier**: PostNL, DHL, DPD, UPS, FedEx (plus Sendcloud / Other)
- **Search**: find a shipment by tracking number or contact name

### Creating a Shipment

Click **New Shipment**:

- **Contact**: link to the customer this shipment belongs to
- **Tracking number**: enter the carrier tracking number
- **Carrier**: select the carrier (PostNL, DHL, DPD, UPS, FedEx, or Other)
- **Estimated delivery date**: optional manual entry
- **Linked ticket**: optionally associate with a support ticket

### Shipment Detail

Open a shipment to see:

- **Event timeline**: chronological list of carrier scan events (e.g., "Departed sorting facility", "Out for delivery", "Delivered")
- **Current status badge**: the most recent carrier status
- **Contact link**: jump to the customer's contact page
- **Ticket link**: jump to the associated ticket

### Sendcloud Integration

When Sendcloud is connected (via API key + secret in the **Shipment settings** modal on the Tracking page):

- Shipment status updates are received automatically via webhook — no manual refresh needed
- Status transitions (In Transit → Delivered, etc.) appear in the event timeline in real time
- You can also **Refresh** a single shipment on demand to pull its latest status from Sendcloud

### ERP Order Webhook

Yippie exposes a generic orders endpoint that external ERP systems can post to:

- The ERP sends order data (contact email, tracking number, carrier) to the webhook URL
- Yippie automatically creates a Shipment record and links it to the matching contact
- Webhook requests are authenticated with an HMAC-SHA256 signature using a shared secret

**Contact synchronisation**

When an order arrives, Yippie automatically keeps your contact list in sync:

- If a contact with that email already exists, Yippie fills in any blank name or phone fields from the order — it never overwrites data you already have.
- If no matching contact is found, Yippie creates one automatically using the name, email, and phone from the order. New contacts receive the tag `order-system` so you can identify their origin.
- The shipment is then linked to this contact in either case.

### Settings

- **Sendcloud API key + secret**: enter in the Tracking page's **Shipment settings** modal to enable automatic status sync
- **Webhook secret rotation**: generate a new secret for the ERP webhook; old secret immediately invalidated

---

## 13. Module: Sales (E-Commerce Tracking)

Sales lets you track what your contacts do on your storefront — page views, add-to-cart events, and purchases — and surface that intent data alongside your support conversations.

### What It Does

Embed a small JavaScript snippet on your e-commerce site. It sends product events to Yippie and matches them to known contacts by email. Agents can see what a customer has viewed or purchased without asking.

### Embed Snippet

Add this to your storefront's `<head>`:

```html
<script
  src="https://getyippie.com/sales.js"
  data-token="YOUR_SALES_TOKEN"
  async>
</script>
```

The snippet fires events automatically on page views. For cart and purchase events, call:

```js
window.yippie('track', 'add_to_cart', { product: 'Pro Plan', amount: 49 });
window.yippie('track', 'purchase', { product: 'Pro Plan', amount: 49 });
```

### Sales Dashboard

- **Pageviews**: total tracked product/page views (with a sparkline trend)
- **Purchases**: total tracked purchase events (with a sparkline trend)
- **Conversion %**: purchases relative to pageviews
- **Top pages**: the most-viewed pages
- **Signals**: a `signup` event fires the `saas_signup` flow trigger so you can automate on high-intent activity

### Per-Contact Event Feed

On any **Contact Detail** page, the Sales section shows:

- Every product page view by this contact
- Add-to-cart events with product name
- Purchase events with amount and date

Agents can use this to see purchase history before responding to a support query.

### Token Rotation

- Click **Rotate token** in the Sales settings
- A new `data-token` is generated immediately
- The old token stops accepting events; update the snippet on your storefront

---

## 14. Module: SaaS (Product Analytics)

SaaS tracks how contacts use your software product — logins, feature usage, and errors — and computes a health score so you can spot at-risk users before they churn.

### What It Does

Embed a snippet in your SaaS application. It sends usage events to Yippie. The platform aggregates these into a health score per contact and a dashboard showing onboarding progress, at-risk users, and the most-used features.

### Embed Snippet

Add to your SaaS app:

```html
<script
  src="https://getyippie.com/saas.js"
  data-token="YOUR_SAAS_TOKEN"
  async>
</script>
```

Then fire events:

```js
window.yippie('track', 'login', { user_email: 'user@example.com' });
window.yippie('track', 'feature_used', { feature: 'reports', user_email: 'user@example.com' });
window.yippie('track', 'export', { user_email: 'user@example.com' });
window.yippie('track', 'error', { error: 'export_failed', user_email: 'user@example.com' });
```

### Health Score

Each contact gets a score from 0–100, recomputed hourly, weighting three signals:

- **Login/usage recency** (40%): active recently = higher score
- **Feature breadth** (40%): more distinct features used in the last 30 days = higher score
- **Error penalty** (20%): recent errors subtract from the score

Bands: ≥70 green, ≥40 amber, below 40 red. A drop in a contact's score fires the `saas_health_dropped` flow trigger.

### SaaS Dashboard

- **Onboarding completion %**: percentage of tracked contacts who have fired an onboarding-step event
- **At-risk count**: contacts with a health score below 40 (a fixed threshold)
- **Top features**: which features are used most across all contacts
- **Common errors**: which errors appear most frequently

Admins also receive a Monday-morning email digest of the at-risk customer list.

### Token

The SaaS token is the same as the Sales token — one token covers both modules (the same snippet file works for both).

---

## 15. Module: Booking (Calendar Scheduling)

Booking lets contacts schedule meetings with you by clicking a link and picking a time — confirmation emails go out automatically.

### What It Does

Instead of back-and-forth emails to find a meeting time, send a booking link. The contact sees your availability and picks a slot. The booking appears on your Calendar automatically.

### Booking Settings

Booking is configured at the workspace level by an admin (Booking settings):

- **Work hours / weekly slots**: when you are available to be booked
- **Slot length** and **timezone** (default Europe/Amsterdam)
- **Booking window**: how many days in the future slots are offered
- **Minimum notice**: how far ahead a customer must book
- **Cancel/edit lock**: how many hours before a booking a customer can no longer change it
- **Assignment mode**: *pooled* (any free worker) or *auto-assign* (locks one worker's availability)
- **Booking direction**: *availability* (you send links, customers pick a slot) or *requests* (customers propose times you fulfil)

**Moving the contact after a booking** is no longer a single global setting. Instead, build a Flow on the `booking_created` trigger to move the contact to a stage (see §30), and/or set a **per-send stage override** when you send a specific booking link.

### Sending a Booking Link

From a **Contact Detail** page or a **Ticket Detail** page:

- Click **Send booking link**
- Choose **open link** (customer picks any free slot) or **propose slots** mode, add a message, optionally set a **pipeline stage override**, and pick which address it sends from
- A unique, time-limited booking URL is generated and emailed; you can also bulk-send to several contacts at once

### Public Booking Page

When the contact opens the link (`/book/:token`):

- They see a calendar grid with your available slots
- They click a slot to select it
- They enter their name and any notes
- They confirm — a confirmation email goes to both them and you
- The booking appears on your **Calendar**

### Counter-Propose Mode

Instead of sending a booking link, you can propose specific slots:

- Click **Propose times** on a contact or ticket
- Select 2–5 available slots from your calendar
- A link is generated that shows only those proposed slots to the contact
- The contact picks one and confirms

### Booking Confirmation

When a booking is confirmed:

- The contact receives an automatic confirmation email with the date, time, and any notes
- You receive a notification
- The event appears on the **Calendar** module
- If a `booking_created` flow or a per-send stage override applies, the contact moves to that pipeline stage automatically

### Manage Booking Page

The contact can manage their booking via the link in their confirmation email (`/book/manage/:manageToken`):

- **Reschedule**: pick a new slot
- **Cancel**: cancel the booking — both parties are notified

### Meet Page (Direct Booking Without Token)

Each **workspace** has a permanent public booking URL: `/meet/:slug` (the slug is your workspace slug, not a personal one). This is a persistent link you can share on your website or email signature — no per-contact token required. A customer picks a slot and Yippie assigns an available worker from the pool (falling back to a workspace admin). Bookings made through `/meet` are serialised so two customers can't grab the same slot.

### Requests Direction (Customer Proposes Times)

If the workspace uses the **requests** booking direction, customers instead visit `/request/:slug`, propose times that suit them, and submit a request. An admin **dispatcher** then assigns the request to a worker, or workers **self-claim** open requests — depending on the fulfilment setting. Workers manage their own bookable hours from their availability page.

### Calendar Sync — Blocking External Busy Times

If you use Apple Calendar, Microsoft Outlook, or any other calendar app alongside Yippie, you can connect your external calendars so that busy times from those apps are automatically blocked in your Yippie booking availability. Customers will not be able to book a slot that overlaps with an event in your external calendar.

Yippie fetches your external calendar feeds every 5 minutes and caches the busy windows. The block is also enforced at confirm time — if a slot becomes occupied between the availability check and the customer confirming, the booking is rejected.

See **Settings → Profile → Connected Calendars** to set this up.

---

## 16. Departments

Departments let you organise your team into groups and automatically route incoming messages to the right people.

### What It Does

Create a "Support" department and a "Sales" department, add agents to each, and set up inbound email routing. Tickets and chats go to the right department without manual triage.

### Creating a Department

Go to **Settings → Team → Departments**:

- Click **New Department**
- **Name**: e.g., "Customer Support", "Sales", "Finance"
- **Email address**: the inbound email address that routes to this department (e.g., `support@yourdomain.com`)
- **SLA working days**: a per-department target figure (note: actual ticket SLA deadlines are computed from ticket priority — see §5 — not from this field)
- **Default reply template**: optionally pick a template that pre-fills when agents reply to tickets routed to this department

The tenant-wide **deadline red/orange thresholds** that colour the Tickets sidebar badge are also managed here (Departments → deadline settings).

### Adding Members

- Click **Manage members** on a department
- Search for and add agents from your team
- Agents can belong to multiple departments

### Inbound Email Routing

When an email arrives at a department's address:

- The inbox draft is automatically tagged with that department
- The draft appears in the Inbox for that department's agents
- Tickets created from it are automatically assigned to the department

### Module Access per Department

Which modules exist for a workspace is set per tenant (superadmin). On top of that, the RBAC permissions matrix (Settings → Team) lets you set a per-department **access level** for each module — Full, View, or Restricted — so, for example, the Finance department can be given Full access to Billing but Restricted access to Pipeline. Access resolves most-restrictive across a user's departments.

---

## 17. Settings: Profile

Profile settings are personal — they apply only to the currently logged-in user, not the whole team.

### Email Address

- **Inbound address**: the email address from which you receive messages routed to you personally
- **Send-from address**: the address that appears in the **From** field of outbound emails you send

### Email Signatures

Manage your personal email signatures:

- **Create**: click **Add signature**, enter a name, and write the signature body (rich text supported, including images)
- **Edit**: update any signature at any time
- **Reorder**: drag signatures to change the order; the top signature is the default
- **Set default**: mark one signature as the default — it pre-fills in the reply composer
- **Delete**: remove a signature permanently

### Keyboard Shortcuts

- **Toggle**: enable or disable keyboard shortcuts for your account. When disabled, the `g→i` navigation shortcut does not fire.

### Personal Work Mode

- **Own inbox only**: when enabled, you see only your personally assigned messages in the Inbox — team messages are hidden. Useful for focused work without distractions from the full shared queue.

### UI Language

Choose your interface language — **English** or **Dutch (Nederlands)**. The app UI re-renders immediately, and Yippie's outbound system emails follow your chosen language.

### Change Password

- Enter your current password, then your new password (minimum 8 characters), and confirm.

### Linked Personal Mailbox (Gmail / Outlook OAuth)

Connect your personal Gmail or Microsoft Outlook account so Yippie can sync your inbound email and let you send replies directly from your own address.

**How to connect:**

1. Go to **Settings → Profile → Linked personal mailbox**
2. Click **Connect Gmail** or **Connect Outlook**
3. You are redirected to Google or Microsoft's consent screen — sign in and approve the requested permissions
4. Yippie stores your tokens securely (Fernet-encrypted) and begins syncing your inbox immediately

**What permissions are requested:**

| Provider | Scopes | Used for |
|---|---|---|
| Gmail | `gmail.readonly`, `gmail.send` | Read inbound messages, send replies |
| Outlook | `Mail.Read`, `Mail.Send` | Read inbound messages, send replies |

No calendar permissions are requested — this connection is for email only.

**Token refresh:** Access tokens expire after 1 hour and are refreshed automatically in the background. If your token is ever revoked (e.g. you revoked Yippie's access from your Google account settings), the mailbox shows an error badge and you will need to reconnect.

**Disconnecting:** Click **Disconnect** in the linked mailbox card. Yippie will attempt to revoke the token with the provider and then delete the stored credentials. No emails are deleted.

You can connect one Gmail account and one Outlook account simultaneously.

---

### Connected Calendars (Import)

Connect your Apple Calendar, Microsoft Outlook, or any iCal-compatible calendar so that your external busy times are automatically blocked from your Yippie booking availability.

**How to connect:**

1. Go to **Settings → Profile → Connected Calendars**
2. Click **Add calendar**
3. Give it a name (e.g. "Apple Calendar" or "School Outlook") and paste the iCal feed URL
4. Click **Add** — Yippie immediately syncs the feed

**Where to find your iCal URL:**
- **Apple Calendar**: right-click a calendar in the sidebar → **Share Calendar** → **Copy Link** (the URL starts with `webcal://` — paste it as-is)
- **Microsoft Outlook**: Calendar settings → **Shared calendars** → **Publish a calendar** → copy the ICS link

Once connected, the feed is refreshed every 5 minutes. A green badge shows when it last synced successfully; a red badge shows if there was a fetch error. You can disable a feed temporarily with the toggle, or remove it with the unlink button. You can connect up to 5 feeds per account.

### Your Yippie Calendar Feed (Export)

Yippie generates a personal `.ics` feed URL that you can subscribe to in Apple Calendar or Outlook. This lets your Yippie events and confirmed bookings appear alongside your other calendars — read-only, auto-refreshing.

**How to subscribe:**

1. Go to **Settings → Profile → Your Yippie Calendar Feed**
2. Copy the feed URL
3. In **Apple Calendar**: File → New Calendar Subscription → paste the URL
4. In **Outlook**: Add Calendar → From internet → paste the URL

The feed includes all calendar events you created or accepted, plus confirmed bookings where you are the agent. If you ever need to invalidate the URL (e.g. after accidentally sharing it), click **Regenerate URL** — all existing subscriptions using the old URL will stop receiving updates.

---

## 18. Settings: Team

Team settings are workspace-wide — admins and superadmins can change them.

### Team Mailbox (Gmail / Outlook OAuth)

Connect a shared Gmail or Microsoft Outlook account as the team's central inbox so inbound email from customers is automatically picked up by Yippie.

**How to connect:**

1. Go to **Settings → Team → Team mailbox**
2. Click **Connect Gmail** or **Connect Outlook**
3. Sign in with the shared mailbox account and approve the permissions
4. Yippie begins syncing — new inbound messages appear in the Inbox within seconds

The team mailbox works the same way as a personal linked mailbox but is shared across the whole team. All agents see messages from the shared mailbox in the Inbox. Only admins can connect or disconnect the team mailbox.

If the team mailbox token is revoked or expires, an error badge appears in Settings → Team and inbox syncing pauses until the mailbox is reconnected.

---

### Team Members

- **Invite**: click **Invite member**, enter their name and email, and choose a role. They receive an email with a one-time invite link (valid for 7 days).
- **Edit**: change a member's name, role, or department assignments
- **Deactivate**: suspend a member's access without deleting their data; tickets and messages they handled remain intact
- **Delete**: permanently remove a member

### Roles

| Role | Access |
|---|---|
| **Admin** | Full access to all settings, team management, and all modules |
| **Agent** | Access to enabled modules; cannot change team or billing settings |
| **Viewer** | Read-only access to modules; cannot create, edit, or delete anything |
| **Worker** | Contract worker; restricted from all modules — can only reach their own booking-availability screen |

### RBAC (Custom Roles)

Beyond the three built-in roles, admins can create **custom roles** with per-module access levels:

- **Full**: can create, edit, delete, and view everything in the module
- **View**: can read data but not modify it
- **Restricted**: no access to the module (same as if the module were disabled)

Create a custom role, set the access level for each module, and assign it to team members.

### Branding

- **Workspace name**: displayed in the app header and email footers
- **Primary color**: accent color used throughout the UI (hex code)
- **Logo URL**: your company logo shown in the sidebar and outbound emails

### Resend Domain Configuration (Superadmin)

A custom email sending domain lets outbound emails come from `@yourdomain.com` instead of Yippie's shared domain. This is provisioned by a **superadmin** (from the tenant's edit modal), not self-served from Team settings:

1. The superadmin adds your domain, which Yippie provisions with Resend
2. Yippie returns the DNS records to add (SPF, DKIM, DMARC)
3. You add the DNS records at your domain registrar
4. The superadmin clicks **Verify** — Yippie checks DNS and marks the domain verified
5. Outbound emails now send from your domain

---

## 19. Settings: Templates

Templates is the shared library of pre-written email responses and campaign designs available to everyone on the team.

### What It Does

Build a library of canned responses for your most common questions. Agents pick a template in one click when replying to a ticket — no rewriting the same answer from scratch.

### Template Library

- **Browse**: see all templates with name and preview
- **Search**: find templates by name or content
- **Duplicate**: copy a template to use as a starting point for a new one
- **Delete**: remove a template (can't be undone)

### Creating a Template

Click **New Template**:

- **Name**: internal label (not shown to customers)
- **Subject line**: pre-filled subject for use in outbound emails
- **Body**: use the **GrapesJS email editor** (same drag-drop builder as the Marketing module)
  - Add text blocks, images, buttons, dividers
  - Apply fonts, colors, and padding via the style panel
  - Insert **personalization tokens**: `{{first_name}}`, `{{company}}`, etc.
  - Add **Yippie Buttons** (CTA buttons that can be linked to pipeline stages in campaigns)

### Personalization Tokens

Tokens available in templates and campaigns:

| Token | Replaced with |
|---|---|
| `{{first_name}}` | Contact's first name |
| `{{last_name}}` | Contact's last name |
| `{{full_name}}` | Contact's full name |
| `{{email}}` | Contact's email address |
| `{{company}}` | Contact's company name |

At send time, Yippie substitutes these with the actual values from the contact record.

---

## 20. Settings: Organisation

Organisation settings apply to the whole workspace — billing information, pipeline configuration, and integration credentials.

### Company Information

- **KvK-nummer**: Dutch Chamber of Commerce registration number — shown on invoices
- **BTW-nummer**: Dutch VAT number — shown on invoices

### Pipeline Stages

Pipeline stages can be managed here as well as from the Pipeline board itself:

- **Create**: add a new stage with a name and optional color
- **Rename**: change a stage name
- **Reorder**: drag to change the column order on the Pipeline board
- **Delete**: remove a stage (contacts in it must be moved first)

### Live Chat Settings

- **Hide solved sessions after N hours**: set how many hours after a session is resolved before it disappears from the chat list

### Sendcloud Credentials

- **API key**: enter your Sendcloud API key to enable automatic shipment status sync
- Once entered, Yippie registers a webhook with Sendcloud to receive real-time status updates

---

## 21. Subscription & Plans

The Subscription page manages your Yippie plan and billing.

### Free Trial

Every new workspace starts with a **30-day free trial** on the Growth plan. No credit card is required to sign up.

During the trial:
- All Growth plan features are available in full
- The trial expiry date is shown on the Subscription page
- A banner reminder appears in the app as the trial end date approaches, and nudge emails go out around day 23 and day 28

**When the trial expires without a paid plan**, the workspace is locked rather than silently downgraded: users can still log in, but a blocking **subscribe** modal appears and module APIs return a "subscription required" response until a plan is purchased. No data is lost — choosing a plan immediately unlocks everything. (There is no free tier; Founder is a €9/mo paid plan.)

To continue seamlessly, click **Upgrade** on the Subscription page before the trial expires and complete Stripe checkout.

### Plan Cards

Each plan shows:

- **Name**: Founder, Starter, Growth, Pro, Enterprise
- **Price**: monthly or annual rate in euros (annual is discounted — see §1)
- **Seat limit**: maximum number of team members
- **AI scan limit**: maximum inbox AI scans per month
- **Current plan indicator**: your active plan is highlighted

At checkout you choose the **billing interval** (monthly or annual) and can add paid **modules** to the subscription. On the Founder plan, add-on modules are discounted 50%. Click **Upgrade** on any plan to proceed to Stripe checkout.

### AI Scan Usage Meter

A usage bar shows how many AI scans you have used this month versus your plan limit. When you approach the limit, a warning appears. When the limit is reached, new inbound messages are stored but not AI-scanned until the next billing period or an upgrade.

### Stripe Checkout and Billing Portal

- **Upgrade / downgrade**: clicking a plan opens Stripe checkout for payment
- **Billing portal**: click **Manage billing** to open the Stripe customer portal — change payment method, view invoices, or cancel

---

## 22. Superadmin: Client Management

Superadmins have a dedicated panel at `/superadmin/clients` for managing all tenant workspaces on the platform.

### Tenant List

- **Filter tabs**: All / Active / Demo / Inactive
- Each row shows tenant name, slug, creation date, status, and enabled module count
- **Search**: find a tenant by name or slug

### Creating a Tenant (5-Step Wizard)

Click **New Tenant** to open the creation wizard:

1. **Name & Slug**: workspace name and URL slug (e.g., `acme-bv` → `sandbox.getyippie.com/acme-bv`)
2. **Modules**: choose which modules to enable for this tenant
3. **Branding**: set primary color, logo URL, and workspace display name
4. **Admins**: enter the email and name of the initial admin user (an invite email is sent)
5. **Demo settings**: optionally mark as a demo tenant with an expiry date (demo tenants are automatically deactivated after expiry)

### Editing a Tenant (7 Tabs)

Click any tenant row to open the edit modal:

- **Info**: name, slug, plan, status (active/inactive), environment label
- **Modules**: toggle individual modules on or off — changes take effect immediately without restart
- **Branding**: update colors, logo, and display name
- **WhatsApp**: view the current WhatsApp connection state for this tenant; trigger a QR code re-pairing
- **Users**: list all users in this tenant; promote/demote roles; deactivate or delete users
- **Actions**: broadcast to the tenant's contacts, resend demo invites, delete the tenant
- **Developer tools**: seed demo data (inbox messages, chat sessions) and run diagnostics

### Impersonating a Tenant

From any tenant's edit modal:

- Click **Impersonate**
- You are logged in as that tenant's admin for up to 1 hour
- An amber banner shows at the top of the screen: "Viewing as [Tenant Name] ([agent email])"
- Click **Exit** in the banner to return to your superadmin account
- Every impersonation and exit writes a WARNING to the application logs (who impersonated which tenant/user, and when). Note this is a log entry, not a queryable audit table.

### Deleting a Tenant

- Click **Delete tenant** in the **Actions** tab of the edit modal
- Enter your superadmin password to confirm
- All tenant data is permanently deleted — this is irreversible

### Cross-Tenant Stats Dashboard

The superadmin home shows aggregate stats across all tenants:

- Total tenants (active / demo / inactive)
- Total tickets created (all tenants)
- Total contacts (all tenants)
- AI scans used this month (all tenants)

---

## 23. Superadmin: Diagnostics & Operations

Beyond client management, superadmins have access to platform-level diagnostic and operations tools.

### Resend Domain Provisioning

- View all custom sending domains across all tenants
- Check DNS verification status per domain
- Trigger a re-verification check for any domain
- Remove a domain configuration

### Evolution API Diagnostics (WhatsApp)

- See the connection state of every tenant's WhatsApp pairing (Connected / Disconnected / QR needed)
- Trigger a QR code refresh for a specific tenant's WhatsApp session
- View the Evolution API instance health

### Bulk Module Changes

- Enable or disable a specific module across **all** tenants at once
- Useful when launching a new module — flip it on globally rather than editing each tenant individually

### Broadcast Email

- Send an informational email to all opted-in contacts across all tenants (or a selected subset)
- Used for platform-wide announcements, maintenance notices, etc.

### Seed Demo Data

For any tenant in demo mode:

- **Seed inbox**: creates sample inbound messages with AI-generated drafts so the inbox looks populated for a demo
- **Seed chat sessions**: creates sample live chat conversations

### Superadmin List

- View all superadmin users
- **Invite superadmin**: send an invite to a new superadmin by email
- **Toggle active**: enable or disable a superadmin account
- **Delete**: permanently remove a superadmin

---

## 24. Integrations Reference

### Email — Resend

Yippie uses Resend for all outbound and inbound email.

- **Outbound**: all emails sent from the workspace (ticket replies, campaigns, booking confirmations) go through Resend
- **Inbound**: Resend receives emails to your domain and forwards them to Yippie via webhook. Each inbound message is stored, AI-scanned, and placed in the Inbox as a draft.
- **Custom domain**: a superadmin provisions your own sending domain (from the tenant edit modal) so outbound emails come from `@yourdomain.com` with proper SPF/DKIM/DMARC records
- **Bounce handling**: Resend reports bounces back to Yippie; bounced contacts are flagged and excluded from future sends automatically

### WhatsApp — Evolution API

Yippie integrates with a self-hosted Evolution API instance for WhatsApp:

- **QR pairing**: scan the QR code in the Chat settings to link a WhatsApp number to the workspace
- **Inbound**: WhatsApp messages arrive via Evolution API webhook, land in the Chat session list
- **Outbound**: replies sent from the Chat module go through Evolution API to WhatsApp
- **Broadcast**: bulk WhatsApp messages go through Evolution API
- Superadmins configure the Evolution API URL and token in the Railway environment variables

### Sendcloud — Shipping

- **API key**: enter in **Settings → Organisation** to connect
- **Status webhooks**: Sendcloud calls Yippie's webhook endpoint when a shipment status changes; Yippie updates the Shipment record automatically
- **Carriers supported**: PostNL, DHL, DPD, UPS, FedEx (plus Sendcloud / Other)

### ERP Order Webhook

- **Endpoint**: `POST /api/v1/webhooks/shipments/orders/{your-tenant-slug}`
- **Authentication**: HMAC comparison against the `X-Api-Key` header (the rotatable workspace secret)
- **Payload**: include `contact_email`, `tracking_number`, and `carrier`
- **Secret rotation**: generate a new secret from the Tracking page's Shipment settings; old secret is immediately invalidated

### Stripe — Platform Billing

Stripe handles subscription billing for Yippie's own plans (what tenants pay Yippie):

- **Checkout**: clicking a plan card redirects to Stripe checkout
- **Billing portal**: Stripe-hosted portal for managing payment method and viewing invoices
- **Webhook**: Stripe calls Yippie's webhook to update plan status on payment success, failure, or cancellation

### Live Chat Widget

- **Embed**: one `<script>` tag with `data-token`
- **Session persistence**: the widget uses a browser session ID to resume conversations across page navigations
- **Protocol**: WebSocket connection to `wss://app.getyippie.com/ws/chat` for real-time messaging
- **Fallback**: if WebSocket is unavailable, the widget falls back to polling

---

## 25. Automation & Background Jobs

Yippie runs ~30 scheduled background jobs using APScheduler. These run automatically — no manual trigger required. Cross-tenant maintenance jobs use a lock so two app containers on one database never double-run.

**Inbox & email**

| Job | Frequency | What It Does |
|---|---|---|
| Email poller | 30 s | Polls Resend for new inbound email and ingests it into drafts |
| OAuth inbox poll | 60 s | Pulls linked Gmail/Outlook mailboxes into the draft queue |
| Draft AI enrichment | 10 s (prod) / 30 s (dev) | AI-scans queued drafts using **Mistral Small** (default provider) for subject/priority/description/briefing, until the queue drains |
| Send flush | 5 s (prod) / 30 s (dev) | Dispatches queued outbound email after the undo window |
| Delivery sync | 5 min | Polls Resend for delivery/open status on sent mail |
| Inbox retention | hourly | Spam → Bin after 10 working days; Bin emptied after 20 |
| Go-live check | 60 s | Activates tenants once their scheduled go-live time passes |

**Tickets, flows & automations**

| Job | Frequency | What It Does |
|---|---|---|
| Flow engine | 10 s | Drains the flow-event outbox, runs matching flows, resumes due waits/retries |
| Flow scheduler | 1 min | Fires `schedule`-trigger flows at each tenant's local time (once per day) |
| Flow waiting sweeper | hourly | Closes orphaned flow runs stuck on a wait step |
| SLA reminder | 5 min | Emits `ticket_sla_due_soon` ~60 min before breach (feeds the escalation flow) |
| Ticket auto-close | hourly | Closes `Waiting` tickets untouched past the configured days |

**Marketing**

| Job | Frequency | What It Does |
|---|---|---|
| Campaign scheduler | 1 min | Launches scheduled campaigns whose send time has passed |
| A/B winner picker | 15 min | Picks the A/B winner ~2 h after dispatch; completes non-A/B campaigns |
| Drip sender | hourly | Sends due drip-sequence steps to contacts who haven't replied |
| Engagement decay | Monthly (1st) | Decays all contact engagement scores by 10% |

**Lifecycle, billing & analytics**

| Job | Frequency | What It Does |
|---|---|---|
| Contract lifecycle | every 6 h | Auto-expires / auto-renews contracts; sends notice (14-day) and expiry (7-day) nudges; emits `contract_expiring` |
| Invoice overdue check | daily | Flips sent invoices to Overdue and emits `invoice_overdue` |
| SaaS health compute | hourly | Recomputes health scores for contacts with new events |
| SaaS at-risk digest | Mondays 08:00 | Emails admins the at-risk customer list |
| Contact retention purge | hourly | Hard-deletes contacts soft-deleted more than 30 days ago |
| External calendar sync | 5 min | Refreshes subscribed iCal feeds so busy times block booking availability |

**Tenant lifecycle & onboarding**

| Job | Frequency | What It Does |
|---|---|---|
| Trial nudge / expiry | hourly | Day-23/28 trial nudges; locks lapsed trials (subscribe gate) |
| Subscription expiry | hourly | Locks paid tenants past their subscription end date |
| Demo nudge / expiry | hourly | Day-3 demo check-in; deactivates expired demo tenants |
| Onboarding drip | daily | Day-3 / Day-7 onboarding tip emails to new tenants |

**Yip assistant**

| Job | Frequency | What It Does |
|---|---|---|
| Reminder delivery | 1 min | Pushes due reminders to users as in-app toasts |
| Morning briefing | 15 min | Builds each user's daily briefing into their Yip thread (once per day, at/after their configured time) |
| Thread cleanup | daily | Drops Yip threads idle more than 30 days |

---

## 26. Public Pages (No Login Required)

These pages are accessible without a Yippie account. They are standalone — no app shell, no sidebar.

| URL | Page | Purpose |
|---|---|---|
| `/book/:token` | **Booking page** | Customer picks an available meeting slot from the agent's calendar |
| `/book/manage/:manageToken` | **Manage booking** | Customer reschedules or cancels a confirmed booking |
| `/meet/:slug` | **Meet page** | Permanent direct booking link (e.g., `/meet/diederik`) — no per-contact token required |
| `/unsubscribe/:token` | **Unsubscribe page** | Customer unsubscribes from marketing campaign emails |
| `/request-demo` | **Request demo** | Public form to request a demo tenant of Yippie |
| `/demo-enter` | **Demo enter** | Magic-link entry to a demo workspace (no password required) |
| `/track/confirm` | **Tracking confirm** | Confirms shipment tracking opt-in for a contact |
| `/sign/:token` | **Contract e-signing** | Customer signs a contract sent by your team — no login required |
| `/request/:slug` | **Reverse booking** | Customer proposes times; the workspace fulfils the request |
| `/signup` | **Trial signup** | Self-serve trial workspace signup (with `/verify-email` + resend-verification) |

Additional public endpoints (no dedicated page, called by embeds/integrations): `/custom-plan` (bespoke-package lead), `/questionnaire-lead` and `/lead/{slug}` (inbound lead capture, e.g. website forms), `/track` (Sales/SaaS analytics ingest), `/ai-demo` (live AI scan demo for the marketing site), `/widget-config/{slug}` (live-chat widget config), and `/calendar/{feed_token}.ics` (personal calendar export feed).

---

## 27. Security & Access Control

### Tenant Isolation

Every database table includes a `tenant_id` column. Every query filters by it. When a request arrives:

1. The JWT is validated and the user's `tenant_id` is extracted
2. A PostgreSQL function (`set_tenant_context`) runs `SET LOCAL app.current_tenant_id = :id` on the database session
3. Row-Level Security (RLS) policies on each table enforce that only rows matching the current `tenant_id` are visible
4. No query can return data from another tenant — even if an API endpoint had a bug, the database layer enforces the boundary

### Authentication

- **JWT (JSON Web Tokens)**: HS256 algorithm, 8-hour expiry, stored in an HttpOnly cookie (with a Bearer fallback)
- **Login**: `POST /api/v1/auth/login` with email + password sets the session cookie
- **Token refresh**: `POST /api/v1/auth/refresh` silently re-issues the cookie while it is still valid, so active sessions don't hard-expire at 8 hours (impersonation tokens cannot be refreshed)
- **Login rate limiting**: two-tier throttle on the login endpoint — a per-account lockout (keyed on IP + email) and a wider per-IP spray guard — using the real client IP (CF-Connecting-IP). Password-reset, registration, and demo-provisioning endpoints are rate-limited too.
- **Password hashing**: bcrypt (run off the event loop); a fixed dummy hash equalises timing for unknown emails to prevent account enumeration

### Roles and Permissions

| Role | Description |
|---|---|
| **Superadmin** | Platform-level admin; bypasses all tenant RLS; can impersonate any tenant; manages all clients |
| **Admin** | Tenant owner; full access to all settings and modules within their workspace |
| **Agent** | Standard team member; can use enabled modules; cannot change team or billing settings |
| **Viewer** | Read-only; cannot create, edit, or delete anything |
| **Worker** | Contract worker; restricted from all modules except their own booking-availability screen |
| **Custom** | Custom roles created by admins with per-module access levels (full / view / restricted) |

### Invite Links

- Team invite emails contain a one-time invite link
- Links expire after **7 days**
- Each link can only be used once — reuse is rejected
- After accepting, the new user sets their password and gains access

### Impersonation

- Superadmins can log in as any tenant's admin using a short-lived (1-hour) impersonation token
- The original superadmin token is preserved and restored on Exit; impersonation tokens cannot be refreshed
- Every impersonation and exit is written to the application logs (superadmin, target tenant/user, time) — a log entry, not a persisted audit table
- The amber impersonation banner is always visible during the session

### OAuth Email Accounts

Yippie connects to Gmail and Outlook via the OAuth 2.0 authorization code flow. No passwords are stored — only short-lived access tokens and long-lived refresh tokens, both encrypted with Fernet at rest.

| Provider | Auth endpoint | Token endpoint |
|---|---|---|
| Gmail | `accounts.google.com/o/oauth2/v2/auth` | `oauth2.googleapis.com/token` |
| Outlook | `login.microsoftonline.com/common/oauth2/v2.0/authorize` | `login.microsoftonline.com/common/oauth2/v2.0/token` |

Access tokens expire after 1 hour and are refreshed automatically. Outlook rotates the refresh token on every refresh — Yippie persists the new token immediately. If a refresh token is revoked by the user at the provider, sync halts and the account shows an error in Settings until reconnected.

The OAuth state parameter is a short-lived signed JWT (10-minute TTL) that binds the callback to the originating user and tenant — this prevents CSRF and cross-tenant token injection.

### Webhook Security

All inbound webhooks use HMAC-SHA256 signature verification:

- **Resend** (inbound email): `Svix-Signature` header verified against the Resend signing secret
- **Sendcloud** (shipping updates): `X-Sendcloud-Signature` header verified against the Sendcloud API secret
- **Stripe** (billing events): `Stripe-Signature` header verified against the Stripe webhook secret
- **ERP orders**: `X-Api-Key` header verified (HMAC comparison) against the rotatable workspace secret

Requests with invalid or missing signatures are rejected with a 403 before any processing occurs.

### Data at Rest

- All data stored in PostgreSQL 16
- Railway manages disk encryption at rest
- Backups are managed by Railway's Postgres plugin

---

## 28. Module: AI Assistant (Jarvis)

Jarvis (branded **Yip**) is the AI assistant that runs throughout the platform.

**Two separate AI things.** Yip the assistant (Cmd+K quick capture, the Yip chat panel, Yip Train, morning briefings, reminders) is always available. The **AI Inbox** module (€15/mo) is a *separate paid add-on* that unlocks the AI features inside the Inbox and Tickets — auto-scan, Suggest/Improve reply, and ticket briefings. When AI Inbox is disabled, those inbox/ticket AI buttons don't appear.

**AI provider.** All AI runs on **Mistral Small** (EU-hosted, GDPR-safe) by default. Anthropic Claude is an optional, configurable fallback. (Earlier drafts of this manual said "Claude Haiku" — that is no longer the default.)

### Quick Capture Popup

Press **`Cmd+K`** (Mac) or **`Ctrl+K`** (Windows/Linux) from anywhere in the app to open the Quick Capture popup. Type a natural-language instruction and Jarvis interprets it:

- **Set a reminder**: "Remind me to follow up with Jan tomorrow" → creates a reminder that fires as a push notification at the specified time
- **Add a contact note**: "Add a note to Pieter Bakker: called about invoice" → appends an internal note to that contact's timeline
- **Add a ticket note**: "Add note to ticket 42: escalated to team lead" → appends an internal note to the ticket
- **Context lookup**: "Find the ticket about the broken export for Acme BV" → locates the matching ticket and opens it

### Reminders

Reminders set via Quick Capture are delivered as push notifications inside the app (via WebSocket). When a reminder fires:

- A notification banner appears in the top-right corner
- Click the banner to navigate to the related contact or ticket
- Click **Dismiss** to clear the reminder
- View all upcoming reminders in the **Reminders** panel (accessible from the notification bell in the sidebar)

### Yip Train (AI Configuration)

**Yip Train** is a 5-question onboarding flow that teaches Jarvis the context of your business. Access it from **Settings → Workspace → Train Yip AI**.

The five questions configure:

1. **Tone**: formal, friendly, or neutral — how Yippie writes AI-generated replies
2. **Language**: the primary language the AI should write in when suggesting replies
3. **Product / service**: what your business does — used to contextualise reply suggestions and ticket briefings
4. **Audience**: who your customers are (B2B, B2C, enterprise, etc.)
5. **Common topics**: the most frequent issues your support team handles

Answers are saved and applied across all AI features: inbox scanning, reply suggestions, ticket briefings, and template generation. Re-run Yip Train at any time to update the profile.

### AI Features by Module

All Inbox/Tickets/Templates AI features below require the **AI Inbox** add-on.

| Module | AI Feature | Trigger |
|---|---|---|
| Inbox | Draft scanning | Auto-scan (opt-in, off by default) or on-demand **Generate** |
| Inbox | Suggest reply | Button in Draft Review |
| Inbox | Improve reply | Button in Draft Review |
| Inbox | Regenerate scan | Button in Draft Review |
| Inbox | Compose suggest / improve | Buttons in Compose modal |
| Tickets | Ticket briefing | Auto-loads when reply tab is focused |
| Tickets | Suggest reply | Button in ticket reply composer |
| Tickets | Improve reply | Button in ticket reply composer |
| Templates | AI suggest template | Button in template editor |
| Jarvis | Quick Capture | `Cmd+K` / `Ctrl+K` |
| Jarvis | Reminders | Fired by Quick Capture or scheduled |

### Yip Chat (Agentic AI)

The **Yip** icon in the sidebar opens the Yip chat panel — a conversational AI agent with read and write access to your workspace. Unlike Quick Capture (single commands), Yip handles multi-step requests and can take action on your behalf.

**What Yip can do:**

| Category | Examples |
|---|---|
| **Look up information** | "Show me all open tickets for Acme BV", "What's the status of invoice INV-0042?" |
| **Draft replies** | "Draft a reply to the last ticket from Jan de Vries, apologise for the delay" |
| **Create & update records** | "Create a ticket: follow up with Pieter about his shipment", "Move Acme to the Proposal Sent stage" |
| **Summarise context** | "Give me a briefing on our deal with Ndugu Coffee" |
| **Answer workspace questions** | "How many contacts do we have?", "What was the last email we sent to this customer?" |

**Write actions and confirmation:** When Yip intends to create a ticket, update a record, or move a pipeline stage, it describes the action and asks for confirmation before executing. This prevents accidental changes.

**Full thread context:** When drafting replies to tickets or inbox messages, Yip loads the full conversation history and customer context before generating the suggestion — it does not work from a blank slate.

**Conversation memory:** Yip maintains a persistent conversation thread per user. You can continue from where you left off across sessions.

**SSE streaming:** Yip's responses stream in real time — you see text as it is generated rather than waiting for the full response.

### Morning Briefing

Yip posts a daily morning briefing into your Yip thread at (or just after) your configured time. It is a **deterministic digest** — assembled from your data, not generated by the AI model, so it costs nothing and is always accurate. A background job checks every 15 minutes and posts once per day. The briefing includes:

- Overdue or breached and high-priority open tickets assigned to you (or unassigned)
- Today's bookings
- Any reminders due today

(Only sections relevant to your enabled modules appear; if there's nothing noteworthy, no briefing is posted.)

### AI Scan Usage

Each inbox draft AI scan counts against the tenant's monthly AI scan limit (determined by the subscription plan). The current usage and limit are visible on the **Subscription** page. When the limit is reached, new drafts are stored but not scanned until the next billing period or a plan upgrade.

### Knowledge Base (Grounding AI Replies)

When the AI Inbox module is enabled, an admin can point Yippie at **one source URL** — a public FAQ or help page. Yippie fetches it, splits it into sections, and stores it as a small knowledge base. When the AI drafts a reply to an inbound message, it pulls the most relevant sections from that page and grounds the reply in your own company knowledge, so answers match what you actually publish.

- Set or update the source URL, refetch it on demand, or remove it, from the AI/Knowledge settings (admin only)
- Retrieval uses keyword matching over the page's sections (no external vector database)
- Currently the knowledge base grounds **inbox reply drafts**; it is not yet wired into ticket briefings or the Yip agent

---

## 29. Onboarding & Setup

New workspaces receive guided onboarding to help the team get up and running.

### Welcome Tour

On first login, a **Welcome Tour** overlay walks new users through the main areas of the platform:

- Where the Inbox is and how AI scanning works
- How to open a ticket and reply to a customer
- Where to find contacts and the pipeline board

The tour can be dismissed and replayed at any time from the Help menu.

### Setup Checklist

A **Setup Checklist** widget appears in the sidebar for new workspaces. It tracks four key milestones:

| Step | Action |
|---|---|
| **Connect email** | Add an inbound email address and configure your sending domain in Settings → Team |
| **Invite team** | Add at least one other team member via Settings → Team → Invite |
| **Handle first ticket** | Approve an inbox draft or create a ticket manually and change its status |
| **Train Yip AI** | Complete the Yip Train flow in Settings → Workspace → Train Yip AI |

Each step is checked off automatically once completed. The checklist collapses after all four steps are done.

### Onboarding Drip Emails

New tenants receive automated onboarding tip emails from the platform on **Day 3** and **Day 7** after signup. These are sent by the background scheduler and contain tips for getting the most out of the platform. Superadmins can view these sends in the activity log.

---

---

## 30. Module: Flows (Automation Builder)

Flows lets you build automations that run when something happens in Yippie — a ticket is created, a contact moves to a new pipeline stage, a booking is confirmed, or an external system sends a webhook. Each flow has a trigger, optional conditions, and a sequence of actions.

### What Flows Does

- Sends emails, in-app notifications, or HTTP webhooks automatically
- Moves contacts between pipeline stages in response to events
- Creates or updates tickets without human input
- Waits a configured amount of time before continuing (e.g. follow up 3 days after a booking)
- Branches on conditions to take different paths depending on the current state of the record

### Anatomy of a Flow

Every flow has four parts:

| Part | What it is |
|---|---|
| **Trigger** | The event that starts the flow |
| **Conditions** | Optional filters — the flow only runs if the event matches these |
| **Actions** | The steps that execute in order |
| **Settings** | Name, enabled/disabled toggle, per-trigger config |

---

### Trigger Types

Triggers are grouped by module. Only triggers from modules that are enabled for your workspace appear in the builder.

**Tickets**
| Trigger | When it fires |
|---|---|
| `ticket_created` | A new ticket is created |
| `ticket_status_changed` | A ticket's status changes (e.g. open → resolved) |
| `ticket_sla_due_soon` | Approximately 60 minutes before a ticket's SLA deadline |

**Contacts**
| Trigger | When it fires |
|---|---|
| `contact_created` | A new contact is added |
| `call_logged` | A call is logged on a contact (via the Log a call feature) |

**Pipeline**
| Trigger | When it fires |
|---|---|
| `pipeline_stage_changed` | A contact moves from one pipeline stage to another |

**Inbox**
| Trigger | When it fires |
|---|---|
| `draft_approved` | An AI-scanned inbox draft is approved into a ticket |

**Shipments / Tracking**
| Trigger | When it fires |
|---|---|
| `order_received` | An order payload arrives via the ERP webhook |

**Booking**
| Trigger | When it fires |
|---|---|
| `booking_created` | A customer books a meeting slot |
| `booking_cancelled` | A customer cancels a confirmed booking |

**Marketing**
| Trigger | When it fires |
|---|---|
| `campaign_email_bounced` | A campaign email bounces (hard or soft) |
| `campaign_button_clicked` | A customer clicks an action button in a campaign email |

**Contracts**
| Trigger | When it fires |
|---|---|
| `contract_expiring` | A contract is approaching its expiry date |

**Billing**
| Trigger | When it fires |
|---|---|
| `invoice_overdue` | An invoice's due date has passed without payment |

**SaaS**
| Trigger | When it fires |
|---|---|
| `saas_signup` | A new end-user signs up in your tracked SaaS product |
| `saas_health_dropped` | A customer's health score drops (computed hourly) |

**Live Chat**
| Trigger | When it fires |
|---|---|
| `conversation_started` | A live chat conversation begins |
| `conversation_solved` | A chat conversation is marked as solved |

**Built-in (no module required)**
| Trigger | When it fires |
|---|---|
| `schedule` | At a configured time — daily or on a specific weekday |
| `webhook` | When an external system posts to the flow's unique inbound URL |

---

### Conditions

Conditions are optional. If none are set, the flow runs on every matching trigger event.

Conditions use an **OR-of-AND** structure: you can have multiple condition groups, and the flow runs if **any group** fully matches. Within a group, **all conditions** must match.

**Example:** run only when a ticket is created with priority `high` or `urgent`:
- Group 1: `priority equals high`
- Group 2: `priority equals urgent`

**Available operators:** `equals`, `not equals`, `contains`, `in`, `greater than or equal`, `less than or equal`

**Limits:** up to 5 OR groups, up to 10 conditions per group.

---

### Action Types

**Ticket Actions**

| Action | What it does |
|---|---|
| `create_ticket` | Creates a new ticket with the configured subject, description, priority, and assignee |
| `update_ticket` | Updates the triggering ticket's status, priority, or assignee |

**Pipeline Actions**

| Action | What it does |
|---|---|
| `move_pipeline_stage` | Moves the contact linked to the event to a specified pipeline stage |

**Communication Actions**

| Action | What it does |
|---|---|
| `send_email` | Sends an email to the contact. Supports a subject, body, or an existing template. Skipped if the contact has no email address. |
| `notify_user` | Sends an in-app notification to a team member. Set the recipient to a specific user or to "assigned agent" (resolved at runtime from the ticket or event). |
| `send_webhook` | POSTs the event payload to an external URL, signed with your workspace webhook secret. |

**Flow Control**

| Action | What it does |
|---|---|
| `wait` | Pauses the flow for a set number of minutes, hours, or days (max 30 days per flow). The flow resumes exactly where it left off. |
| `branch` | Evaluates conditions against the **current** record state and routes down a "match" path or an "else" path. Useful after a wait, when the record may have changed. |

**Dynamic placeholders in text fields:** Use `{subject}`, `{full_name}`, `{email}`, `{stage_name}`, `{priority}`, `{status}`, `{due_in_minutes}`, or any event field name. Unknown placeholders are left as-is.

---

### Creating a Flow

1. Go to **Flows** in the sidebar
2. Click **New flow**
3. Give the flow a name
4. Pick a **trigger** (grouped by module)
5. Optionally add **conditions**
6. Add one or more **actions** in order
7. Toggle the flow **enabled** and click **Save**

Flows are disabled by default so you can configure them fully before they start running.

**Linear flows** (up to 10 actions, no branches) are edited entirely in the modal. If you need branches or more than 10 actions, click **Open canvas** to switch to the visual editor.

---

### Canvas Editor (Branched Flows)

The canvas editor is a visual node-and-edge graph for building flows that branch based on conditions.

- **Nodes** represent individual actions or branch points
- **Edges** connect nodes — a branch node has a "match" edge and an optional "else" edge
- Drag nodes to rearrange; click **Re-layout** to auto-arrange
- Select a node to edit its config in the inspector panel on the right
- Up to **25 nodes** per flow
- The canvas saves node positions locally in your browser

**Branch nodes** evaluate their conditions against the **live record** at the moment they run — not the frozen event snapshot. This means a branch after a 3-day wait checks what the ticket actually looks like now, not what it looked like when the flow started.

---

### Test Fire

Every flow has a **Test fire** option (the ▶ icon on the flow card). This performs a dry run:

- Shows the sample event fields for the trigger type
- Evaluates your conditions (shows whether they match)
- Lists each action and whether it would run or be skipped (with reasons)
- Makes **no real changes** — nothing is created, sent, or moved

Use test fire to verify a flow before enabling it.

---

### Recipes

Recipes are pre-built flow templates you can install with one click. Go to the **Recipes** tab on the Flows page to browse them.

| Recipe | What it does |
|---|---|
| Urgent ticket alert | Notifies the assigned agent immediately when a high or urgent ticket is created |
| Welcome new contacts | Sends a welcome email and moves the contact to the first active pipeline stage |
| Approved inbox draft moves the deal | Moves a contact to a pipeline stage when their inbox draft is approved |
| Resolved ticket moves the deal | Moves a contact when their ticket is resolved |
| Ask for a review | Emails the customer a review request after their ticket is resolved |
| Follow up on new contacts | Creates a follow-up ticket when a new contact is added (add a `wait` step if you want a delay) |
| Escalate to urgent before SLA breach | One-step escalation: sets the ticket to urgent 60 minutes before SLA |

Installing a recipe creates a **disabled** copy that you can customise before enabling.

---

### Platform Automations

The **Platform automations** card on the Flows page lists always-on background jobs that run automatically — these are not configurable flows, but they are shown here so you can see what the platform is doing on your behalf.

| Automation | What it does |
|---|---|
| AI drafts your tickets | Scans every inbound email and WhatsApp message with AI to generate a structured draft |
| Stale tickets close themselves | Closes tickets in "Waiting" status that have not been updated within the SLA window |
| Orders sync your contacts | Auto-creates or updates contacts from incoming ERP order payloads |
| Campaign buttons take action | Moves contacts to pipeline stages when they click campaign email buttons |
| Booking links invite the customer | Sends a calendar invitation email when a booking is confirmed |
| Contracts renew and expire on time | Fires contract expiry and renewal events on schedule |
| Overdue invoices flag themselves | Flips invoice status to "Overdue" when the due date passes |
| Campaigns run on their own | Dispatches scheduled campaigns, drip steps, and A/B winners |
| Health scores stay current | Recomputes SaaS customer health scores hourly; sends a Monday digest |
| Live chats auto assign | Claims a live chat session for the first agent who replies |
| Yip's morning briefing | Posts a daily digest of each user's priorities into their Yip thread |

---

### Webhooks

**Inbound webhooks (external → Yippie):** Flows with the `webhook` trigger type get a unique URL. Any system can POST a JSON payload to that URL to fire the flow. The payload fields become the event fields and can be used in conditions and placeholder text. The URL can be rotated from the flow's webhook settings panel.

**Outbound webhooks (Yippie → external):** The `send_webhook` action POSTs to a URL you specify. The payload includes the full event context and is signed with your workspace webhook secret (`X-Yippie-Signature: sha256=…`) so the receiving system can verify it came from Yippie. The secret can be rotated from the webhook settings panel without losing the existing URL.

---

### Flow Runs & Audit Log

Every time a flow runs (or is skipped), Yippie records a **flow run**. Open the run log by clicking the run count badge on any flow card.

| Status | Meaning |
|---|---|
| `success` | All actions completed successfully |
| `partial` | Some actions ran, some were skipped (e.g. no email address on contact) |
| `failed` | One or more actions failed (e.g. bad webhook URL) |
| `waiting` | The flow is paused on a wait step and will resume later |
| `skipped` | The flow's conditions did not match — logged for audit, no actions ran |

Failed actions are retried automatically: once after 60 seconds, once more after 5 minutes. After 3 total attempts the run is marked failed.

---

### Plan Limits

| Setting | Detail |
|---|---|
| **Active flow cap** | Set per plan. Default flows (installed by Yippie) do not count toward the cap. |
| **Actions per flow** | Up to 10 (modal builder) or 25 nodes (canvas) |
| **Max wait** | 30 days total along the longest path in any flow |
| **Condition groups** | Up to 5 OR groups, 10 conditions each |

When you reach the active flow cap, disable an existing flow before enabling a new one, or upgrade your plan.

---

### Loop Protection

Yippie prevents automation loops. When a flow action causes an event (e.g. a `create_ticket` action fires a `ticket_created` event), that downstream event only triggers other flows if those flows have **chainable** mode enabled (opt-in setting per flow). Chains are limited to 3 levels deep, and a flow that already fired in the current chain cannot fire again.

---

## 31. Module: Contracts (Documents & E-Signing)

The Contracts module lets you create, send, track, and e-sign contracts with customers — all from within Yippie, with no external tool required.

### What Contracts Does

- Creates contracts from scratch or from reusable block templates, or attaches an uploaded PDF/Word/image file
- Generates a professional PDF automatically from merge-resolved blocks
- Produces a public signing link (copied to your clipboard) for the counterparty — no Yippie account required
- Records the e-signature: signer name, a drawn signature image, timestamp, and IP address
- Tracks both **issued** (to customers) and **received** (from vendors) contracts, with MRR/ARR totals
- Auto-manages renewal and expiry, with reminder nudges, and fires a `contract_expiring` flow trigger before the end date

### Creating a Contract

1. Go to **Contracts** in the sidebar
2. Click **New contract**
3. Fill in the contract details: title, counterparty (select a contact), start date, end date, value, and body text
4. Optionally choose a **template** to pre-fill the body
5. Click **Save as draft**

The contract is saved as a draft and a PDF is generated automatically. You can preview the PDF before sending.

### Sending for E-Signing

1. Open a contract, pick a template, and click **Generate** to freeze its body/blocks
2. Click **Create signing link** — the public `/sign/:token` URL is copied to your clipboard. **Yippie does not email it for you**; paste it into your own email or message to the counterparty.
3. The counterparty opens the link (no login required), reviews the contract, and signs by drawing their signature and entering their name
4. Their signature image, name, timestamp, and IP address are recorded and rendered into the PDF
5. Signing sets the contract to **Active** and single-uses the link

### Contract Lifecycle

| Status | Meaning |
|---|---|
| **Draft** | Created, not yet sent |
| **Sent** | Signing link created, awaiting signature |
| **Active** | Signed (or manually activated) and within the contract period |
| **Expired** | End date has passed and the contract was not set to auto-renew |
| **Terminated** | Ended early / cancelled |

There is no separate "Signed" status — signing goes straight to **Active** — and no "Renewed" status (renewal rolls the same contract's dates forward in place).

A background job runs every 6 hours to: expire past-end contracts that aren't set to auto-renew, auto-renew those that are, send a **notice-period nudge** ~14 days before the notice deadline, and a **7-day expiry nudge** for non-renewing contracts. The `contract_expiring` flow trigger fires from the expiry nudge, so you can automate reminder or renewal workflows via Flows.

### Notice Period & Auto-Renew

- **Notice period**: set the number of days' notice required; Yippie derives the notice deadline from the end date and nudges you before it
- **Auto-renew + renewal term**: when enabled, the contract automatically rolls its start/end dates forward by the renewal term at expiry — no manual action, no new record

### Templates

Contract templates are built in a full **drag-and-drop block editor** with `{{merge_field}}` insertion and a live PDF preview — not just a name and body.

1. Go to **Contracts → Templates**
2. Build the template from blocks and merge fields
3. Select the template when creating a contract, then **Generate** to render the merged body

Templates are shared across all users in the workspace.

### File Attachments

Instead of (or alongside) a generated body, you can upload a signed PDF, Word document, or image (up to 15 MB) to a contract, and download it later.

### Revenue Tracking

The Contracts page shows aggregate figures for all active contracts:
- **Total MRR** (monthly recurring value of active contracts)
- **Total ARR** (annual recurring value)
- **Count** of active, expiring soon, and expired contracts

---

## 32. Chrome Extension (Inbox Analyser)

The **Yippie Inbox Analyser** is a standalone marketing/lead-generation browser extension — not a CRM integration. It is a browser-action **popup** that shows a prospect how much time they spend on manual inbox triage and what Yippie could save them. It has **no connection to a Yippie workspace**: there is no Yippie login, no contact lookup, no ticket creation, and no Gmail sidebar.

### What the Extension Does

- Connects (via OAuth) to a **Gmail or Outlook** inbox that the user chooses
- Reads up to ~500 inbox **headers** from the last 30 days — sender, subject, and date only (never message bodies, sent mail, or drafts)
- Classifies the mail (e.g. newsletters vs. real conversations) using provider category labels, List-Unsubscribe / Focused-Other signals, and English + Dutch keyword fallbacks
- Presents a time-triage summary as a talking point for how Yippie would help; results are cached for about an hour

### Installing the Extension

1. Install **Yippie Inbox Analyser** from the Chrome Web Store (or a shared link)
2. Click the toolbar icon to open the popup
3. Choose **Gmail** or **Outlook** and approve the read-only, metadata-scoped permission

### Permissions & Privacy

- Requests only `identity` and `storage` browser permissions
- Gmail: `gmail.metadata` scope (headers only). Outlook: Microsoft Graph `User.Read` + `Mail.ReadBasic`
- It never reads email bodies, and it does not send your mailbox data to a Yippie workspace — the analysis runs against header metadata for the summary only

---

*End of manual. For the latest changes, refer to the git commit history on the `sandbox` branch.*
