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
    config: {
      welcomeMessage: 'Bonjour !',
      accentColor: '#52525B',
      botName: 'BunnyBot',
      iconStyle: 'bunny',
      quickReplies: [],
    },
    isNewConversation: true,
  };

  // ---------------------------------------------------------------------
  // Styles (scoped under #bunnybot-root to avoid leaking into host page)
  // ---------------------------------------------------------------------
  var css = [
    // Reset first — any host page's global CSS (input{width:100%},
    // button{width:100%}, box-sizing, margins, etc.) must never leak in.
    '#bunnybot-root, #bunnybot-root *{box-sizing:border-box!important;margin:0!important;',
    'list-style:none!important;text-align:left!important;line-height:normal!important;',
    'letter-spacing:normal!important;text-transform:none!important;float:none!important;}',

    '#bunnybot-root{position:fixed!important;bottom:20px!important;right:20px!important;',
    'z-index:2147483000!important;',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif!important;}',

    '#bunnybot-bubble{width:64px!important;height:64px!important;border-radius:50%!important;',
    'border:none!important;cursor:pointer!important;box-shadow:0 6px 20px rgba(16,21,31,0.3)!important;',
    'display:flex!important;align-items:center!important;justify-content:center!important;',
    'padding:0!important;background:var(--bb-accent)!important;transition:transform .15s ease!important;',
    'overflow:hidden!important;flex-shrink:0!important;outline:none!important;',
    'appearance:none!important;-webkit-appearance:none!important;-webkit-tap-highlight-color:transparent!important;}',
    '#bunnybot-bubble:focus,#bunnybot-bubble:focus-visible{outline:none!important;',
    'box-shadow:0 6px 20px rgba(16,21,31,0.3)!important;}',
    '#bunnybot-bubble:active{outline:none!important;box-shadow:0 6px 20px rgba(16,21,31,0.3)!important;}',
    '#bunnybot-bubble img{width:88%!important;height:88%!important;object-fit:contain!important;',
    'transform:none!important;border-radius:0!important;display:block!important;',
    'filter:brightness(0) invert(1)!important;}',
    '#bunnybot-bubble svg{width:52%!important;height:52%!important;fill:#FFFFFF!important;}',
    '#bunnybot-bubble:hover{transform:scale(1.06);}',

    '#bunnybot-panel{position:absolute!important;bottom:78px!important;right:0!important;',
    'width:360px!important;max-width:90vw!important;height:480px!important;max-height:72vh!important;',
    'background:#FFFFFF!important;border-radius:18px!important;box-shadow:0 16px 48px rgba(16,21,31,0.22)!important;',
    'display:none;flex-direction:column!important;overflow:hidden!important;border:1px solid #E3E5EA!important;}',
    '#bunnybot-panel.bb-open{display:flex!important;}',

    '#bunnybot-header{background:var(--bb-accent)!important;color:#FFFFFF!important;padding:14px 16px!important;',
    'display:flex!important;align-items:center!important;gap:10px!important;flex-shrink:0!important;}',
    '#bunnybot-header .bb-avatar{width:26px!important;height:26px!important;border-radius:0!important;',
    'overflow:visible!important;flex-shrink:0!important;background:transparent!important;',
    'display:flex!important;align-items:center!important;justify-content:center!important;',
    'border:none!important;}',
    '#bunnybot-header .bb-avatar img{width:100%!important;height:100%!important;object-fit:contain!important;',
    'transform:none!important;display:block!important;filter:brightness(0) invert(1)!important;}',
    '#bunnybot-header .bb-avatar svg{width:60%!important;height:60%!important;fill:#FFFFFF!important;',
    'margin:20%!important;}',
    '#bunnybot-header .bb-name{font-weight:600!important;font-size:14.5px!important;color:#FFFFFF!important;}',
    '#bunnybot-close{margin-left:auto!important;background:none!important;border:none!important;',
    'color:#FFFFFF!important;opacity:.7;cursor:pointer!important;font-size:20px!important;',
    'line-height:1!important;padding:4px!important;width:auto!important;height:auto!important;',
    'outline:none!important;appearance:none!important;-webkit-appearance:none!important;}',
    '#bunnybot-close:hover{opacity:1;}',

    '#bunnybot-messages{flex:1 1 auto!important;overflow-y:auto!important;padding:14px!important;',
    'display:flex!important;flex-direction:column!important;gap:10px!important;background:#FFFFFF!important;}',
    '.bb-msg{max-width:82%!important;width:fit-content!important;padding:9px 12px!important;',
    'border-radius:14px!important;font-size:13.5px!important;line-height:1.45!important;',
    'word-wrap:break-word!important;white-space:pre-wrap!important;}',
    '.bb-msg-bot{align-self:flex-start!important;background:#F4F5F7!important;color:#10151F!important;',
    'border-bottom-left-radius:4px!important;}',
    '.bb-msg-user{align-self:flex-end!important;background:var(--bb-accent)!important;color:#FFFFFF!important;',
    'border-bottom-right-radius:4px!important;}',
    '.bb-msg-typing{align-self:flex-start!important;background:#F4F5F7!important;color:#5B6472!important;',
    'font-style:italic!important;}',

    '#bunnybot-quickreplies{display:flex!important;flex-direction:column!important;',
    'align-items:flex-end!important;gap:6px!important;padding:0 14px 14px!important;}',
    '.bb-quickreply{background:#FFFFFF!important;border:1px solid #E3E5EA!important;',
    'border-radius:999px!important;padding:8px 14px!important;font-size:12.5px!important;',
    'color:#10151F!important;cursor:pointer!important;text-align:left!important;',
    'max-width:88%!important;outline:none!important;appearance:none!important;',
    '-webkit-appearance:none!important;font-family:inherit!important;}',
    '.bb-quickreply:hover{border-color:var(--bb-accent)!important;}',

    '#bunnybot-form{display:flex!important;align-items:center!important;gap:8px!important;',
    'padding:10px!important;border-top:1px solid #E3E5EA!important;background:#FFFFFF!important;',
    'flex-shrink:0!important;width:100%!important;}',
    '#bunnybot-input{flex:1 1 auto!important;width:auto!important;min-width:0!important;',
    'max-width:none!important;height:40px!important;border:1px solid #E3E5EA!important;',
    'border-radius:10px!important;padding:0 12px!important;font-size:13.5px!important;',
    'font-family:inherit!important;outline:none!important;background:#fff!important;',
    'color:#10151F!important;display:block!important;}',
    '#bunnybot-input:focus{border-color:var(--bb-accent)!important;}',
    '#bunnybot-send{flex:0 0 auto!important;width:auto!important;height:40px!important;',
    'background:var(--bb-accent)!important;border:none!important;border-radius:10px!important;',
    'padding:0 16px!important;cursor:pointer!important;font-size:13.5px!important;',
    'font-weight:600!important;color:#FFFFFF!important;white-space:nowrap!important;',
    'outline:none!important;appearance:none!important;-webkit-appearance:none!important;}',
    '#bunnybot-send:disabled{opacity:.5!important;cursor:default!important;}',
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
    '    <span class="bb-avatar" id="bunnybot-avatar"></span>' +
    '    <span class="bb-name" id="bunnybot-name">BunnyBot</span>' +
    '    <button id="bunnybot-close" type="button" aria-label="Fermer">&times;</button>' +
    '  </div>' +
    '  <div id="bunnybot-messages"></div>' +
    '  <div id="bunnybot-quickreplies"></div>' +
    '  <form id="bunnybot-form">' +
    '    <input id="bunnybot-input" type="text" placeholder="Écrivez votre question…" autocomplete="off" />' +
    '    <button id="bunnybot-send" type="submit">Envoyer</button>' +
    '  </form>' +
    '</div>' +
    '<button id="bunnybot-bubble" type="button" aria-label="Ouvrir le chat"></button>';
  document.body.appendChild(root);

  var panel = root.querySelector('#bunnybot-panel');
  var bubble = root.querySelector('#bunnybot-bubble');
  var closeBtn = root.querySelector('#bunnybot-close');
  var messagesEl = root.querySelector('#bunnybot-messages');
  var quickrepliesEl = root.querySelector('#bunnybot-quickreplies');
  var form = root.querySelector('#bunnybot-form');
  var input = root.querySelector('#bunnybot-input');
  var sendBtn = root.querySelector('#bunnybot-send');
  var nameEl = root.querySelector('#bunnybot-name');
  var avatarEl = root.querySelector('#bunnybot-avatar');

  var BUBBLE_ICON_SVG =
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M12 3C7.03 3 3 6.58 3 11c0 2.39 1.19 4.53 3.08 6.02-.1.98-.5 2.24-1.45 3.48a.5.5 0 0 0 .5.79c2.03-.5 3.6-1.4 4.6-2.13.72.15 1.47.24 2.27.24 4.97 0 9-3.58 9-8s-4.03-8-9-8z"/>' +
    '</svg>';

  function renderBubbleIcon() {
    if (state.config.iconStyle === 'bubble') {
      bubble.innerHTML = BUBBLE_ICON_SVG;
      avatarEl.innerHTML = BUBBLE_ICON_SVG;
    } else {
      var imgHtml = '<img src="' + API_BASE + '/signup/assets/bunny-icon-minimal.png" alt="" />';
      bubble.innerHTML = imgHtml;
      avatarEl.innerHTML = imgHtml;
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

  function renderQuickReplies() {
    quickrepliesEl.innerHTML = '';
    var replies = state.config.quickReplies;
    if (!replies || !replies.length) return;
    replies.forEach(function (q) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bb-quickreply';
      btn.textContent = q;
      btn.addEventListener('click', function () {
        quickrepliesEl.innerHTML = '';
        sendMessage(q);
      });
      quickrepliesEl.appendChild(btn);
    });
  }

  function openPanel() {
    state.open = true;
    panel.classList.add('bb-open');
    if (messagesEl.children.length === 0) {
      appendMessage('bot', state.config.welcomeMessage);
      renderQuickReplies();
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

  function sendMessage(message) {
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
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    quickrepliesEl.innerHTML = '';
    sendMessage(input.value.trim());
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
