const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';
const GRAPH_API = 'https://graph.microsoft.com/v1.0';
const MS_AUTH_BASE = 'https://login.microsoftonline.com/common/oauth2/v2.0';
// Azure app registration (SPA platform, redirect URI = chrome.identity.getRedirectURL()).
// See README "Outlook setup" for how to create this.
const MS_CLIENT_ID = 'e9384111-0752-4993-a7be-e8bf6509b923';
const MS_SCOPES = 'User.Read Mail.ReadBasic';

const CACHE_KEY = 'cachedResult_v3'; // v3: normalized message shape + provider field
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const WINDOW_DAYS = 30;
const MAX_MESSAGES = 500; // hard cap on inbox messages fetched per analysis

const SETTING_DEFAULTS = { minutesPerEmail: 3, automationRate: 90, hourlyRate: 30 };

const PROVIDER_NAMES = { gmail: 'Gmail', outlook: 'Outlook' };
let lastProvider = 'gmail'; // remembered so Retry re-runs the same provider

async function loadSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...SETTING_DEFAULTS, ...settings };
}

async function saveSettings(s) {
  await chrome.storage.local.set({ settings: s });
}

// ── DOM helpers ──────────────────────────────────────────────────────────────

function showState(id) {
  document.querySelectorAll('.state').forEach(el => el.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setProgress(done, total) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const bar = document.getElementById('progress-bar');
  if (bar) bar.style.width = `${pct}%`;
  setText('progress-text', total > 0 ? `${done} / ${total}` : '');
}

// ── Auth — Google ────────────────────────────────────────────────────────────

function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(token);
      }
    });
  });
}

// ── Auth — Microsoft (PKCE, no client secret in the extension) ───────────────

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function msGetToken() {
  if (MS_CLIENT_ID.includes('PASTE_MS_CLIENT_ID_HERE')) {
    throw new Error('Outlook support is not configured yet: add the Azure client ID to popup.js (see README).');
  }

  const { msToken } = await chrome.storage.local.get('msToken');
  if (msToken && msToken.expiresAt > Date.now() + 60_000) return msToken.token;

  const redirectUri = chrome.identity.getRedirectURL();
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  ));

  const authUrl = `${MS_AUTH_BASE}/authorize?` + new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: MS_SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });

  const resultUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (url) => {
      if (chrome.runtime.lastError || !url) {
        reject(new Error(chrome.runtime.lastError?.message || 'Sign in was cancelled'));
      } else {
        resolve(url);
      }
    });
  });

  const params = new URL(resultUrl).searchParams;
  if (params.get('error')) {
    throw new Error(params.get('error_description') || params.get('error'));
  }
  const code = params.get('code');
  if (!code) throw new Error('Microsoft sign in returned no authorization code');

  const res = await fetch(`${MS_AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MS_CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
      scope: MS_SCOPES,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Microsoft auth failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  await chrome.storage.local.set({
    msToken: {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    },
  });
  return data.access_token;
}

// ── Gmail API ────────────────────────────────────────────────────────────────

async function gmailGet(path, token) {
  const res = await fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gmail API ${res.status}: ${body}`);
  }
  return res.json();
}

async function getProfile(token) {
  return gmailGet('/users/me/profile', token);
}

// gmail.metadata scope does not support the 'q' parameter, but labelIds works —
// restrict to INBOX so sent mail and drafts are never counted as received email.
// Paginate (newest first) up to MAX_MESSAGES; date filtering happens after the
// metadata fetch, which stops early once it runs past the 30-day window.
async function getInboxMessageIds(token) {
  const ids = [];
  let pageToken = '';
  while (ids.length < MAX_MESSAGES) {
    const data = await gmailGet(
      `/users/me/messages?maxResults=100&labelIds=INBOX` +
      (pageToken ? `&pageToken=${pageToken}` : ''),
      token
    );
    const page = data.messages || [];
    ids.push(...page);
    pageToken = data.nextPageToken;
    if (!pageToken || page.length === 0) break;
  }
  return ids.slice(0, MAX_MESSAGES);
}

function getHeader(msg, name) {
  return (msg.payload?.headers || [])
    .find(h => h.name.toLowerCase() === name.toLowerCase())
    ?.value || '';
}

