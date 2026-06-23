/**
 * Yippie Sales Tracking Snippet — commerce edition
 * Tracks page views, purchases, and custom events on client websites.
 *
 * Usage:
 *   <script src="https://getyippie.com/sales.js" data-token="YOUR_TOKEN" async></script>
 *   <script>
 *     yippie.identify('customer@example.com');
 *     yippie.track('purchase', { order_id: '123', value: 49.99, currency: 'EUR' });
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
  var DOMAIN = 'commerce';
  var SDK_VERSION = '1.0.0';
  var ANON_KEY = 'yippie_anon_id';
  var QUEUE_KEY = 'yippie_queue';
  var MAX_QUEUE = 20;
  var FLUSH_DELAY = 2000;

  if (!TOKEN) {
    console.warn('[Yippie] Missing data-token attribute on sales.js script tag.');
    return;
  }

  // ── Consent gate ─────────────────────────────────────────────────────────
  function hasConsent() {
    if (typeof window.__yippie_consent !== 'undefined') {
      return window.__yippie_consent !== false;
    }
    return true;
  }

  // ── Anonymous ID ─────────────────────────────────────────────────────────
  function getAnonId() {
    try {
      var id = localStorage.getItem(ANON_KEY);
      if (!id) {
        id = 'anon-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(ANON_KEY, id);
      }
      return id;
    } catch (_) {
      return 'anon-' + Math.random().toString(36).slice(2);
    }
  }

  // ── Session ID ────────────────────────────────────────────────────────────
  var SESSION_ID = 'sess-' + Math.random().toString(36).slice(2);

  // ── Queue helpers ─────────────────────────────────────────────────────────
  function loadQueue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch (_) { return []; }
  }

  function saveQueue(q) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE))); } catch (_) {}
  }

  var _flushTimer = null;
  var _contactEmail = null;

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

  // Flush on page hide (tab close, navigate away)
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);

  // ── Public API ────────────────────────────────────────────────────────────
  window.yippie = {
    identify: function (email) {
      _contactEmail = email;
      enqueue('identify', { email: email });
    },
    track: function (eventType, properties) {
      if (!hasConsent()) return;
      enqueue(eventType, properties || {});
    },
    pageview: function (props) {
      if (!hasConsent()) return;
      enqueue('pageview', Object.assign({ url: location.href, referrer: document.referrer }, props || {}));
    },
  };

  // Auto-pageview on load
  if (hasConsent()) {
    enqueue('pageview', { url: location.href, referrer: document.referrer });
  }
})();
