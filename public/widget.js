(function () {
  'use strict';

  var scriptTag = document.currentScript;
  var API_KEY = scriptTag.getAttribute('data-api-key');
  var API_BASE = scriptTag.getAttribute('data-api-base') || new URL(scriptTag.src).origin;

  if (!API_KEY) {
    console.error('[BunnyBot] data-api-key manquant sur la balise <script>.');
    return;
  }

  var state = {
    open: false,
    loading: false,
    history: [], // {role, content}
    config: { welcomeMessage: 'Bonjour !', accentColor: '#52525B', botName: 'BunnyBot', iconStyle: 'bunny' },
    isNewConversation: true,
  };

  // ---------------------------------------------------------------------
  // Styles (scoped under #bunnybot-root to avoid leaking into host page)
  // ---------------------------------------------------------------------
  var css = [
    '#bunnybot-root{position:fixed;bottom:20px;right:20px;z-index:2147483000;',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}',

    '#bunnybot-bubble{width:60px;height:60px;border-radius:16px;border:none;cursor:pointer;',
    'box-shadow:0 6px 20px rgba(16,21,31,0.28);display:flex;align-items:center;justify-content:center;',
    'padding:6px;background:#FFFFFF;transition:transform .15s ease;overflow:hidden;}',
    '#bunnybot-bubble img{width:100%;height:100%;object-fit:contain;display:block;}',
    '#bunnybot-bubble svg{width:60%;height:60%;fill:var(--bb-accent);}',
    '#bunnybot-bubble:hover{transform:scale(1.06);}',

    '#bunnybot-panel{position:absolute;bottom:76px;right:0;width:340px;max-width:88vw;height:460px;',
    'max-height:70vh;background:#FFFFFF;border-radius:16px;box-shadow:0 16px 48px rgba(16,21,31,0.22);',
    'display:none;flex-direction:column;overflow:hidden;border:1px solid #E3E5EA;}',
    '#bunnybot-panel.bb-open{display:flex;}',

    '#bunnybot-header{background:#10151F;color:#FFFFFF;padding:14px 16px;display:flex;',
    'align-items:center;gap:10px;flex-shrink:0;}',
    '#bunnybot-header .bb-dot{width:8px;height:8px;border-radius:50%;background:var(--bb-accent);}',
    '#bunnybot-header .bb-name{font-weight:600;font-size:14.5px;letter-spacing:.01em;}',
    '#bunnybot-close{margin-left:auto;background:none;border:none;color:#FFFFFF;opacity:.7;',
    'cursor:pointer;font-size:18px;line-height:1;padding:4px;}',
    '#bunnybot-close:hover{opacity:1;}',

    '#bunnybot-messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;',
    'background:#FFFFFF;}',
    '.bb-msg{max-width:82%;padding:9px 12px;border-radius:14px;font-size:13.5px;line-height:1.45;',
    'word-wrap:break-word;white-space:pre-wrap;}',
    '.bb-msg-bot{align-self:flex-start;background:#F4F5F7;color:#10151F;border-bottom-left-radius:4px;}',
    '.bb-msg-user{align-self:flex-end;background:#10151F;color:#FFFFFF;border-bottom-right-radius:4px;}',
    '.bb-msg-typing{align-self:flex-start;background:#F4F5F7;color:#5B6472;font-style:italic;}',

    '#bunnybot-form{display:flex;gap:8px;padding:10px;border-top:1px solid #E3E5EA;',
    'background:#FFFFFF;flex-shrink:0;}',
    '#bunnybot-input{flex:1;border:1px solid #E3E5EA;border-radius:10px;padding:9px 11px;',
    'font-size:13.5px;font-family:inherit;outline:none;background:#fff;color:#10151F;}',
    '#bunnybot-input:focus{border-color:var(--bb-accent);}',
    '#bunnybot-send{background:var(--bb-accent);border:none;border-radius:10px;padding:0 14px;',
    'cursor:pointer;font-size:13.5px;font-weight:600;color:#FFFFFF;}',
    '#bunnybot-send:disabled{opacity:.5;cursor:default;}',
  ].join('');

  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ---------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------
  var root = document.createElement('div');
  root.id = 'bunnybot-root';
  root.innerHTML =
    '<div id="bunnybot-panel">' +
    '  <div id="bunnybot-header">' +
    '    <span class="bb-dot"></span>' +
    '    <span class="bb-name" id="bunnybot-name">BunnyBot</span>' +
    '    <button id="bunnybot-close" aria-label="Fermer">&times;</button>' +
    '  </div>' +
    '  <div id="bunnybot-messages"></div>' +
    '  <form id="bunnybot-form">' +
    '    <input id="bunnybot-input" type="text" placeholder="Écrivez votre question…" autocomplete="off" />' +
    '    <button id="bunnybot-send" type="submit">Envoyer</button>' +
    '  </form>' +
    '</div>' +
    '<button id="bunnybot-bubble" aria-label="Ouvrir le chat"></button>';
  document.body.appendChild(root);

  var panel = root.querySelector('#bunnybot-panel');
  var bubble = root.querySelector('#bunnybot-bubble');
  var closeBtn = root.querySelector('#bunnybot-close');
  var messagesEl = root.querySelector('#bunnybot-messages');
  var form = root.querySelector('#bunnybot-form');
  var input = root.querySelector('#bunnybot-input');
  var sendBtn = root.querySelector('#bunnybot-send');
  var nameEl = root.querySelector('#bunnybot-name');

  var BUBBLE_ICON_SVG =
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M12 3C7.03 3 3 6.58 3 11c0 2.39 1.19 4.53 3.08 6.02-.1.98-.5 2.24-1.45 3.48a.5.5 0 0 0 .5.79c2.03-.5 3.6-1.4 4.6-2.13.72.15 1.47.24 2.27.24 4.97 0 9-3.58 9-8s-4.03-8-9-8z"/>' +
    '</svg>';

  function renderBubbleIcon() {
    if (state.config.iconStyle === 'bubble') {
      bubble.innerHTML = BUBBLE_ICON_SVG;
    } else {
      bubble.innerHTML = '<img src="' + API_BASE + '/signup/assets/bunny-mascot.png" alt="" />';
    }
  }
  renderBubbleIcon();

  function appendMessage(role, text) {
    var el = document.createElement('div');
    el.className = 'bb-msg ' + (role === 'user' ? 'bb-msg-user' : 'bb-msg-bot');
    el.textContent = text;
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }

  function showTyping() {
    var el = document.createElement('div');
    el.className = 'bb-msg bb-msg-typing';
    el.id = 'bunnybot-typing';
    el.textContent = '…';
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    var el = document.getElementById('bunnybot-typing');
    if (el) el.remove();
  }

  function openPanel() {
    state.open = true;
    panel.classList.add('bb-open');
    if (messagesEl.children.length === 0) {
      appendMessage('bot', state.config.welcomeMessage);
    }
    input.focus();
  }

  function closePanel() {
    state.open = false;
    panel.classList.remove('bb-open');
  }

  bubble.addEventListener('click', function () {
    state.open ? closePanel() : openPanel();
  });
  closeBtn.addEventListener('click', closePanel);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var message = input.value.trim();
    if (!message || state.loading) return;

    appendMessage('user', message);
    state.history.push({ role: 'user', content: message });
    input.value = '';
    state.loading = true;
    sendBtn.disabled = true;
    showTyping();

    fetch(API_BASE + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({
        message: message,
        history: state.history,
        isNewConversation: state.isNewConversation,
      }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        hideTyping();
        state.isNewConversation = false;
        if (!result.ok) {
          appendMessage('bot', result.data.message || "Désolé, une erreur s'est produite.");
          return;
        }
        appendMessage('bot', result.data.reply);
        state.history.push({ role: 'assistant', content: result.data.reply });
      })
      .catch(function () {
        hideTyping();
        appendMessage('bot', 'Connexion impossible pour le moment. Réessayez plus tard.');
      })
      .finally(function () {
        state.loading = false;
        sendBtn.disabled = false;
      });
  });

  // ---------------------------------------------------------------------
  // Fetch this client's config (colors, welcome message, bot name)
  // ---------------------------------------------------------------------
  fetch(API_BASE + '/api/chat/config', { headers: { 'x-api-key': API_KEY } })
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      if (data.widgetConfig) {
        state.config = data.widgetConfig;
        root.style.setProperty('--bb-accent', state.config.accentColor);
        nameEl.textContent = state.config.botName;
        renderBubbleIcon();
      }
    })
    .catch(function () {
      root.style.setProperty('--bb-accent', state.config.accentColor);
    });

  root.style.setProperty('--bb-accent', state.config.accentColor);
})();
