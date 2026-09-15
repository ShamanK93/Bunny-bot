(function () {
  'use strict';

  var form = document.getElementById('signup-form');
  var submitBtn = document.getElementById('submit-btn');
  var errorBox = document.getElementById('form-error');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errorBox.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Un instant…';

    var payload = {
      businessName: document.getElementById('businessName').value.trim(),
      email: document.getElementById('email').value.trim(),
      password: document.getElementById('password').value,
      courseContext: document.getElementById('courseContext').value.trim(),
    };

    fetch(window.location.origin + '/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok) throw new Error(result.data.message || 'Erreur inconnue');

        if (result.data.checkoutUrl) {
          window.location.href = result.data.checkoutUrl;
        } else {
          // Already logged in via session cookie — go straight to the portal
          window.location.href = '../portal/';
        }
      })
      .catch(function (err) {
        errorBox.textContent = err.message;
        errorBox.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Démarrer mon essai de 14 jours';
      });
  });
})();
