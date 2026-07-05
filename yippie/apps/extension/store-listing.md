# Chrome Web Store Listing — Yippie Inbox Analyser

## Name
Yippie Inbox Analyser

## Short description (132 chars max)
See how much time you spend on email triage in Gmail or Outlook, and what Yippie saves you. Free, private, instant.

## Full description

**Find out what your inbox is actually costing you.**

Install the Yippie Inbox Analyser, click Analyse, and get a breakdown of your last 30 days of Gmail or Outlook in under a minute:

- How many emails are genuine customer conversations, using Gmail's own categories (or Outlook's Focused/Other split)
- How many are newsletters and automated mail
- Your top 5 senders and your busiest day of the week
- How many hours you're spending on manual triage
- What that time is worth, and how much Yippie saves

One click copies a shareable text report to your clipboard.

**Your data never leaves your browser.**

The extension reads email headers only (sender, subject, date), never the message body or attachments. Everything is analysed locally on your device. Nothing is sent to Yippie's servers.

**Adjust the assumptions to match your reality.**

Use the settings panel to change minutes per email, automation rate, and your hourly rate. The estimate updates instantly.

**No account required.**

You don't need a Yippie account to use the analyser. It works for anyone with a Gmail or Outlook inbox.

---

Yippie is an all-in-one customer service platform for small and medium businesses. Learn more at getyippie.com.

---

## Permission justification
(paste this into the "Permission justification" field during store submission)

**identity**
Used to obtain a Google OAuth token via chrome.identity.getAuthToken() so the extension can call the Gmail API on the user's behalf, and to run the Microsoft sign in flow via chrome.identity.launchWebAuthFlow() (PKCE) so the extension can call Microsoft Graph. The user explicitly grants access through the Google or Microsoft consent screen.

**storage**
Used to cache the analysis result in chrome.storage.local for up to one hour so the popup loads instantly on repeat opens, and to persist the user's settings (minutes per email, automation rate, hourly rate). No data is synced or transmitted externally.

**Gmail API — gmail.metadata scope**
The extension reads email metadata (sender, recipient, subject, date, Gmail category labels, List-Unsubscribe header) for up to 500 recent INBOX messages from the last 30 days, to classify them into categories (customer conversations, newsletters, internal, other), list top senders, and calculate triage time estimates. Message bodies, attachments, drafts, and sent mail are never accessed. All processing happens locally in the browser. No email data is transmitted to Yippie or any third party.

**Microsoft Graph — Mail.ReadBasic + User.Read scopes**
The same analysis for Outlook inboxes: the extension reads message metadata (sender, recipients, subject, received date, Focused/Other classification) for up to 500 inbox messages from the last 30 days. Mail.ReadBasic explicitly excludes message bodies and attachments. User.Read is used only to read the signed in user's email address so internal mail (same domain) can be recognised. All processing happens locally in the browser. No email data is transmitted to Yippie or any third party.

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
