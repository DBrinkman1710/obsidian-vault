# Yippie Inbox Analyser — Chrome Extension

Reads Gmail or Outlook header metadata in-browser to show prospects how much time they spend on manual triage, and what Yippie saves them.

---

## One-time setup (do this once)

### Step 1 — Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown at the top → **New Project** → name it "Yippie Extension" → Create
3. In the left sidebar: **APIs & Services → Library**
4. Search "Gmail API" → click it → **Enable**

### Step 2 — Configure the OAuth consent screen

1. **APIs & Services → OAuth consent screen**
2. User type: **External** → Create
3. Fill in:
   - App name: `Yippie Inbox Analyser`
   - User support email: your email
   - Developer contact: your email
4. Click **Save and Continue**
5. On the Scopes screen, click **Add or Remove Scopes**
   - Search for `gmail.metadata` → check it → Update
6. Click **Save and Continue**
7. On the Test users screen, click **Add Users** → add your own Gmail address
8. Click **Save and Continue** → **Back to Dashboard**

### Step 3 — Create OAuth credentials

1. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
2. Application type: **Chrome Extension**
3. Name: `Yippie Inbox Analyser`
4. Leave "Item ID" blank for now (you'll fill it in after loading the extension)
5. Click **Create** → copy the **Client ID** (looks like `1234567890-abc123.apps.googleusercontent.com`)

### Step 4 — Load the extension in Chrome

1. Open Chrome → go to `chrome://extensions`
2. Toggle **Developer mode** on (top right)
3. Click **Load unpacked** → select the `apps/extension/` folder
4. The extension appears — copy its **ID** (a long string of random letters)

### Step 5 — Wire the extension ID into Google Cloud

1. Back in Google Cloud → **APIs & Services → Credentials** → click your OAuth client
2. Under "Item ID", paste the extension ID you just copied → Save

### Step 6 — Add the client ID to the manifest

1. Open `apps/extension/manifest.json`
2. Replace `PASTE_YOUR_CLIENT_ID_HERE.apps.googleusercontent.com` with your actual Client ID
3. Back in `chrome://extensions` → click the **↻ reload** button on the extension card

### Step 7 — Generate icons

1. Open `apps/extension/create-icons.html` in Chrome (File → Open File)
2. It automatically downloads 4 PNG files
3. Move them into `apps/extension/icons/`
4. Reload the extension again in `chrome://extensions`

---

## Outlook setup (Microsoft Graph)

The Outlook button uses the Microsoft identity platform with PKCE — no client secret ships in the extension.

### Step 1 — Register an Azure app (or reuse Yippie's EML1 app)

1. Go to [portal.azure.com](https://portal.azure.com) → **Microsoft Entra ID → App registrations → New registration**
   - Or reuse the existing Yippie email-linking app registration (the one behind `MS_OAUTH_CLIENT_ID`) and just add the extension's redirect URI to it
2. Name: `Yippie Inbox Analyser`
3. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts** (so both work/school and outlook.com users can sign in)
4. Skip the redirect URI for now → **Register** → copy the **Application (client) ID**

### Step 2 — Add the extension redirect URI as a SPA platform

1. In the app registration: **Authentication → Add a platform → Single-page application**
2. Redirect URI: `https://<YOUR_EXTENSION_ID>.chromiumapp.org/`
   - The extension ID is the same one from `chrome://extensions` (Step 4 above)
   - It MUST be registered as **SPA**, not Web — otherwise the PKCE token exchange from the popup fails with a CORS error
3. Save

### Step 3 — API permissions

1. **API permissions → Add a permission → Microsoft Graph → Delegated permissions**
2. Add `User.Read` and `Mail.ReadBasic` (headers only — no body, no attachments)
3. Save. No admin consent needed; users consent individually on first sign in.

### Step 4 — Wire the client ID into the extension

1. Open `apps/extension/popup.js`
2. Replace the `MS_CLIENT_ID` placeholder with the Application (client) ID
3. Reload the extension in `chrome://extensions`

Note: unlike Google, the extension ID changes if you load the unpacked folder from a different path. After Web Store publication, add the production extension ID's redirect URI to the Azure app as well.

---

## Testing it

Click the Yippie icon in your Chrome toolbar. Hit "Analyse my Gmail inbox" or "Analyse my Outlook inbox".

**Outlook:** the first run opens a Microsoft sign-in window — sign in and accept. It fetches up to 500 inbox message headers from the last 30 days via Microsoft Graph (`Mail.ReadBasic`: sender, subject, date — never the body). Classification uses Outlook's own Focused/Other split plus the same keyword fallbacks (EN + NL).

The first run asks for Gmail permission — click Allow. It then fetches up to 500 INBOX message headers (never the email body, never sent mail or drafts), keeps the ones from the last 30 days, and shows the breakdown, top senders, and insights. Classification uses Gmail's own category labels + the List-Unsubscribe header, with keyword fallbacks (EN + NL).

Results are cached for 1 hour. Click ↻ to re-analyse.

---

## Publishing to the Chrome Web Store (when ready)

1. Zip the `apps/extension/` folder contents (not the folder itself)
2. Go to [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)
3. Pay the one-time $5 developer fee
4. Upload the zip → fill in store listing → submit for review
5. Review takes 1–7 business days
6. After approval, update the OAuth client ID with the production extension ID

You'll also need to publish the OAuth consent screen (verify your domain, add privacy policy URL at getyippie.com/privacy).
