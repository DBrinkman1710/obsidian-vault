# Yippie Platform — Complete Product Manual

> Last updated: July 2026. Reflects what is built and deployed on sandbox.

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

The full module list is: `inbox`, `contacts`, `tickets`, `calendar`, `pipeline`, `booking`, `activity`, `billing`, `chat`, `departments`, `marketing`, `tracking`, `sales`, `saas`.

Superadmins can enable or disable modules per tenant at any time from the Superadmin panel — no code change or restart required.

### Plans

| Plan | Price | Seats | AI Scans/month |
|---|---|---|---|
| **Founder** | €9/mo | 10 | 500 |
| **Starter** | €19/mo | 3 | 2,000 |
| **Growth** | €39/mo | 5 | 5,000 |
| **Pro** | €69/mo | 10 | 10,000 |
| **Enterprise** | Custom | Custom | Custom |

All plans include unlimited contacts. AI scans are the inbox AI draft generations.

### Deployment

- **Sandbox** (`sandbox.getyippie.com`): staging environment; deploys from the `sandbox` git branch
- **Production** (`app.getyippie.com`): live environment for real clients; deploys from the `live` git branch
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

Inbound messages are scanned by AI (Claude Haiku), which reads the message and suggests a ticket subject, priority level, and description. Agents review the AI draft, edit if needed, and approve with one click. Approved drafts become structured tickets. This eliminates manual ticket write-up entirely.

### Trending Topics

A **Trending** indicator in the Inbox header shows the most common keywords appearing in recent inbound messages — refreshed every 15 minutes. Use it to spot recurring issues (e.g., "delivery delay", "invoice") before opening individual messages.

### Tabs

- **Pending**: Messages that have been AI-scanned and are awaiting agent review. This is the primary working view.
- **Processed**: Messages that have been approved (converted to tickets), rejected, or archived.
- **Sent**: Outbound emails composed and sent from the inbox. Each entry shows delivery status: Sent, Delivered, Opened, Clicked, or Bounced.

### Draft Review

Clicking a pending message opens the **Draft Review** page. Here you can:

- **Edit the subject line** suggested by AI
- **Change the priority** (Low / Medium / High / Urgent)
- **Link to a contact**: type a name or email to associate the message with an existing contact, or create a new one
- **Add labels** to the draft for categorisation
- **View the full original message** body
- **Approve** the draft → creates a ticket immediately
- **Reject** the draft → moves it to Processed without creating a ticket
- **Regenerate AI scan** → asks the AI to re-read the message and produce a new suggestion
- **Forward** the draft to a different department or agent
- **Clear follow-up date** → remove a previously set follow-up reminder
- **Right-click context menu** on any draft in the list: assign, route to department, move to bin, mark as spam

### Compose (New Outbound Email)

Click **Compose** to open a new outbound email form. Options include:

- **To / CC / BCC** recipients
- **Subject** line
- **Body** with rich text formatting
- **Template picker**: select a pre-built response template to insert
- **Signature picker**: choose from your saved signatures
- **Attachments**: attach files from your computer
- **5-second undo**: after clicking Send, a brief window appears to cancel the send before it goes out

### AI Reply Assist (in Draft Review)

Within the Draft Review page, when composing a reply:

- **Suggest reply**: AI reads the inbound message and writes a draft reply
- **Improve reply**: AI rewrites your draft to be clearer and more professional
- These tools work in the reply composer, not on the ticket itself

### Bulk Actions

In the Pending tab, select multiple messages with checkboxes:

- **Approve all selected** → batch convert to tickets
- **Assign** → route to a specific agent or department
- **Move to bin** → delete drafts
- **Mark as spam** → flag and archive

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
- **Import**: upload a CSV, JSON, or XLSX file to bulk-create contacts (name, email, phone, company columns supported)
- **CSV export**: download all contacts (or filtered results) as a CSV
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

Note: KvK and BTW/VAT numbers are workspace-level fields in **Settings → Organisation**, not per-contact fields.

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

