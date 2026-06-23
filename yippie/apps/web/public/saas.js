/**
 * Yippie SaaS Tracking Snippet — product analytics edition
 * Tracks feature usage, onboarding steps, errors, and session activity.
 *
 * Usage:
 *   <script src="https://getyippie.com/saas.js" data-token="YOUR_TOKEN" async></script>
 *   <script>
 *     yippie.identify('user-id-123', { email: 'jan@acme.nl', name: 'Jan', plan: 'starter' });
 *     yippie.track('feature_used', { feature: 'csv_export' });
 *     yippie.track('onboarding_step', { step: 'connect_inbox', status: 'completed' });
 *     yippie.track('error_encountered', { code: 'QUOTA_EXCEEDED', feature: 'ai_scan' });
 *   </script>
 *
 * GDPR: set window.__yippie_consent = false before this script loads to disable tracking.
 */
(function () {
  'use strict';

  var script = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var TOKEN = script.dataset.token || '';
  var ENDPOINT = (script.dataset.endpoint || 'https://app.getyippie.com') + '/api/v1/public/track';
  var DOMAIN = 'saas';
  var SDK_VERSION = '1.0.0';
  var ANON_KEY = 'yippie_saas_anon_id';
  var QUEUE_KEY = 'yippie_saas_queue';
  var MAX_QUEUE = 50;
  var FLUSH_DELAY = 3000;

  if (!TOKEN) {
    console.warn('[Yippie] Missing data-token attribute on saas.js script tag.');
    return;
  }

  function hasConsent() {
    if (typeof window.__yippie_consent !== 'undefined') {
      return window.__yippie_consent !== false;
    }
    return true;
  }

  function getAnonId() {
    try {
      var id = localStorage.getItem(ANON_KEY);
      if (!id) {
        id = 'saas-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(ANON_KEY, id);
      }
      return id;
    } catch (_) {
      return 'saas-' + Math.random().toString(36).slice(2);
    }
  }

  var SESSION_ID = 'sess-' + Math.random().toString(36).slice(2);
  var _contactEmail = null;

  function loadQueue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch (_) { return []; }
  }

  function saveQueue(q) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE))); } catch (_) {}
  }

  var _flushTimer = null;

  function enqueue(eventType, properties) {
    var q = loadQueue();
    q.push({ event_type: eventType, properties: properties || {}, session_id: SESSION_ID, sdk_version: SDK_VERSION });
    saveQueue(q);
    scheduleFlush();
  }

  function scheduleFlush() {
    if (_flushTimer) return;
    _flushTimer = setTimeout(flush, FLUSH_DELAY);
  }

  function flush() {
    _flushTimer = null;
    if (!hasConsent()) return;
    var q = loadQueue();
    if (!q.length) return;
    saveQueue([]);

    var payload = {
      token: TOKEN,
      anonymous_id: getAnonId(),
      event_domain: DOMAIN,
      events: q,
    };
    if (_contactEmail) payload.contact_email = _contactEmail;

    var body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      var blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(ENDPOINT, blob);
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', ENDPOINT, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(body);
    }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);

  // ── Public API ────────────────────────────────────────────────────────────
  window.yippie = {
    /**
     * Link this browser session to a known Yippie contact.
     * @param {string} userId  Your internal user ID (stored in properties)
     * @param {Object} traits  e.g. { email, name, plan }
     */
    identify: function (userId, traits) {
      var t = traits || {};
      if (t.email) _contactEmail = t.email;
      enqueue('identify', Object.assign({ user_id: userId }, t));
    },
    /**
     * Track a custom event.
     * @param {string} eventType  e.g. 'feature_used', 'onboarding_step', 'error_encountered'
     * @param {Object} properties
     */
    track: function (eventType, properties) {
      if (!hasConsent()) return;
      enqueue(eventType, properties || {});
    },
    /**
     * Shorthand for tracking a session start.
     */
    session: function (props) {
      if (!hasConsent()) return;
      enqueue('session', Object.assign({ url: location.href }, props || {}));
    },
  };

  // Auto session start
  if (hasConsent()) {
    enqueue('session', { url: location.href, referrer: document.referrer });
  }
})();
