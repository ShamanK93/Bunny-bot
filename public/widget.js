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
    '#bunnybot-bubble img{width:100%!important;height:100%!important;object-fit:contain!important;',
    'transform:none!important;border-radius:0!important;display:block!important;',
    'filter:brightness(0) invert(1)!important;}',
    '#bunnybot-bubble svg{width:60%!important;height:60%!important;}',
    '#bunnybot-bubble:hover{transform:scale(1.06);}',

    '#bunnybot-panel{position:absolute!important;bottom:78px!important;right:0!important;',
    'width:360px!important;max-width:90vw!important;height:480px!important;max-height:72vh!important;',
    'background:#FFFFFF!important;border-radius:18px!important;',
    'box-shadow:0 20px 50px -12px rgba(16,21,31,0.28),0 0 0 1px color-mix(in srgb,var(--bb-accent) 12%,transparent),0 0 40px -8px color-mix(in srgb,var(--bb-accent) 25%,transparent)!important;',
    'display:none;flex-direction:column!important;overflow:hidden!important;border:1px solid #E3E5EA!important;}',
    '#bunnybot-panel.bb-open{display:flex!important;}',

    '#bunnybot-header{background:var(--bb-accent)!important;color:#FFFFFF!important;padding:14px 16px!important;',
    'display:flex!important;align-items:center!important;gap:10px!important;flex-shrink:0!important;}',
    '#bunnybot-header .bb-avatar{width:44px!important;height:44px!important;border-radius:0!important;',
    'overflow:visible!important;flex-shrink:0!important;background:transparent!important;',
    'display:flex!important;align-items:center!important;justify-content:center!important;',
    'border:none!important;}',
    '#bunnybot-header .bb-avatar img{width:100%!important;height:100%!important;object-fit:contain!important;',
    'transform:none!important;display:block!important;filter:brightness(0) invert(1)!important;}',
    '#bunnybot-header .bb-avatar svg{width:100%!important;height:100%!important;margin:0!important;',
    'stroke:#FFFFFF!important;}',
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
    'word-wrap:break-word!important;white-space:pre-wrap!important;',
    'transition:transform .15s ease,box-shadow .15s ease!important;cursor:default!important;}',
    '.bb-msg:hover{transform:scale(1.02) translateY(-1px)!important;}',
    '.bb-msg-bot{align-self:flex-start!important;background:#F4F5F7!important;color:#10151F!important;',
    'border-bottom-left-radius:4px!important;',
    'box-shadow:0 2px 8px -2px rgba(16,21,31,0.12)!important;}',
    '.bb-msg-bot:hover{box-shadow:0 6px 16px -4px rgba(16,21,31,0.2)!important;}',
    '.bb-msg-user{align-self:flex-end!important;background:var(--bb-accent)!important;color:#FFFFFF!important;',
    'border-bottom-right-radius:4px!important;',
    'box-shadow:0 4px 14px -4px color-mix(in srgb,var(--bb-accent) 65%,transparent)!important;}',
    '.bb-msg-user:hover{box-shadow:0 8px 22px -4px color-mix(in srgb,var(--bb-accent) 75%,transparent)!important;}',
    '.bb-msg-typing{align-self:flex-start!important;background:#F4F5F7!important;',
    'display:flex!important;align-items:center!important;gap:4px!important;padding:12px 14px!important;',
    'box-shadow:0 2px 8px -2px rgba(16,21,31,0.12)!important;}',
    '.bb-dot-typing{width:6px!important;height:6px!important;border-radius:50%!important;',
    'background:#9CA3AF!important;display:inline-block!important;',
    'animation:bb-bounce 1.2s infinite ease-in-out!important;}',
    '.bb-dot-typing:nth-child(1){animation-delay:0s!important;}',
    '.bb-dot-typing:nth-child(2){animation-delay:.15s!important;}',
    '.bb-dot-typing:nth-child(3){animation-delay:.3s!important;}',
    '@keyframes bb-bounce{0%,80%,100%{transform:scale(0.6);opacity:.4;}40%{transform:scale(1);opacity:1;}}',

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

    '#bunnybot-root.bb-icon-bubble #bunnybot-bubble,',
    '#bunnybot-root.bb-icon-bubble #bunnybot-header{',
    'background:linear-gradient(135deg,var(--bb-accent),color-mix(in srgb,var(--bb-accent) 65%,#000000))!important;}',
    '#bunnybot-root.bb-icon-bubble #bunnybot-header .bb-avatar{background:rgba(255,255,255,0.16)!important;}',

    '#bunnybot-root.bb-light-accent #bunnybot-bubble img,',
    '#bunnybot-root.bb-light-accent #bunnybot-header .bb-avatar img{filter:brightness(0)!important;}',
    '#bunnybot-root.bb-light-accent #bunnybot-bubble svg,',
    '#bunnybot-root.bb-light-accent #bunnybot-header .bb-avatar svg{stroke:#10151F!important;}',
    '#bunnybot-root.bb-light-accent #bunnybot-header .bb-name,',
    '#bunnybot-root.bb-light-accent #bunnybot-close{color:#10151F!important;}',
    '#bunnybot-root.bb-light-accent .bb-msg-user{color:#10151F!important;}',
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
    '<svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .963L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>' +
    '<path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>' +
    '</svg>';

  var MESSAGE_ICON_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>' +
    '</svg>';

  function applyAccentColor(hex) {
    root.style.setProperty('--bb-accent', hex);
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    var isLight = false;
    if (m) {
      var r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
      var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      isLight = luminance > 0.68;
    }
    root.classList.toggle('bb-light-accent', isLight);
  }

  function renderBubbleIcon() {
    if (state.config.iconStyle === 'bubble') {
      bubble.innerHTML = BUBBLE_ICON_SVG;
      avatarEl.innerHTML = BUBBLE_ICON_SVG;
      root.classList.add('bb-icon-bubble');
    } else if (state.config.iconStyle === 'message') {
      bubble.innerHTML = MESSAGE_ICON_SVG;
      avatarEl.innerHTML = MESSAGE_ICON_SVG;
      root.classList.remove('bb-icon-bubble');
    } else {
      var imgHtml = '<img src="' + API_BASE + '/signup/assets/bunny-icon-minimal.png" alt="" />';
      bubble.innerHTML = imgHtml;
      avatarEl.innerHTML = imgHtml;
      root.classList.remove('bb-icon-bubble');
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
    el.innerHTML = '<span class="bb-dot-typing"></span><span class="bb-dot-typing"></span><span class="bb-dot-typing"></span>';
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
        applyAccentColor(state.config.accentColor);
        nameEl.textContent = state.config.botName;
        renderBubbleIcon();
      }
    })
    .catch(function () {
      applyAccentColor(state.config.accentColor);
    });

  applyAccentColor(state.config.accentColor);
})();