- **Create a company**: give it a name; optionally add KvK and BTW numbers
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
- **Delete**: permanently remove selected tickets

### SLA Escalation (Automatic)

The platform runs an automated SLA checker every 5 minutes:

- Tickets past their SLA deadline are flagged **Overdue** and their badges turn red
- Tickets in **Waiting** status that have not been updated for a configured number of days are automatically closed
- The overdue count is reflected in the **Tickets** sidebar badge in real time

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
- Cards that have been in a stage for more than 30 days show a **stale** badge
- **Drag and drop** a card to move a contact to a different stage — the move is saved immediately

### Stage Management

Click the gear icon on any stage column, or go to **Settings → Organisation → Pipeline stages**:

- **Create stage**: add a new column with a name and optional color
- **Rename**: change a stage name at any time
- **Reorder**: drag stages left or right to change column order
- **Set color**: choose a color used in the calendar for SLA deadline entries
- **Delete**: remove the stage (contacts in it must be moved first)

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
- **Media attachments**: send images or files (WhatsApp and web widget support)
- **Internal note**: add a private note visible only to agents — not sent to the customer
- **Create ticket**: convert this chat session into a support ticket (opens the New Ticket form pre-filled with the session contact)
- **Send booking link**: send a booking invitation link directly in the chat
- **Resolve**: mark the session as resolved — it moves out of the open list
- **Close**: end the session permanently

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

- **Resolve all selected**: batch-resolve open sessions
- **Delete**: permanently remove sessions

### Chat Settings

In team settings, configure:

- **Hide solved sessions after N hours**: solved sessions disappear from the list after the configured time (keeps the list clean)

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
- Connects to the platform via WebSocket for real-time messaging
- The `data-token` identifies your workspace; find it in **Settings → Chat**

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
- **Per-button stage**: for each **Yippie Button** in the email design, set which pipeline stage a contact moves to when they click that button. The buttons are listed by their label; picking a stage links that click to a pipeline move.
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

- Click **Add variant** to create a second version of the campaign email
- Set the **split percentage** (e.g., 50/50 or 70/30)
- Send — variant A goes to one group, variant B goes to the other
- After 2 hours, the system automatically picks the winner (by open rate) and sends the winning version to any remaining recipients

### Unsubscribes

- View the list of contacts who have unsubscribed
- Click **Re-enable** on any contact to re-add them to the mailing list (use carefully — only with explicit consent)

### How Tracking Works

- **Opens**: a 1×1 pixel image in the email body; loading the email loads the pixel and records the open
- **Clicks**: all links and Yippie Buttons go through a click-tracking redirect that records the click, then forwards to the destination
- **Reply matching**: inbound emails are matched to campaign sends by Message-ID headers; a match triggers the reply-received stage move

---

## 10. Module: Billing (Invoices)

Billing lets you create, send, and track invoices directly from the workspace — no separate billing tool needed.

### What It Does

Create invoices with line items, send them to customers by email, record payments, and export for your accountant. Dutch KvK and BTW numbers are supported natively.

### Invoice List

- **Search**: find invoices by contact name, invoice number, or amount
- **Filter by contact**: show all invoices for a specific customer
- **Status badges**: Draft, Sent, Paid, Overdue
- **Bulk delete**: select multiple invoices and delete
- **CSV export**: download the invoice list as a CSV file
- **XLSX export**: download as an Excel file
- **CSV import**: upload a CSV of invoices using the provided template to bulk-create records

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

### Activity Feed

- **Chronological log**: every action across the platform in order of occurrence
- **Filter by event type**: show only emails, only ticket updates, only pipeline moves, etc.
- **Filter by user**: see what a specific team member has done
- **Filter by date range**: narrow the feed to a time window
- **Contextual links**: each activity entry links directly to the ticket, contact, or campaign it references — one click to full context

### KPI Dashboard

The dashboard (at the top of the Activity page) shows aggregated stats:

