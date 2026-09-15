(function () {
  'use strict';

  var form = document.getElementById('login-form');
  var btn = document.getElementById('login-btn');
  var errorBox = document.getElementById('login-error');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errorBox.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Connexion…';

    fetch(window.location.origin + '/api/portal/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value,
      }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok) throw new Error(result.data.message || 'Connexion impossible.');
        window.location.href = './';
      })
      .catch(function (err) {
        errorBox.textContent = err.message;
        errorBox.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Se connecter';
      });
  });
})();