async function fetchMetadataBatch(ids, token, cutoff, onProgress) {
  const results = [];
  const CHUNK = 10;

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const settled = await Promise.allSettled(
      chunk.map(({ id }) =>
        gmailGet(
          `/users/me/messages/${id}?format=metadata` +
          `&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject` +
          `&metadataHeaders=List-Unsubscribe`,
          token
        )
      )
    );
    let sawRecent = false;
    let sawAny = false;
    for (const r of settled) {
      if (r.status !== 'fulfilled') continue;
      sawAny = true;
      results.push(r.value);
      if (parseInt(r.value.internalDate || '0') >= cutoff) sawRecent = true;
    }
    onProgress(Math.min(i + CHUNK, ids.length), ids.length);
    // The list is newest-first: once a whole chunk is older than the window,
    // everything after it is too. Stop instead of burning quota.
    if (sawAny && !sawRecent) break;
  }

  return results;
}

// ── Microsoft Graph API ──────────────────────────────────────────────────────

async function graphGet(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Microsoft Graph ${res.status}: ${body}`);
  }
  return res.json();
}

// Unlike Gmail, Graph filters server-side by date and returns headers inline,
// so a single paginated list call covers the whole 30-day window.
async function getOutlookMessages(token, cutoff, onProgress) {
  const select = 'from,toRecipients,subject,receivedDateTime,inferenceClassification';
  let url = `${GRAPH_API}/me/mailFolders/inbox/messages?` + new URLSearchParams({
    $select: select,
    $filter: `receivedDateTime ge ${new Date(cutoff).toISOString()}`,
    $orderby: 'receivedDateTime desc',
    $top: '100',
  });
  const messages = [];
  while (url && messages.length < MAX_MESSAGES) {
    const data = await graphGet(url, token);
    messages.push(...(data.value || []));
    onProgress(Math.min(messages.length, MAX_MESSAGES), MAX_MESSAGES);
    url = data['@odata.nextLink'] || null;
  }
  const capped = messages.length > MAX_MESSAGES || !!url;
  messages.length = Math.min(messages.length, MAX_MESSAGES);
  return { messages, capped };
}

// ── Normalization — one message shape for both providers ────────────────────

function normalizeGmail(msg) {
  const labels = msg.labelIds || [];
  return {
    from: getHeader(msg, 'From'),
    to: getHeader(msg, 'To'),
    subject: getHeader(msg, 'Subject'),
    ts: parseInt(msg.internalDate || '0'),
    unsubscribe: !!getHeader(msg, 'List-Unsubscribe'),
    // Gmail's own tab categories are far more reliable than keyword matching
    automated: AUTOMATED_LABELS.some(l => labels.includes(l)),
    personal: labels.includes('CATEGORY_PERSONAL'),
  };
}

function formatGraphAddress(r) {
  const name = r?.emailAddress?.name || '';
  const addr = r?.emailAddress?.address || '';
  return name && name.toLowerCase() !== addr.toLowerCase() ? `${name} <${addr}>` : addr;
}

function normalizeOutlook(msg) {
  return {
    from: formatGraphAddress(msg.from),
    to: (msg.toRecipients || []).map(formatGraphAddress).join(', '),
    subject: msg.subject || '',
    ts: Date.parse(msg.receivedDateTime || '') || 0,
    unsubscribe: false, // Mail.ReadBasic exposes no List-Unsubscribe header
    // Outlook's Focused/Other split is its own automated-mail detector
    automated: msg.inferenceClassification === 'other',
    personal: msg.inferenceClassification === 'focused',
  };
}

// ── Classification ───────────────────────────────────────────────────────────

// Consumer mail domains: a sender sharing one of these with the user is not a colleague.
const PUBLIC_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.nl', 'outlook.com',
  'outlook.nl', 'live.com', 'live.nl', 'msn.com', 'yahoo.com', 'yahoo.nl',
  'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com',
  'ziggo.nl', 'kpnmail.nl', 'hetnet.nl', 'planet.nl', 'home.nl', 'xs4all.nl',
  'upcmail.nl', 'telfort.nl', 'casema.nl', 'zonnet.nl',
]);

const NEWSLETTER_FROM = [
  'no-reply@', 'noreply@', 'donotreply@', 'do-not-reply@', 'mailer-daemon@',
  'newsletter@', 'notifications@', 'updates@', 'digest@', 'news@',
  'marketing@', 'bounce@', 'bounces@', 'postmaster@', 'hello@sendgrid',
];

const NEWSLETTER_SUBJECT = [
  'unsubscribe', '% off', 'weekly digest', 'newsletter', 'flash sale',
  'limited time', 'deal of the day', 'daily update', 'confirm your email',
];

const QUERY_SIGNALS = [
  '?', 'help', 'issue', 'problem', 'question', 'request', 'support',
  'invoice', 'order', 'refund', 'cancel', 'complaint', 'feedback',
  'hoe ', 'wat ', 'wanneer', 'waarom', 'kan ik', 'graag', 'vraag',
];

const AUTOMATED_LABELS = [
  'CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS',
];

function classify(m, userEmail, userDomain) {
  const from = m.from.toLowerCase();
  const to = m.to.toLowerCase();
  const subject = m.subject.toLowerCase();

  if (
    m.unsubscribe ||
    m.automated ||
    NEWSLETTER_FROM.some(p => from.includes(p)) ||
    NEWSLETTER_SUBJECT.some(p => subject.includes(p))
  ) return 'newsletter';

  if (userDomain && !PUBLIC_DOMAINS.has(userDomain) && from.includes(`@${userDomain}`)) {
    return 'internal';
  }

  if (QUERY_SIGNALS.some(p => subject.includes(p))) return 'customer';
  if (m.personal && to.includes(userEmail.toLowerCase())) {
    return 'customer';
  }
  return 'other';
}

// ── Sender aggregation ───────────────────────────────────────────────────────

function parseSender(fromHeader) {
  const m = fromHeader.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (m) {
    const email = m[2].trim().toLowerCase();
    return { name: m[1].trim() || email, email };
  }
  const bare = fromHeader.trim().toLowerCase();
  return { name: fromHeader.trim() || bare, email: bare };
}

function topSenders(messages, limit = 5) {
  const bySender = new Map();
  for (const m of messages) {
    if (!m.from) continue;
    const { name, email } = parseSender(m.from);
    const entry = bySender.get(email) || { name, email, count: 0 };
    entry.count++;
    bySender.set(email, entry);
  }
  return [...bySender.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function busiestDay(messages) {
  if (!messages.length) return null;
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const m of messages) {
    counts[new Date(m.ts).getDay()]++;
  }
  const max = Math.max(...counts);
  const day = counts.indexOf(max);
  return { name: WEEKDAYS[day], count: max, pct: Math.round((max / messages.length) * 100) };
}

// ── Analysis ─────────────────────────────────────────────────────────────────

async function runAnalysis(provider) {
  lastProvider = provider;
  const providerName = PROVIDER_NAMES[provider];
  showState('state-loading');
  setText('loading-message', `Connecting to ${providerName}…`);
  setProgress(0, 0);

  try {
    const cutoff = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
    let userEmail, normalized, windowCovered;

    if (provider === 'outlook') {
      const token = await msGetToken();

      setText('loading-message', 'Reading your profile…');
      const me = await graphGet(`${GRAPH_API}/me?$select=mail,userPrincipalName`, token);
      userEmail = me.mail || me.userPrincipalName || '';

      setText('loading-message', 'Fetching your inbox…');
      const { messages, capped } = await getOutlookMessages(token, cutoff, setProgress);
      normalized = messages.map(normalizeOutlook);
      windowCovered = !capped;

    } else {
      const token = await getAuthToken();

      setText('loading-message', 'Reading your profile…');
      const profile = await getProfile(token);
      userEmail = profile.emailAddress;

      setText('loading-message', 'Fetching your inbox…');
      const sample = await getInboxMessageIds(token);

      setText('loading-message', `Analysing ${sample.length} recent emails…`);
      const raw = await fetchMetadataBatch(sample, token, cutoff, setProgress);
      normalized = raw.map(normalizeGmail);

      // Did we see the whole 30 days, or did the MAX_MESSAGES cap cut it short?
      windowCovered =
        raw.length < sample.length ||        // early-stopped: ran past the cutoff
        sample.length < MAX_MESSAGES ||      // inbox smaller than the cap
        normalized.some(m => m.ts < cutoff);
    }

    const userDomain = userEmail.split('@')[1]?.toLowerCase() || '';
    const recent = normalized.filter(m => m.ts >= cutoff);

    const counts = { customer: 0, newsletter: 0, internal: 0, other: 0 };
    for (const m of recent) {
      counts[classify(m, userEmail, userDomain)]++;
    }

    const oldestAt = recent.length ? Math.min(...recent.map(m => m.ts)) : Date.now();

    const result = {
      provider,
      total:      recent.length,
      customer:   counts.customer,
      newsletter: counts.newsletter,
      internal:   counts.internal,
      other:      counts.other,
      topSenders: topSenders(recent),
      busiestDay: busiestDay(recent),
      oldestAt,
      windowCovered,
      userEmail,
      analysedAt: Date.now(),
    };

    await chrome.storage.local.set({ [CACHE_KEY]: result });
    showResults(result);

  } catch (err) {
    showError(err.message, provider);
  }
}

// ── Display ──────────────────────────────────────────────────────────────────

function coverageLabel(r) {
  if (r.windowCovered) return `Last ${WINDOW_DAYS} days`;
  const days = Math.max(1, Math.round((r.analysedAt - r.oldestAt) / 86_400_000));
  return `Last ${days} days (${MAX_MESSAGES}-email sample)`;
}

function renderTopSenders(senders) {
  const wrap = document.getElementById('top-senders');
  wrap.replaceChildren();
  if (!senders || !senders.length) {
    wrap.classList.add('hidden');
    return;
  }
  wrap.classList.remove('hidden');
  const max = senders[0].count;
  for (const s of senders) {
    const row = document.createElement('div');
    row.className = 'sender-row';

    const name = document.createElement('span');
    name.className = 'sender-name';
    name.textContent = s.name; // untrusted string: textContent only, never innerHTML
    name.title = s.email;

    const bar = document.createElement('span');
    bar.className = 'sender-bar';
    const fill = document.createElement('span');
    fill.className = 'sender-bar-fill';
    fill.style.width = `${Math.max(8, Math.round((s.count / max) * 100))}%`;
    bar.appendChild(fill);

    const count = document.createElement('span');
    count.className = 'sender-count';
    count.textContent = s.count;

    row.append(name, bar, count);
    wrap.appendChild(row);
  }
}

function renderInsights(r) {
  const wrap = document.getElementById('insights');
  wrap.replaceChildren();
  const lines = [];
  if (r.busiestDay && r.total >= 10) {
    lines.push(`📈 ${r.busiestDay.name} is your busiest day: ${r.busiestDay.pct}% of your email.`);
  }
  if (r.total > 0 && r.newsletter > 0) {
    const pct = Math.round((r.newsletter / r.total) * 100);
    lines.push(`💤 ${pct}% of your inbox is newsletters and automated mail. Real conversations: ${r.customer}.`);
  }
  for (const text of lines) {
    const p = document.createElement('p');
    p.className = 'insight';
    p.textContent = text;
    wrap.appendChild(p);
  }
  wrap.classList.toggle('hidden', lines.length === 0);
}

function buildReport(r, s, savings) {
  const providerName = PROVIDER_NAMES[r.provider] || 'inbox';
  return [
    `My ${providerName} inbox, ${coverageLabel(r).toLowerCase()} (Yippie Inbox Analyser):`,
    `• ${r.total} inbox emails`,
    `• ${r.customer} customer conversations`,
    `• ${r.newsletter} newsletters and automated`,
    `• ${r.internal} internal, ${r.other} other`,
    r.busiestDay ? `• Busiest day: ${r.busiestDay.name} (${r.busiestDay.pct}%)` : null,
    `• Manual triage: about ${savings.triageHours} hrs/month`,
    `• Yippie could save about ${savings.savedHours} hrs (€${savings.savedEuros.toLocaleString()}/month)`,
    `Try it yourself: getyippie.com`,
  ].filter(Boolean).join('\n');
}

function computeSavings(r, s) {
  const triageHours = Math.round(r.customer * s.minutesPerEmail / 60);
  const savedHours  = Math.round(triageHours * s.automationRate / 100);
  const savedEuros  = savedHours * s.hourlyRate;
  return { triageHours, savedHours, savedEuros };
}

async function showResults(r) {
  const s = await loadSettings();

  const providerName = PROVIDER_NAMES[r.provider];
  setText('results-period', providerName ? `${coverageLabel(r)} · ${providerName}` : coverageLabel(r));
  setText('stat-total-num',   r.total.toLocaleString());
  setText('stat-customer',    r.customer.toLocaleString());
  setText('stat-newsletter',  r.newsletter.toLocaleString());
  setText('stat-internal',    r.internal.toLocaleString());
  setText('stat-other',       r.other.toLocaleString());

  renderTopSenders(r.topSenders);
  renderInsights(r);

  const savings = computeSavings(r, s);
  setText('stat-triage-hours', `${savings.triageHours} hrs/month`);
  setText('stat-saved-hours',  `~${savings.savedHours} hrs/month`);
  setText('label-euros',       `Value at €${s.hourlyRate}/hr`);
  setText('stat-saved-euros',  `€${savings.savedEuros.toLocaleString()}/month`);

  const age = Date.now() - r.analysedAt;
  const ageStr = age < 60_000       ? 'just now'
               : age < 3_600_000    ? `${Math.round(age / 60_000)}m ago`
               :                      `${Math.round(age / 3_600_000)}h ago`;
  setText('analysed-at', ageStr);

  showState('state-results');
}

function showError(message, provider) {
  const isAuth = /oauth|auth|sign|consent|cancel/i.test(message);
  setText('error-message',
    isAuth
      ? provider === 'outlook'
        ? "Couldn't access Outlook. Sign in with your Microsoft account and accept the requested permissions."
        : "Couldn't access Gmail. Make sure you're signed into Chrome with a Google account."
      : `Something went wrong: ${message}`
  );
  showState('state-error');
}

// ── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // Attach all listeners upfront (elements are always in DOM, just hidden/shown)
  document.getElementById('btn-analyse').addEventListener('click', () => runAnalysis('gmail'));
  document.getElementById('btn-analyse-outlook').addEventListener('click', () => runAnalysis('outlook'));
  document.getElementById('btn-refresh').addEventListener('click', async () => {
    const { [CACHE_KEY]: cached } = await chrome.storage.local.get(CACHE_KEY);
    const provider = cached?.provider || lastProvider;
    await chrome.storage.local.remove(['cachedResult', 'cachedResult_v2', CACHE_KEY]);
    runAnalysis(provider);
  });
  document.getElementById('btn-retry').addEventListener('click', () => runAnalysis(lastProvider));

  // Copy report — plain text to clipboard, nothing leaves the browser
  document.getElementById('btn-copy').addEventListener('click', async () => {
    const { [CACHE_KEY]: r } = await chrome.storage.local.get(CACHE_KEY);
    if (!r) return;
    const s = await loadSettings();
    const text = buildReport(r, s, computeSavings(r, s));
    try {
      await navigator.clipboard.writeText(text);
      setText('btn-copy', 'Copied ✓');
      setTimeout(() => setText('btn-copy', 'Copy report'), 1500);
    } catch {
      setText('btn-copy', 'Copy failed');
      setTimeout(() => setText('btn-copy', 'Copy report'), 1500);
    }
  });

  // Settings — open
  let stateBeforeSettings = 'state-welcome';
  const openSettings = async () => {
    stateBeforeSettings = document.querySelector('.state:not(.hidden)')?.id || 'state-welcome';
    const s = await loadSettings();
    const mEl = document.getElementById('setting-minutes');
    const aEl = document.getElementById('setting-automation');
    const rEl = document.getElementById('setting-rate');
    mEl.value = s.minutesPerEmail;
    aEl.value = s.automationRate;
    rEl.value = s.hourlyRate;
    setText('setting-minutes-val', `${s.minutesPerEmail} min`);
    setText('setting-automation-val', `${s.automationRate}%`);
    showState('state-settings');
  };
  document.getElementById('btn-settings-welcome').addEventListener('click', openSettings);
  document.getElementById('btn-settings-results').addEventListener('click', openSettings);

  // Settings — live slider labels
  document.getElementById('setting-minutes').addEventListener('input', e => {
    setText('setting-minutes-val', `${e.target.value} min`);
  });
  document.getElementById('setting-automation').addEventListener('input', e => {
    setText('setting-automation-val', `${e.target.value}%`);
  });

  // Settings — save
  document.getElementById('btn-settings-save').addEventListener('click', async () => {
    const s = {
      minutesPerEmail: parseInt(document.getElementById('setting-minutes').value),
      automationRate:  parseInt(document.getElementById('setting-automation').value),
      hourlyRate:      parseInt(document.getElementById('setting-rate').value) || SETTING_DEFAULTS.hourlyRate,
    };
    await saveSettings(s);
    // If we came from results, recalculate with new settings
    const { [CACHE_KEY]: cached } = await chrome.storage.local.get(CACHE_KEY);
    if (cached) {
      showResults(cached);
    } else {
      showState(stateBeforeSettings);
    }
  });

  // Settings — back
  document.getElementById('btn-settings-back').addEventListener('click', () => {
    showState(stateBeforeSettings);
  });

  // Show cached results if fresh
  const { [CACHE_KEY]: cached } = await chrome.storage.local.get(CACHE_KEY);
  if (cached && Date.now() - cached.analysedAt < CACHE_TTL_MS) {
    lastProvider = cached.provider || 'gmail';
    showResults(cached);
    return;
  }

  showState('state-welcome');
});