- **Pipeline breakdown**: contact counts per stage
- **Ticket stats**: open, resolved, overdue counts and trends
- **Contact growth**: new contacts over time
- **Email stats**: outbound sent, open rate, click rate

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

- **Filter by status**: Pending, In Transit, Delivered, Exception
- **Filter by carrier**: DHL, UPS, FedEx, PostNL
- **Search**: find a shipment by tracking number or contact name

### Creating a Shipment

Click **New Shipment**:

- **Contact**: link to the customer this shipment belongs to
- **Tracking number**: enter the carrier tracking number
- **Carrier**: select the carrier (DHL, UPS, FedEx, PostNL)
- **Estimated delivery date**: optional manual entry
- **Linked ticket**: optionally associate with a support ticket

### Shipment Detail

Open a shipment to see:

- **Event timeline**: chronological list of carrier scan events (e.g., "Departed sorting facility", "Out for delivery", "Delivered")
- **Current status badge**: the most recent carrier status
- **Contact link**: jump to the customer's contact page
- **Ticket link**: jump to the associated ticket

### Sendcloud Integration

When Sendcloud is connected (via API key in **Settings → Organisation**):

- Shipment status updates are received automatically via webhook — no manual refresh needed
- Status transitions (In Transit → Delivered, etc.) appear in the event timeline in real time

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

- **Sendcloud API key**: enter in **Settings → Organisation** to enable automatic status sync
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

- **Total events**: count of all tracked events (views, carts, purchases)
- **Total revenue**: sum of all purchase event amounts
- **Repeat customers**: contacts with more than one purchase event
- **Recent events feed**: live list of incoming events with contact, event type, and product/amount

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

Each contact gets a score from 0–100 based on:

- **Login recency**: logged in recently = higher score
- **Feature breadth**: used more distinct features = higher score
- **Error penalty**: errors reduce the score

### SaaS Dashboard

- **Onboarding completion %**: percentage of contacts who have completed the key onboarding steps
- **At-risk count**: contacts with a health score below the configured threshold
- **Top features**: which features are used most across all contacts
- **Common errors**: which errors appear most frequently

### Token

The SaaS token is the same as the Sales token — one token covers both modules (the same snippet file works for both).

---

## 15. Module: Booking (Calendar Scheduling)

Booking lets contacts schedule meetings with you by clicking a link and picking a time — confirmation emails go out automatically.

### What It Does

Instead of back-and-forth emails to find a meeting time, send a booking link. The contact sees your availability and picks a slot. The booking appears on your Calendar automatically.

### Booking Settings

Configure in **Settings → Profile** (personal booking) or via the superadmin panel (tenant-wide):

- **Timezone**: your local timezone for availability calculation
- **Booking window**: how many days in the future slots are offered (e.g., next 14 days)
- **Post-booking pipeline stage**: optionally move the contact to a specific pipeline stage when they confirm a booking

### Sending a Booking Link

From a **Contact Detail** page or a **Ticket Detail** page:

- Click **Send booking link**
- A unique, time-limited booking URL is generated and inserted into a new email draft
- Send the email to the contact

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
- If a post-booking stage is configured, the contact moves to that pipeline stage automatically

### Manage Booking Page

The contact can manage their booking via the link in their confirmation email (`/book/manage/:manageToken`):

- **Reschedule**: pick a new slot
- **Cancel**: cancel the booking — both parties are notified

### Meet Page (Direct Booking Without Token)

Each user has a permanent public booking URL: `/meet/:slug` (e.g., `/meet/diederik`). This is a persistent link you can share on your website or email signature — no per-contact token required. Anyone can use it to book a meeting with you.

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
- **SLA working days**: the number of working days agents in this department have to resolve tickets (used to calculate SLA deadlines)
- **Default reply template**: optionally pick a template that pre-fills when agents reply to tickets routed to this department

### Adding Members

- Click **Manage members** on a department
- Search for and add agents from your team
- Agents can belong to multiple departments

### Inbound Email Routing

When an email arrives at a department's address:

