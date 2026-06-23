(function () {
  'use strict';

  const cfg = window.__YIPPIE_LEAD_CONFIG__ || {};
  const tenantSlug = cfg.tenant || document.currentScript?.getAttribute('data-tenant');
  const defaultHost = cfg.host || 'app.getyippie.com';
  const apiBase = cfg.apiBase || 'https://' + defaultHost;

  if (!tenantSlug) return;

  let isOpen = false;

  // --- Build UI ---
  const btn = document.createElement('button');
  btn.textContent = 'Get in touch';
  Object.assign(btn.style, {
    position: 'fixed', bottom: '24px', right: '24px',
    padding: '12px 20px', borderRadius: '24px',
    background: '#2563eb', color: '#fff', border: 'none',
    fontSize: '14px', fontWeight: '600', cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,.2)', zIndex: 9998,
    fontFamily: 'system-ui, sans-serif',
  });

  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed', bottom: '76px', right: '24px', width: '320px',
    background: '#fff', borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,.15)',
    display: 'none', flexDirection: 'column', zIndex: 9999, overflow: 'hidden',
    fontFamily: 'system-ui, sans-serif',
  });

  const header = document.createElement('div');
  Object.assign(header.style, {
    background: '#2563eb', color: '#fff', padding: '14px 16px',
    fontWeight: '600', fontSize: '15px',
  });
  header.textContent = 'Contact us';

  const body = document.createElement('div');
  Object.assign(body.style, { padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' });

  function makeInput(type, placeholder, required) {
    const el = document.createElement('input');
    el.type = type;
    el.placeholder = placeholder + (required ? ' *' : '');
    el.required = !!required;
    Object.assign(el.style, {
      padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1',
      fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box',
    });
    return el;
  }

  function makeTextarea(placeholder) {
    const el = document.createElement('textarea');
    el.placeholder = placeholder;
    el.rows = 3;
    Object.assign(el.style, {
      padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1',
      fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box',
      resize: 'vertical',
    });
    return el;
  }

  const nameInput = makeInput('text', 'Full name', true);
  const emailInput = makeInput('email', 'Email address', true);
  const phoneInput = makeInput('tel', 'Phone number', false);
  const messageInput = makeTextarea('Message (optional)');

  const errMsg = document.createElement('p');
  Object.assign(errMsg.style, { color: '#dc2626', fontSize: '13px', margin: '0', display: 'none' });

  const submitBtn = document.createElement('button');
  submitBtn.textContent = 'Send';
  Object.assign(submitBtn.style, {
    padding: '10px', background: '#2563eb', color: '#fff', border: 'none',
    borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
  });

  const successMsg = document.createElement('p');
  Object.assign(successMsg.style, {
    color: '#16a34a', fontSize: '14px', fontWeight: '500', textAlign: 'center',
    margin: '8px 0', display: 'none',
  });
  successMsg.textContent = "Thanks! We'll be in touch.";

  body.appendChild(nameInput);
  body.appendChild(emailInput);
  body.appendChild(phoneInput);
  body.appendChild(messageInput);
  body.appendChild(errMsg);
  body.appendChild(submitBtn);
  body.appendChild(successMsg);

  panel.appendChild(header);
  panel.appendChild(body);
  document.body.appendChild(btn);
  document.body.appendChild(panel);

  // --- Submit ---
  submitBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    if (!name || !email) {
      errMsg.textContent = 'Please fill in your name and email.';
      errMsg.style.display = 'block';
      return;
    }
    errMsg.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    try {
      const res = await fetch(`${apiBase}/api/v1/public/lead/${tenantSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone: phoneInput.value.trim() || null,
          message: messageInput.value.trim() || null,
        }),
      });
      if (!res.ok) throw new Error('server error');
      submitBtn.style.display = 'none';
      successMsg.style.display = 'block';
    } catch (_) {
      errMsg.textContent = 'Something went wrong. Please try again.';
      errMsg.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send';
    }
  });

  // --- Toggle ---
  btn.addEventListener('click', () => {
    isOpen = !isOpen;
    panel.style.display = isOpen ? 'flex' : 'none';
  });
})();
