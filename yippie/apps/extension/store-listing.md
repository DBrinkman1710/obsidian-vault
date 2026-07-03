# Chrome Web Store Listing — Yippie Inbox Analyser

## Name
Yippie Inbox Analyser

## Short description (132 chars max)
See how much time you spend on manual email triage — and what Yippie saves you. Free, private, instant.

## Full description

**Find out what your inbox is actually costing you.**

Install the Yippie Inbox Analyser, click Analyse, and get a breakdown of your last 30 days of Gmail in under a minute:

- How many emails are genuine customer conversations
- How many are newsletters and automated mail
- How many hours you're spending on manual triage
- What that time is worth — and how much Yippie saves

**Your data never leaves your browser.**

The extension reads email headers only (sender, subject, date) — never the message body or attachments. Everything is analysed locally on your device. Nothing is sent to Yippie's servers.

**Adjust the assumptions to match your reality.**

Use the settings panel to change minutes per email, automation rate, and your hourly rate. The estimate updates instantly.

**No account required.**

You don't need a Yippie account to use the analyser. It works for anyone with a Gmail inbox.

---

Yippie is an all-in-one customer service platform for small and medium businesses. Learn more at getyippie.com.

---

## Permission justification
(paste this into the "Permission justification" field during store submission)

**identity**
Used to obtain a Google OAuth token via chrome.identity.getAuthToken() so the extension can call the Gmail API on the user's behalf. The user explicitly grants access through the Google consent screen.

**storage**
Used to cache the analysis result in chrome.storage.local for up to one hour so the popup loads instantly on repeat opens, and to persist the user's settings (minutes per email, automation rate, hourly rate). No data is synced or transmitted externally.

**Gmail API — gmail.metadata scope**
The extension reads email metadata (sender, recipient, subject, date) for messages from the last 30 days to classify them into categories (customer conversations, newsletters, internal, other) and calculate triage time estimates. Message bodies, attachments, and drafts are never accessed. All processing happens locally in the browser. No email data is transmitted to Yippie or any third party.

---

## Privacy policy URL
https://getyippie.com/privacy

## Category
Productivity

## Screenshots needed (1280x800 or 640x400)
1. Welcome state — "Analyse my Gmail inbox" button
2. Loading state — progress bar fetching emails
3. Results state — full breakdown with savings card
4. Settings panel — sliders for minutes/rate/automation

## Pricing
Free