- The inbox draft is automatically tagged with that department
- The draft appears in the Inbox for that department's agents
- Tickets created from it are automatically assigned to the department

### Module Permissions per Department

In the department settings, you can override which modules agents in this department can access — for example, giving the Finance department access to **Billing** but not **Pipeline**.

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

Choose from 14 available interface languages — the app UI re-renders immediately:

English, Dutch (Nederlands), French (Français), German (Deutsch), Spanish (Español), Portuguese (Português), Italian (Italiano), Arabic (العربية), Chinese (中文), Japanese (日本語), Korean (한국어), Russian (Русский), Polish (Polski), Turkish (Türkçe)

### Change Password

- Enter your current password, then your new password (minimum 8 characters), and confirm.

---

## 18. Settings: Team

Team settings are workspace-wide — admins and superadmins can change them.

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

### Resend Domain Configuration

Configure a custom email sending domain so outbound emails come from `@yourdomain.com` instead of Yippie's shared domain:

1. Click **Add domain**
2. Enter your domain name
3. Yippie provisions the domain with Resend and shows the DNS records to add (SPF, DKIM, DMARC)
4. Add the DNS records at your domain registrar
5. Click **Verify** — Yippie checks DNS and marks the domain as verified
6. Outbound emails now send from your domain

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

The Subscription page (available in the sandbox/staging environment) manages your Yippie plan and billing.

### Plan Cards

Each plan shows:

- **Name**: Founder, Starter, Growth, Pro, Enterprise
- **Price**: monthly rate in euros
- **Seat limit**: maximum number of team members
- **AI scan limit**: maximum inbox AI scans per month
- **Current plan indicator**: your active plan is highlighted

Click **Upgrade** on any plan to proceed to Stripe checkout.

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

### Editing a Tenant (6 Tabs)

Click any tenant row to open the edit modal:

- **Info**: name, slug, plan, status (active/inactive), environment label
- **Modules**: toggle individual modules on or off — changes take effect immediately without restart
- **Branding**: update colors, logo, and display name
- **WhatsApp**: view the current WhatsApp connection state for this tenant; trigger a QR code re-pairing
- **Users**: list all users in this tenant; promote/demote roles; deactivate or delete users
- **Actions / Dev**: seed demo data (inbox messages, chat sessions), delete the tenant, run diagnostics

### Impersonating a Tenant

From any tenant's edit modal:

- Click **Impersonate**
- You are logged in as that tenant's admin for up to 1 hour
- An amber banner shows at the top of the screen: "Viewing as [Tenant Name] ([agent email])"
- Click **Exit** in the banner to return to your superadmin account
- All impersonation sessions are audit-logged (who, when, which tenant)

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
- **Custom domain**: configure your own sending domain in **Settings → Team** so outbound emails come from `@yourdomain.com` with proper SPF/DKIM/DMARC records
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
- **Carriers supported**: DHL, UPS, FedEx, PostNL

### ERP Order Webhook

- **Endpoint**: `POST /api/v1/shipments/webhooks/orders`
- **Authentication**: HMAC-SHA256 signature in the `X-Webhook-Signature` header
- **Payload**: include `contact_email`, `tracking_number`, and `carrier`
- **Secret rotation**: generate a new secret in **Settings → Organisation → Tracking**; old secret is immediately invalidated

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

Yippie runs several scheduled background jobs using APScheduler. These run automatically — no manual trigger required.

