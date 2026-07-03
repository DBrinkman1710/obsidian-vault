const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const SETTING_DEFAULTS = { minutesPerEmail: 3, automationRate: 90, hourlyRate: 30 };

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

// ── Auth ─────────────────────────────────────────────────────────────────────

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

async function getMessageIds(token) {
  // gmail.metadata scope does not support the 'q' parameter — fetch recent and filter by date client-side
  const data = await gmailGet(`/users/me/messages?maxResults=500`, token);
  return data.messages || [];
}

function getHeader(msg, name) {
  return (msg.payload?.headers || [])
    .find(h => h.name.toLowerCase() === name.toLowerCase())
    ?.value || '';
}

async function fetchMetadataBatch(ids, token, onProgress) {
  const results = [];
  const CHUNK = 10;

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const settled = await Promise.allSettled(
      chunk.map(({ id }) =>
        gmailGet(
          `/users/me/messages/${id}?format=metadata` +
          `&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject`,
          token
        )
      )
    );
    for (const r of settled) {
      if (r.status === 'fulfilled') results.push(r.value);
    }
    onProgress(Math.min(i + CHUNK, ids.length), ids.length);
  }

  return results;
}

// ── Classification ───────────────────────────────────────────────────────────

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

function classify(from, to, subject, userEmail, userDomain) {
  const f = from.toLowerCase();
  const s = subject.toLowerCase();

  if (NEWSLETTER_FROM.some(p => f.includes(p))) return 'newsletter';
  if (NEWSLETTER_SUBJECT.some(p => s.includes(p))) return 'newsletter';
  if (userDomain && f.includes(`@${userDomain}`)) return 'internal';
  if (QUERY_SIGNALS.some(p => s.includes(p))) return 'customer';
  if (to.toLowerCase().includes(userEmail.toLowerCase())) return 'customer';
  return 'other';
}

// ── Analysis ─────────────────────────────────────────────────────────────────

async function runAnalysis() {
  showState('state-loading');
  setText('loading-message', 'Connecting to Gmail…');
  setProgress(0, 0);

  try {
    const token = await getAuthToken();

    setText('loading-message', 'Reading your profile…');
    const profile = await getProfile(token);
    const userEmail = profile.emailAddress;
    const userDomain = userEmail.split('@')[1];

    setText('loading-message', 'Fetching message list…');
    const allIds = await getMessageIds(token);

    // Sample up to 200 most recent messages; filter to last 30 days client-side
    const sample = allIds.slice(0, 200);

    setText('loading-message', `Analysing ${allIds.length} emails…`);

    const messages = await fetchMetadataBatch(sample, token, (done, total) => {
      setProgress(done, total);
    });

    // Filter to last 30 days using internalDate (ms timestamp on each message)
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = messages.filter(m => parseInt(m.internalDate || '0') >= cutoff);

    // Classify
    const counts = { customer: 0, newsletter: 0, internal: 0, other: 0 };
    for (const msg of recent) {
      const from    = getHeader(msg, 'From');
      const to      = getHeader(msg, 'To');
      const subject = getHeader(msg, 'Subject');
      counts[classify(from, to, subject, userEmail, userDomain)]++;
    }

    const result = {
      total:      recent.length,
      customer:   counts.customer,
      newsletter: counts.newsletter,
      internal:   counts.internal,
      other:      counts.other,
      userEmail,
      analysedAt: Date.now(),
    };

    await chrome.storage.local.set({ cachedResult: result });
    showResults(result);

  } catch (err) {
    showError(err.message);
  }
}

// ── Display ──────────────────────────────────────────────────────────────────

async function showResults(r) {
  const s = await loadSettings();

  setText('stat-total-num',   r.total.toLocaleString());
  setText('stat-customer',    r.customer.toLocaleString());
  setText('stat-newsletter',  r.newsletter.toLocaleString());
  setText('stat-internal',    r.internal.toLocaleString());
  setText('stat-other',       r.other.toLocaleString());

  const triageHours = Math.round(r.customer * s.minutesPerEmail / 60);
  const savedHours  = Math.round(triageHours * s.automationRate / 100);
  const savedEuros  = savedHours * s.hourlyRate;

  setText('stat-triage-hours', `${triageHours} hrs/month`);
  setText('stat-saved-hours',  `~${savedHours} hrs/month`);
  setText('stat-saved-euros',  `€${savedEuros.toLocaleString()}/month`);

  const age = Date.now() - r.analysedAt;
  const ageStr = age < 60_000       ? 'just now'
               : age < 3_600_000    ? `${Math.round(age / 60_000)}m ago`
               :                      `${Math.round(age / 3_600_000)}h ago`;
  setText('analysed-at', ageStr);

  showState('state-results');
}

function showError(message) {
  const isAuth = message.toLowerCase().includes('oauth') ||
                 message.toLowerCase().includes('auth')  ||
                 message.toLowerCase().includes('sign');
  setText('error-message',
    isAuth
      ? "Couldn't access Gmail. Make sure you're signed into Chrome with a Google account."
      : `Something went wrong: ${message}`
  );
  showState('state-error');
}

// ── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // Attach all listeners upfront (elements are always in DOM, just hidden/shown)
  document.getElementById('btn-analyse').addEventListener('click', runAnalysis);
  document.getElementById('btn-refresh').addEventListener('click', async () => {
    await chrome.storage.local.remove('cachedResult');
    runAnalysis();
  });
  document.getElementById('btn-retry').addEventListener('click', runAnalysis);

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
      hourlyRate:      parseInt(document.getElementById('setting-rate').value),
    };
    await saveSettings(s);
    // If we came from results, recalculate with new settings
    const { cachedResult } = await chrome.storage.local.get('cachedResult');
    if (cachedResult) {
      showResults(cachedResult);
    } else {
      showState(stateBeforeSettings);
    }
  });

  // Settings — back
  document.getElementById('btn-settings-back').addEventListener('click', () => {
    showState(stateBeforeSettings);
  });

  // Show cached results if fresh
  const { cachedResult } = await chrome.storage.local.get('cachedResult');
  if (cachedResult && Date.now() - cachedResult.analysedAt < CACHE_TTL_MS) {
    showResults(cachedResult);
    return;
  }

  showState('state-welcome');
});
