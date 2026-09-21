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
      accentColor: '#1A1640',
      botName: 'BunnyBot',
      iconStyle: 'chat',
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
    '#bunnybot-bubble img{width:82%!important;height:82%!important;object-fit:contain!important;',
    'transform:none!important;border-radius:0!important;display:block!important;',
    'filter:brightness(0) invert(1)!important;}',
    '#bunnybot-bubble svg{width:60%!important;height:60%!important;}',
    '#bunnybot-bubble:hover{transform:scale(1.06);}',

    // Panneau : même direction artistique que la démo de la page d'accueil
    // (fond nuit, bulles blush/blanches, pastille « En ligne », bouton orange).
    '#bunnybot-panel{position:absolute!important;bottom:78px!important;right:0!important;',
    'width:380px!important;max-width:90vw!important;height:520px!important;max-height:74vh!important;',
    'background:#251F57!important;border-radius:22px!important;border:1px solid #3A3384!important;',
    'box-shadow:0 30px 60px -20px rgba(10,8,30,0.65)!important;',
    'font-family:"Instrument Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif!important;',
    'display:none;flex-direction:column!important;overflow:hidden!important;}',
    '#bunnybot-panel.bb-open{display:flex!important;animation:bb-rise .28s ease both!important;}',
    '@keyframes bb-rise{from{opacity:0;transform:translateY(10px);}}',

    '#bunnybot-header{background:transparent!important;color:#FFFFFF!important;padding:14px 18px!important;',
    'display:flex!important;align-items:center!important;gap:12px!important;flex-shrink:0!important;',
    'border-bottom:1px solid #3A3384!important;}',
    '#bunnybot-header .bb-avatar{width:38px!important;height:38px!important;border-radius:12px!important;',
    'overflow:hidden!important;flex-shrink:0!important;background:#F5F4FA!important;display:block!important;}',
    '#bunnybot-header .bb-avatar img{width:100%!important;height:100%!important;display:block!important;',
    'object-fit:cover!important;transform:scale(1.7) translateY(4%)!important;filter:none!important;border-radius:0!important;}',
    '#bunnybot-header .bb-id{display:flex!important;flex-direction:column!important;line-height:1.25!important;min-width:0!important;}',
    '#bunnybot-header .bb-name{font-family:"Bricolage Grotesque","Segoe UI",system-ui,sans-serif!important;',
    'font-weight:700!important;font-size:16px!important;color:#FFFFFF!important;}',
    '#bunnybot-header .bb-status{display:flex!important;align-items:center!important;gap:6px!important;',
    'font-size:12.5px!important;color:rgba(255,255,255,0.65)!important;}',
    '#bunnybot-header .bb-status::before{content:""!important;width:7px!important;height:7px!important;',
    'border-radius:50%!important;background:#5FD38D!important;display:block!important;}',
    '#bunnybot-close{margin-left:auto!important;background:none!important;border:none!important;',
    'color:#FFFFFF!important;opacity:.7;cursor:pointer!important;font-size:24px!important;',
    'line-height:1!important;padding:4px!important;width:auto!important;height:auto!important;',
    'outline:none!important;appearance:none!important;-webkit-appearance:none!important;}',
    '#bunnybot-close:hover,#bunnybot-close:focus-visible{opacity:1;}',

    '#bunnybot-messages{flex:1 1 auto!important;overflow-y:auto!important;padding:18px!important;',
    'display:flex!important;flex-direction:column!important;gap:10px!important;background:transparent!important;}',
    '.bb-msg{max-width:86%!important;width:fit-content!important;padding:10px 14px!important;',
    'border-radius:16px!important;font-size:14.5px!important;line-height:1.45!important;',
    'word-wrap:break-word!important;white-space:pre-wrap!important;color:#1A1640!important;',
    'animation:bb-pop .3s ease both!important;}',
    '@keyframes bb-pop{from{opacity:0;transform:translateY(8px);}}',
    '.bb-msg-bot{align-self:flex-start!important;background:#FFFFFF!important;border-bottom-left-radius:5px!important;}',
    '.bb-msg-user{align-self:flex-end!important;background:#FBD9D3!important;border-bottom-right-radius:5px!important;}',
    '.bb-msg-typing{align-self:flex-start!important;background:#FFFFFF!important;',
    'display:flex!important;align-items:center!important;gap:4px!important;padding:13px 14px!important;}',
    '.bb-dot-typing{width:6px!important;height:6px!important;border-radius:50%!important;',
    'background:#9B98B3!important;display:inline-block!important;',
    'animation:bb-bounce 1.2s infinite ease-in-out!important;}',
    '.bb-dot-typing:nth-child(1){animation-delay:0s!important;}',
    '.bb-dot-typing:nth-child(2){animation-delay:.15s!important;}',
    '.bb-dot-typing:nth-child(3){animation-delay:.3s!important;}',
    '@keyframes bb-bounce{0%,80%,100%{transform:scale(0.6);opacity:.4;}40%{transform:scale(1);opacity:1;}}',

    '#bunnybot-quickreplies{display:flex!important;flex-direction:column!important;',
    'align-items:flex-end!important;gap:8px!important;padding:0 18px 16px!important;}',
    '.bb-quickreply{background:transparent!important;border:1.5px solid #3A3384!important;',
    'border-radius:999px!important;padding:8px 14px!important;font-size:13.5px!important;',
    'color:#FFFFFF!important;cursor:pointer!important;text-align:left!important;',
    'max-width:90%!important;outline:none!important;appearance:none!important;',
    '-webkit-appearance:none!important;font-family:inherit!important;transition:border-color .15s ease!important;}',
    '.bb-quickreply:hover,.bb-quickreply:focus-visible{border-color:#FF8A2B!important;}',

    '#bunnybot-form{display:flex!important;align-items:center!important;gap:8px!important;',
    'padding:12px 14px!important;border-top:1px solid #3A3384!important;background:transparent!important;',
    'flex-shrink:0!important;width:100%!important;}',
    '#bunnybot-input{flex:1 1 auto!important;width:auto!important;min-width:0!important;',
    'max-width:none!important;height:42px!important;border:1.5px solid #3A3384!important;',
    'border-radius:12px!important;padding:0 14px!important;font-size:14.5px!important;',
    'font-family:inherit!important;outline:none!important;background:#1A1640!important;',
    'color:#FFFFFF!important;display:block!important;}',
    '#bunnybot-input::placeholder{color:rgba(255,255,255,0.5)!important;}',
    '#bunnybot-input:focus{border-color:#FF8A2B!important;}',
    '#bunnybot-send{flex:0 0 auto!important;width:auto!important;height:42px!important;',
    'background:#FF8A2B!important;border:none!important;border-radius:12px!important;',
    'padding:0 18px!important;cursor:pointer!important;font-size:14.5px!important;font-family:inherit!important;',
    'font-weight:700!important;color:#1A1640!important;white-space:nowrap!important;',
    'outline:none!important;appearance:none!important;-webkit-appearance:none!important;',
    'transition:background .15s ease!important;}',
    '#bunnybot-send:hover{background:#EC730F!important;}',
    '#bunnybot-send:disabled{opacity:.5!important;cursor:default!important;}',
    '@media (prefers-reduced-motion:reduce){#bunnybot-panel,.bb-msg{animation:none!important;}}',

    // Lanceur (la couleur d'accent du client s'applique ici)
    '#bunnybot-root.bb-icon-bubble #bunnybot-bubble{',
    'background:linear-gradient(135deg,var(--bb-accent),color-mix(in srgb,var(--bb-accent) 65%,#000000))!important;}',
    '#bunnybot-bubble img.bb-shaded-icon{filter:none!important;}',
    '#bunnybot-root.bb-light-accent #bunnybot-bubble img{filter:brightness(0)!important;}',
    '#bunnybot-root.bb-light-accent #bunnybot-bubble svg{stroke:#10151F!important;}',
  ].join('');

  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // Polices de la charte BunnyBot (repli sur les polices système si bloquées).
  var fontsEl = document.createElement('link');
  fontsEl.rel = 'stylesheet';
  fontsEl.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700&family=Instrument+Sans:wght@400;500;600;700&display=swap';
  document.head.appendChild(fontsEl);

  // ---------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------
  var root = document.createElement('div');
  root.id = 'bunnybot-root';
  root.innerHTML =
    '<div id="bunnybot-panel">' +
    '  <div id="bunnybot-header">' +
    '    <span class="bb-avatar" id="bunnybot-avatar"></span>' +
    '    <span class="bb-id"><span class="bb-name" id="bunnybot-name">BunnyBot</span>' +
    '    <span class="bb-status">En ligne</span></span>' +
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

  avatarEl.innerHTML = '<img src="' + API_BASE + '/signup/assets/bunny-mascot.png" alt="" />';

  function renderBubbleIcon() {
    if (state.config.iconStyle === 'chat') {
      bubble.innerHTML = MESSAGE_ICON_SVG;
      root.classList.add('bb-icon-bubble');
    } else if (state.config.iconStyle === 'bubble') {
      bubble.innerHTML = BUBBLE_ICON_SVG;
      root.classList.add('bb-icon-bubble');
    } else if (state.config.iconStyle === 'message') {
      var msgImgHtml = '<img class="bb-shaded-icon" src="' + API_BASE + '/signup/assets/message-icon.png" alt="" />';
      bubble.innerHTML = msgImgHtml;
      root.classList.remove('bb-icon-bubble');
    } else {
      var imgHtml = '<img src="' + API_BASE + '/signup/assets/bunny-icon-minimal.png" alt="" />';
      bubble.innerHTML = imgHtml;
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