| Job | Frequency | What It Does |
|---|---|---|
| **SLA escalation** | Every 5 minutes | Scans all open tickets; marks any past their SLA deadline as Overdue; updates sidebar badge counts |
| **SLA auto-close** | Every hour | Closes tickets in **Waiting** status that have not been updated in the configured number of working days |
| **Email poller** | Every 30 seconds | Checks Resend for new inbound messages and ingests any that haven't been processed |
| **Draft AI enrichment** | Every 10 seconds | Picks up any inbox drafts not yet AI-scanned and sends them to Claude Haiku for subject/priority/description generation |
| **Campaign scheduler** | Every 60 seconds | Dispatches any scheduled campaigns whose send time has passed; processes drip sequence steps for eligible contacts |
| **A/B winner picker** | Every 15 minutes | For A/B campaign variants sent more than 2 hours ago, picks the winner by open rate and sends it to remaining recipients |
| **Engagement score decay** | Monthly | Applies a 10% decay to all contact engagement scores (floor: 0) so old engagement doesn't inflate targeting |
| **Demo expiry checker** | Every hour | Checks demo tenants for expired demo dates; deactivates any that have passed their expiry |
| **Onboarding drip** | Daily | Sends onboarding tip emails to new tenants on Day 3 and Day 7 after signup |
| **Compose undo flush** | 5-second delay | When an agent clicks Send in the Compose window, actual delivery is delayed 5 seconds to allow the undo action |

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

---

## 27. Security & Access Control

### Tenant Isolation

Every database table includes a `tenant_id` column. Every query filters by it. When a request arrives:

1. The JWT is validated and the user's `tenant_id` is extracted
2. A PostgreSQL function (`set_tenant_context`) runs `SET LOCAL app.current_tenant_id = :id` on the database session
3. Row-Level Security (RLS) policies on each table enforce that only rows matching the current `tenant_id` are visible
4. No query can return data from another tenant — even if an API endpoint had a bug, the database layer enforces the boundary

### Authentication

- **JWT (JSON Web Tokens)**: HS256 algorithm, 8-hour expiry
- **Login**: `POST /api/v1/auth/login` with email + password returns an access token
- **Token refresh**: tokens expire after 8 hours; users must log in again
- **Password hashing**: bcrypt with a cost factor appropriate for the server hardware — plain-text passwords are never stored

### Roles and Permissions

| Role | Description |
|---|---|
| **Superadmin** | Platform-level admin; bypasses all tenant RLS; can impersonate any tenant; manages all clients |
| **Admin** | Tenant owner; full access to all settings and modules within their workspace |
| **Agent** | Standard team member; can use enabled modules; cannot change team or billing settings |
| **Viewer** | Read-only; cannot create, edit, or delete anything |
| **Custom** | Custom roles created by admins with per-module access levels (full / view / restricted) |

### Invite Links

- Team invite emails contain a one-time invite link
- Links expire after **7 days**
- Each link can only be used once — reuse is rejected
- After accepting, the new user sets their password and gains access

### Impersonation

- Superadmins can log in as any tenant's admin using a short-lived impersonation token
- The impersonation session is time-limited
- Every impersonation is **audit-logged**: superadmin email, target tenant, start time, and end time
- The amber impersonation banner is always visible during the session

### Webhook Security

All inbound webhooks use HMAC-SHA256 signature verification:

- **Resend** (inbound email): `Svix-Signature` header verified against the Resend signing secret
- **Sendcloud** (shipping updates): `X-Sendcloud-Signature` header verified against the Sendcloud API secret
- **Stripe** (billing events): `Stripe-Signature` header verified against the Stripe webhook secret
- **ERP orders**: `X-Webhook-Signature` header verified against the rotatable workspace secret

Requests with invalid or missing signatures are rejected with a 403 before any processing occurs.

### Data at Rest

- All data stored in PostgreSQL 16
- Railway manages disk encryption at rest
- Backups are managed by Railway's Postgres plugin

---

## 28. Module: AI Assistant (Jarvis)

Jarvis is the AI layer that runs throughout the platform. Most of its features are available when the `ai` module is enabled for the tenant.

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

| Module | AI Feature | Trigger |
|---|---|---|
| Inbox | Draft scanning | Automatic (every 10 seconds) |
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

### AI Scan Usage

Each inbox draft AI scan counts against the tenant's monthly AI scan limit (determined by the subscription plan). The current usage and limit are visible on the **Subscription** page. When the limit is reached, new drafts are stored but not scanned until the next billing period or a plan upgrade.

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

*End of manual. For the latest changes, refer to the git commit history on the `sandbox` branch.*
