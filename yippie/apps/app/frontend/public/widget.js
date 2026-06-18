(function () {
  'use strict';

  const cfg = window.__YIPPIE_CHAT_CONFIG__ || window.__SMB_CHAT_CONFIG__ || {};
  const tenantSlug = cfg.tenant || document.currentScript?.getAttribute('data-tenant');
  const defaultHost = cfg.host || 'app.getyippie.com';
  const wsBase = cfg.wsBase || (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + defaultHost;
  // localStorage persists across tabs and page reloads so the visitor reuses
  // the same session as long as it stays open. The backend filters is_open=true,
  // so a new session is automatically created once the agent closes the old one.
  const sessionId = localStorage.getItem('smb_chat_sid') || crypto.randomUUID();
  localStorage.setItem('smb_chat_sid', sessionId);

  let ws = null;
  let isOpen = false;
  let greeted = false;

  // --- Build UI ---
  const btn = document.createElement('button');
  btn.innerHTML = '💬';
  Object.assign(btn.style, {
    position: 'fixed', bottom: '24px', right: '24px', width: '52px', height: '52px',
    borderRadius: '50%', background: '#2563eb', color: '#fff', border: 'none',
    fontSize: '22px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,.2)', zIndex: 9998,
  });

  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed', bottom: '90px', right: '24px', width: '340px', height: '460px',
    background: '#fff', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,.15)',
    display: 'none', flexDirection: 'column', zIndex: 9999, overflow: 'hidden',
    fontFamily: 'system-ui, sans-serif',
  });

  const header = document.createElement('div');
  Object.assign(header.style, {
    background: '#2563eb', color: '#fff', padding: '14px 16px',
    fontWeight: '600', fontSize: '15px',
  });
  header.textContent = 'Support Chat';

  const messages = document.createElement('div');
  Object.assign(messages.style, {
    flex: '1', overflowY: 'auto', padding: '12px 16px', display: 'flex',
    flexDirection: 'column', gap: '8px',
  });

  const inputRow = document.createElement('div');
  Object.assign(inputRow.style, {
    display: 'flex', gap: '8px', padding: '10px 12px', borderTop: '1px solid #e2e8f0',
  });
  const input = document.createElement('input');
  Object.assign(input.style, {
    flex: '1', padding: '8px 12px', borderRadius: '20px', border: '1px solid #cbd5e1',
    fontSize: '14px', outline: 'none',
  });
  input.placeholder = 'Type a message...';
  const sendBtn = document.createElement('button');
  sendBtn.textContent = '→';
  Object.assign(sendBtn.style, {
    padding: '8px 14px', background: '#2563eb', color: '#fff', border: 'none',
    borderRadius: '20px', cursor: 'pointer', fontWeight: '700',
  });

  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);
  panel.appendChild(header);
  panel.appendChild(messages);
  panel.appendChild(inputRow);
  document.body.appendChild(btn);
  document.body.appendChild(panel);

  // --- Chat bubble helper ---
  function addBubble(body, fromAgent) {
    const bubble = document.createElement('div');
    Object.assign(bubble.style, {
      maxWidth: '80%', padding: '8px 12px', borderRadius: '12px', fontSize: '14px',
      background: fromAgent ? '#f1f5f9' : '#2563eb',
      color: fromAgent ? '#1e293b' : '#fff',
      alignSelf: fromAgent ? 'flex-start' : 'flex-end',
    });
    bubble.textContent = body;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
  }

  // --- WebSocket ---
  function connect() {
    ws = new WebSocket(`${wsBase}/api/v1/chat/ws/${tenantSlug}/${sessionId}`);
    ws.onopen = async () => {
      if (greeted) return; // reconnect — don't replay history or greeting
      greeted = true;
      const httpBase = wsBase.replace(/^wss?/, location.protocol === 'https:' ? 'https' : 'http');
      try {
        const res = await fetch(`${httpBase}/api/v1/chat/public/sessions/${sessionId}/messages?tenant_slug=${tenantSlug}`);
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          data.messages.forEach(m => addBubble(m.body, m.sender_type === 'agent'));
          return; // history restored — skip greeting
        }
      } catch (_) {}
      addBubble('Hi! How can we help you today?', true);
    };
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.event === 'message' && data.sender_type === 'agent') {
        addBubble(data.body, true);
      }
    };
    ws.onclose = () => { setTimeout(connect, 3000); };
  }

  function sendMessage() {
    const body = input.value.trim();
    if (!body || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ body, sender_type: 'visitor', sender_id: sessionId }));
    addBubble(body, false);
    input.value = '';
  }

  // --- Events ---
  btn.addEventListener('click', () => {
    isOpen = !isOpen;
    panel.style.display = isOpen ? 'flex' : 'none';
    if (isOpen && !ws) {
      connect();
      addBubble('Hi! How can we help you today?', true);
    }
  });
  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });
})();
