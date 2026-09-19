(function () {
  'use strict';

  var API_BASE = window.location.origin;

  function authedFetch(path, options) {
    options = options || {};
    options.credentials = 'same-origin';
    options.headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    return fetch(API_BASE + path, options);
  }

  var statusLabels = {
    active: 'Abonnement actif',
    trialing: 'Période d\'essai en cours',
    past_due: 'Paiement en échec — merci de mettre à jour votre carte',
    canceled: 'Abonnement résilié',
  };

  function renderStatus(me) {
    var banner = document.getElementById('status-banner');
    var text = document.getElementById('status-text');
    var billingBtn = document.getElementById('billing-btn');

    banner.className = 'status-banner ' + me.status;
    var label = statusLabels[me.status] || me.status;
    if (me.status === 'trialing') {
      var days = Math.max(0, Math.ceil((me.trialEndsAt - Date.now()) / 86400000));
      label += ' — ' + days + ' jour' + (days > 1 ? 's' : '') + ' restant' + (days > 1 ? 's' : '');
    }
    text.textContent = label;

    if (me.hasStripeCustomer) {
      billingBtn.style.display = 'inline-block';
    }
  }

  function loadMe() {
    return authedFetch('/api/portal/me')
      .then(function (res) {
        if (!res.ok) throw new Error('unauthorized');
        return res.json();
      })
      .then(function (me) {
        document.getElementById('business-name-header').textContent = me.businessName;
        document.getElementById('course-context').value = me.courseContext || '';
        document.getElementById('welcome-message').value = me.widgetConfig.welcomeMessage;
        document.getElementById('bot-name').value = me.widgetConfig.botName;
        document.getElementById('accent-color').value = me.widgetConfig.accentColor;
        var iconStyle = me.widgetConfig.iconStyle || 'bunny';
        document.getElementById('icon-style-bunny').checked = iconStyle === 'bunny';
        document.getElementById('icon-style-bubble').checked = iconStyle === 'bubble';
        document.getElementById('icon-style-message').checked = iconStyle === 'message';
        document.getElementById('quick-replies').value = (me.widgetConfig.quickReplies || []).join('\n');
        document.getElementById('snippet-box').textContent =
          '<script src="' + API_BASE + '/widget.js" data-api-key="' + me.apiKey + '"><' + '/script>';
        renderStatus(me);
      })
      .catch(function () {
        window.location.href = 'login.html';
      });
  }

  document.getElementById('save-btn').addEventListener('click', function () {
    var payload = {
      courseContext: document.getElementById('course-context').value,
      widgetConfig: {
        welcomeMessage: document.getElementById('welcome-message').value,
        botName: document.getElementById('bot-name').value,
        accentColor: document.getElementById('accent-color').value,
        iconStyle: document.querySelector('input[name="icon-style"]:checked').value,
        quickReplies: document.getElementById('quick-replies').value
          .split('\n').map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 4),
      },
    };
    authedFetch('/api/portal/me', { method: 'PATCH', body: JSON.stringify(payload) })
      .then(function (res) { return res.json(); })
      .then(function () {
        var confirm = document.getElementById('save-confirm');
        confirm.style.display = 'inline';
        setTimeout(function () { confirm.style.display = 'none'; }, 2500);
      });
  });

  document.getElementById('billing-btn').addEventListener('click', function () {
    authedFetch('/api/portal/billing-session', { method: 'POST' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.url) window.location.href = data.url;
      });
  });

  document.getElementById('logout-btn').addEventListener('click', function () {
    authedFetch('/api/portal/logout', { method: 'POST' }).then(function () {
      window.location.href = 'login.html';
    });
  });

  document.getElementById('app').style.display = 'flex';
  loadMe();
})();
