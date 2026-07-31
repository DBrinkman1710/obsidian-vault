/**
 * [WGT1] Yippie booking widget — embeddable slot picker.
 *
 *   <script src="https://app.getyippie.com/booking-widget.js" data-tenant="SLUG" async></script>
 *
 * Wraps the public /api/v1/public/meet/{slug} endpoints, which already served
 * the hosted /meet/{slug} page but had no embeddable front end. Styling and
 * copy come from /api/v1/public/widget-config/{slug}, so a tenant restyles it
 * from Settings without the embedding site touching this snippet.
 *
 * Config may also be passed explicitly:
 *   window.__YIPPIE_BOOKING_CONFIG__ = { tenant: 'slug', host: 'sandbox.getyippie.com' }
 */
(function () {
  'use strict';

  const cfg = window.__YIPPIE_BOOKING_CONFIG__ || {};
  const script = document.currentScript;
  const tenantSlug = cfg.tenant || (script && script.getAttribute('data-tenant'));
  const host = cfg.host || 'app.getyippie.com';
  const apiBase = cfg.apiBase || 'https://' + host;

  if (!tenantSlug) return;

  const FONT = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  let accent = '#5BA4F5';
  let isOpen = false;
  let slots = [];
  let selected = null;

  // --- Elements -------------------------------------------------------------
  const btn = document.createElement('button');
  const panel = document.createElement('div');
  const header = document.createElement('div');
  const body = document.createElement('div');

  Object.assign(btn.style, {
    position: 'fixed', bottom: '24px', right: '24px', padding: '12px 20px',
    borderRadius: '24px', color: '#fff', border: 'none', fontSize: '14px',
    fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,.2)',
    zIndex: 9998, fontFamily: FONT,
  });
  Object.assign(panel.style, {
    position: 'fixed', bottom: '76px', right: '24px', width: '340px',
    maxHeight: '70vh', background: '#fff', borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,.15)', display: 'none',
    flexDirection: 'column', zIndex: 9999, overflow: 'hidden', fontFamily: FONT,
  });
  Object.assign(header.style, {
    color: '#fff', padding: '14px 16px', fontWeight: '600', fontSize: '15px', flexShrink: '0',
  });
  Object.assign(body.style, {
    padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto',
  });

  panel.appendChild(header);
  panel.appendChild(body);

  function applyAccent(colour) {
    accent = colour;
    btn.style.background = colour;
    header.style.background = colour;
  }

  function input(type, placeholder, required) {
    const el = document.createElement(type === 'textarea' ? 'textarea' : 'input');
    if (type !== 'textarea') el.type = type;
    el.placeholder = placeholder + (required ? ' *' : '');
    if (type === 'textarea') el.rows = 2;
    Object.assign(el.style, {
      padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1',
      fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box',
      fontFamily: FONT, resize: type === 'textarea' ? 'vertical' : 'none',
    });
    return el;
  }

  function note(text, colour) {
    const p = document.createElement('p');
    p.textContent = text;
    Object.assign(p.style, { color: colour, fontSize: '13px', margin: '0', fontFamily: FONT });
    return p;
  }

  // Group slots by calendar day so the list reads like a diary rather than a
  // flat wall of timestamps.
  function groupByDay(list) {
    const days = new Map();
    list.forEach(function (s) {
      const d = new Date(s.start);
      const key = d.toDateString();
      if (!days.has(key)) days.set(key, []);
      days.get(key).push(s);
    });
    return days;
  }

  function renderSlots() {
    body.innerHTML = '';
    const open = slots.filter(function (s) { return s.available !== false; });

    if (!open.length) {
      body.appendChild(note('No times are available right now. Please check back later.', '#64748b'));
      return;
    }

    const days = groupByDay(open);
    days.forEach(function (daySlots, dayKey) {
      const label = document.createElement('p');
      label.textContent = new Date(dayKey).toLocaleDateString(undefined, {
        weekday: 'long', day: 'numeric', month: 'long',
      });
      Object.assign(label.style, {
        fontSize: '12px', fontWeight: '700', color: '#64748b', margin: '6px 0 2px',
        textTransform: 'uppercase', letterSpacing: '.03em',
      });
      body.appendChild(label);

      const row = document.createElement('div');
      Object.assign(row.style, { display: 'flex', flexWrap: 'wrap', gap: '6px' });
      daySlots.forEach(function (s) {
        const b = document.createElement('button');
        b.textContent = new Date(s.start).toLocaleTimeString(undefined, {
          hour: '2-digit', minute: '2-digit',
        });
        Object.assign(b.style, {
          padding: '6px 10px', borderRadius: '8px', border: '1px solid ' + accent,
          background: '#fff', color: accent, fontSize: '13px', fontWeight: '600',
          cursor: 'pointer', fontFamily: FONT,
        });
        b.addEventListener('click', function () { selected = s; renderForm(); });
        row.appendChild(b);
      });
      body.appendChild(row);
    });
  }

  function renderForm() {
    body.innerHTML = '';

    const when = document.createElement('p');
    const start = new Date(selected.start);
    when.textContent = start.toLocaleDateString(undefined, {
      weekday: 'long', day: 'numeric', month: 'long',
    }) + ' at ' + start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    Object.assign(when.style, {
      fontSize: '14px', fontWeight: '600', color: '#0f172a', margin: '0 0 4px', fontFamily: FONT,
    });

    const back = document.createElement('button');
    back.textContent = '← Pick another time';
    Object.assign(back.style, {
      background: 'none', border: 'none', color: '#64748b', fontSize: '12px',
      cursor: 'pointer', padding: '0', textAlign: 'left', fontFamily: FONT,
    });
    back.addEventListener('click', function () { selected = null; renderSlots(); });

    const name = input('text', 'Full name', true);
    const email = input('email', 'Email address', true);
    const message = input('textarea', 'Anything we should know?', false);
    const err = note('', '#dc2626');
    err.style.display = 'none';

    const submit = document.createElement('button');
    submit.textContent = 'Confirm booking';
    Object.assign(submit.style, {
      padding: '10px', background: accent, color: '#fff', border: 'none',
      borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: FONT,
    });

    submit.addEventListener('click', async function () {
      if (!name.value.trim() || !email.value.trim()) {
        err.textContent = 'Please fill in your name and email.';
        err.style.display = 'block';
        return;
      }
      err.style.display = 'none';
      submit.disabled = true;
      submit.textContent = 'Booking…';
      try {
        const res = await fetch(apiBase + '/api/v1/public/meet/' + encodeURIComponent(tenantSlug), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.value.trim(),
            email: email.value.trim(),
            slot_start: selected.start,
            slot_end: selected.end,
            message: message.value.trim() || null,
          }),
        });
        if (!res.ok) throw new Error('server error');
        body.innerHTML = '';
        body.appendChild(note("You're booked. A confirmation is on its way to your inbox.", '#16a34a'));
      } catch (_) {
        // The slot may have been taken between loading and confirming.
        err.textContent = 'That time is no longer available. Please pick another.';
        err.style.display = 'block';
        submit.disabled = false;
        submit.textContent = 'Confirm booking';
      }
    });

    [back, when, name, email, message, err, submit].forEach(function (el) { body.appendChild(el); });
  }

  async function loadSlots() {
    body.innerHTML = '';
    body.appendChild(note('Loading available times…', '#64748b'));
    try {
      const res = await fetch(apiBase + '/api/v1/public/meet/' + encodeURIComponent(tenantSlug));
      if (!res.ok) throw new Error('unavailable');
      const data = await res.json();
      slots = data.available_slots || [];
      renderSlots();
    } catch (_) {
      body.innerHTML = '';
      body.appendChild(note('Booking is unavailable right now. Please try again later.', '#64748b'));
    }
  }

  btn.addEventListener('click', function () {
    isOpen = !isOpen;
    panel.style.display = isOpen ? 'flex' : 'none';
    if (isOpen && !slots.length) loadSlots();
  });

  // --- Boot -----------------------------------------------------------------
  // Styling is fetched first so the button never flashes a default colour; if
  // the config call fails the widget still works on its built in defaults.
  (async function init() {
    let conf = null;
    try {
      const res = await fetch(apiBase + '/api/v1/public/widget-config/' + encodeURIComponent(tenantSlug));
      if (res.ok) conf = await res.json();
    } catch (_) { /* fall through to defaults */ }

    if (conf && conf.booking && conf.booking.enabled === false) return;

    applyAccent((conf && conf.accent_color) || accent);
    btn.textContent = (conf && conf.booking && conf.booking.button_text) || 'Book a meeting';
    header.textContent = (conf && conf.booking && conf.booking.heading) || 'Pick a time';

    document.body.appendChild(btn);
    document.body.appendChild(panel);
  })();
})();
