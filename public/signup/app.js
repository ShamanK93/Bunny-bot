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
      courseContext: document.getElementById('courseContext').value.trim(),
    };

    fetch(window.location.origin + '/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
          // Stripe not configured (local/dev) — go straight to a success page
          window.location.href = 'success.html?client=' + result.data.client.id;
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
