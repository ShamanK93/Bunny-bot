(function () {
  'use strict';

  var API_BASE = window.location.origin;
  var token = localStorage.getItem('bb_admin_token') || '';
  var clients = [];
  var activeClientId = null;

  var loginScreen = document.getElementById('login-screen');
  var app = document.getElementById('app');
  var tokenInput = document.getElementById('token-input');
  var loginBtn = document.getElementById('login-btn');
  var loginError = document.getElementById('login-error');

  function authHeaders() {
    return { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  }

  function tryLogin(t) {
    fetch(API_BASE + '/api/admin/clients', { headers: { Authorization: 'Bearer ' + t } })
      .then(function (res) {
        if (!res.ok) throw new Error('unauthorized');
        return res.json();
      })
      .then(function (data) {
        token = t;
        localStorage.setItem('bb_admin_token', t);
        loginScreen.style.display = 'none';
        app.style.display = 'flex';
        clients = data;
        render();
      })
      .catch(function () {
        loginError.style.display = 'block';
      });
  }

  loginBtn.addEventListener('click', function () {
    loginError.style.display = 'none';
    var t = tokenInput.value.trim();
    if (t) tryLogin(t);
  });
  tokenInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') loginBtn.click();
  });

  if (token) tryLogin(token);

  // -----------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------
  function statusLabel(status) {
    return {
      active: 'Actif',
      trialing: 'Essai',
      past_due: 'Impayé',
      canceled: 'Résilié',
    }[status] || status;
  }

  function render() {
    document.getElementById('stat-clients').textContent = clients.length;
    document.getElementById('stat-active').textContent = clients.filter(function (c) {
      return c.active;
    }).length;
    document.getElementById('stat-messages').textContent = clients.reduce(function (sum, c) {
      return sum + c.messagesTotal;
    }, 0);

    var tbody = document.getElementById('clients-tbody');
    tbody.innerHTML = '';

    if (clients.length === 0) {
      document.getElementById('empty-state').style.display = 'block';
      return;
    }
    document.getElementById('empty-state').style.display = 'none';

    clients.forEach(function (c) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="business">' + escapeHtml(c.businessName) +
        '<span class="email">' + escapeHtml(c.email) + '</span></td>' +
        '<td><span class="status-pill status-' + c.status + '">' + statusLabel(c.status) + '</span></td>' +
        '<td>' + c.conversationsTotal + ' conv · ' + c.messagesTotal + ' msg</td>' +
        '<td class="apikey">' + c.apiKey.slice(0, 14) + '…</td>' +
        '<td><button class="link-btn" data-id="' + c.id + '">Voir</button></td>';
      tr.addEventListener('click', function () {
        openDrawer(c.id);
      });
      tbody.appendChild(tr);
    });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function refreshClients() {
    return fetch(API_BASE + '/api/admin/clients', { headers: authHeaders() })
      .then(function (res) { return res.json(); })
      .then(function (data) { clients = data; render(); });
  }

  // -----------------------------------------------------------------
  // Drawer
  // -----------------------------------------------------------------
  var overlay = document.getElementById('overlay');
  var drawer = document.getElementById('drawer');

  function openDrawer(id) {
    activeClientId = id;
    fetch(API_BASE + '/api/admin/clients/' + id, { headers: authHeaders() })
      .then(function (res) { return res.json(); })
      .then(function (client) {
        document.getElementById('drawer-title').textContent = client.businessName;
        document.getElementById('drawer-subtitle').textContent = client.email;
        document.getElementById('course-context').value = client.courseContext || '';
        document.getElementById('welcome-message').value = client.widgetConfig.welcomeMessage;
        document.getElementById('bot-name').value = client.widgetConfig.botName;
        document.getElementById('accent-color').value = client.widgetConfig.accentColor;
        var iconStyle = client.widgetConfig.iconStyle || 'bunny';
        document.getElementById('icon-style-bunny').checked = iconStyle === 'bunny';
        document.getElementById('icon-style-bubble').checked = iconStyle === 'bubble';
        document.getElementById('snippet-box').textContent =
          '<script src="' + API_BASE + '/widget.js" data-api-key="' + client.apiKey + '"><' + '/script>';

        overlay.classList.add('open');
        drawer.classList.add('open');
      });
  }

  function closeDrawer() {
    overlay.classList.remove('open');
    drawer.classList.remove('open');
    activeClientId = null;
  }

  overlay.addEventListener('click', closeDrawer);
  document.getElementById('drawer-close').addEventListener('click', closeDrawer);

  document.getElementById('save-btn').addEventListener('click', function () {
    if (!activeClientId) return;
    var payload = {
      courseContext: document.getElementById('course-context').value,
      widgetConfig: {
        welcomeMessage: document.getElementById('welcome-message').value,
        botName: document.getElementById('bot-name').value,
        accentColor: document.getElementById('accent-color').value,
        iconStyle: document.querySelector('input[name="icon-style"]:checked').value,
      },
    };
    fetch(API_BASE + '/api/admin/clients/' + activeClientId, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
      .then(function (res) { return res.json(); })
      .then(function () {
        closeDrawer();
        refreshClients();
      });
  });

  document.getElementById('revoke-btn').addEventListener('click', function () {
    if (!activeClientId) return;
    if (!confirm("Révoquer l'accès de ce client ? Le widget cessera de répondre.")) return;
    fetch(API_BASE + '/api/admin/clients/' + activeClientId + '/revoke', {
      method: 'POST',
      headers: authHeaders(),
    })
      .then(function () {
        closeDrawer();
        refreshClients();
      });
  });
})();
