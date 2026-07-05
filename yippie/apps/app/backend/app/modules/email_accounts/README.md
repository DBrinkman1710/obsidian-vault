# email_accounts (EML1) — linked Gmail/Outlook mailboxes

Optional OAuth email transport. A tenant (shared support mailbox) or an
individual agent (personal mailbox) connects Gmail or Outlook; inbound mail
syncs into the normal draft ticket flow every 60s, and replies/composes with
that From address go out via the provider API (threaded, lands in Sent).
Resend stays the default for everyone who does not connect — with no env vars
set, the Connect buttons never render and nothing changes.

## Environment variables (per Railway environment)

| Var | Notes |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | Google Cloud OAuth client (Web application) |
| `MS_OAUTH_CLIENT_ID` / `MS_OAUTH_CLIENT_SECRET` | Azure app registration client + secret |
| `EMAIL_TOKEN_ENCRYPTION_KEY` | `python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` — generate ONCE per environment. Rotating/losing it orphans all stored tokens: accounts show as revoked and users must reconnect. |

Set any provider's pair to enable that provider; leave empty to hide it.

## Redirect URIs to register (per provider, per domain)

```
https://app.getyippie.com/api/v1/email-accounts/callback/gmail
https://app.getyippie.com/api/v1/email-accounts/callback/outlook
https://sandbox.getyippie.com/api/v1/email-accounts/callback/gmail
https://sandbox.getyippie.com/api/v1/email-accounts/callback/outlook
http://localhost:8000/api/v1/email-accounts/callback/gmail      (local dev)
http://localhost:8000/api/v1/email-accounts/callback/outlook    (local dev)
```

## Google Cloud setup (start EARLY — verification takes weeks)

1. Create a project → APIs & Services → enable the **Gmail API**.
2. OAuth consent screen: External. Add scopes `gmail.send` + `gmail.readonly`
   (+ `openid`, `email`). Add your own Gmail as a **test user**.
3. Credentials → OAuth client (Web application) → add the redirect URIs above.
4. **Testing mode limits**: max 100 test users; refresh tokens expire after
   **7 days** — sandbox accounts will show "Disconnected" weekly until verified.
5. **Production**: `gmail.send`/`gmail.readonly` are *restricted* scopes →
   Google's restricted-scope verification: privacy policy on getyippie.com,
   demo video of the OAuth flow, and (usually) an annual CASA security
   assessment. Budget several weeks of lead time.

## Azure setup (no heavyweight review)

1. Entra ID → App registrations → New. Supported account types:
   **Accounts in any organizational directory and personal Microsoft accounts**.
2. Add the redirect URIs above (type: Web).
3. API permissions (Delegated, Microsoft Graph): `Mail.Read`, `Mail.Send`,
   `offline_access`, `openid`, `email`. No admin consent needed.
4. Certificates & secrets → new client secret (note the expiry!).
5. Optional: publisher verification removes the "unverified" consent warning.
6. Graph **rotates refresh tokens on every refresh** — handled in
   `service.get_valid_access_token` (always persists the returned token).

## Operational caveats

- **No Resend fallback on send failure**: sending from a Gmail address via
  Resend would fail SPF/DKIM. Failed sends stay in `pending_sends` and retry
  via the existing lease machinery; `invalid_grant` marks the account revoked
  (Reconnect button appears in settings).
- **Forwarding loop**: if a mailbox both forwards to the tenant's Resend
  inbound address AND is linked here, every mail is ingested twice. Tell the
  client to disable the forward when linking.
- **Loop prevention**: sync skips mail sent by the linked address itself and
  anything carrying the `X-Yippie-Sent: 1` header.
- **Old mail is never backfilled**: linking baselines the cursor (Gmail
  historyId / Graph deltaLink) at connect time.
- Account status: `active` → syncs; `error` (5 consecutive sync failures) →
  keeps retrying, amber badge; `revoked` → terminal until reconnect.
- Delivery/open tracking only exists for Resend sends — provider-sent rows
  have `outbound_emails.provider != 'resend'` and are skipped by the Resend
  status poller.

## Verification checklist (sandbox)

1. Set the 5 env vars in the Railway Sandbox environment; register the
   sandbox redirect URIs; deploy (`git push origin sandbox`).
2. Settings → Profile → Connect Gmail (with a test-user Gmail). Expect the
   success toast and an Active badge.
3. Send an external mail to the linked Gmail → draft appears in the Personal
   inbox within ~60s (`poll_oauth_inboxes` in the logs), with attachments.
4. Reply choosing the linked From → arrives threaded, shows in Gmail Sent,
   and is NOT re-ingested.
5. Revoke at myaccount.google.com → within a minute the account flips to
   Disconnected; Reconnect works.
6. Regression: a tenant without linked accounts sends/receives via Resend
   exactly as before.
