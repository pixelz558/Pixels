// public/js/checkout.js
(async function () {
  const items = Cart.get();
  if (!items.length) {
    window.location.href = 'index.html';
    return;
  }

  // ---------- 1. Create the order server-side (server prices it, not us) ----------
  let order;
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Could not create order.');
    order = await res.json();
  } catch (err) {
    showAlert(err.message);
    return;
  }
  sessionStorage.setItem('current_order_id', order.id);

  renderSummary(order);

  // ---------- 2. Get publishable keys ----------
  const config = await (await fetch('/api/config')).json();

  // ================= CARD + WALLET (Stripe) =================
  let stripe, elements, cardElement, paymentRequest, clientSecret;

  if (config.stripePublishableKey) {
    stripe = Stripe(config.stripePublishableKey);
    elements = stripe.elements();
    cardElement = elements.create('card', { style: stripeElementStyle() });
    cardElement.mount('#card-element');
    cardElement.on('change', (e) => {
      document.getElementById('card-errors').textContent = e.error ? e.error.message : '';
    });

    // One PaymentIntent covers both the manual card form AND the wallet button.
    try {
      const res = await fetch('/api/payments/stripe/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = await res.json();
      clientSecret = data.clientSecret;
    } catch (err) {
      console.error(err);
    }

    setupWalletButton();
  }

  document.getElementById('pay-card-btn').addEventListener('click', payWithCard);

  async function payWithCard() {
    const nameInput = document.getElementById('card-name');
    const nameError = document.getElementById('card-name-error');
    nameError.textContent = '';

    if (!nameInput.value.trim()) {
      nameError.textContent = 'Please enter the name on your card.';
      nameInput.classList.add('invalid');
      return;
    }
    nameInput.classList.remove('invalid');

    if (!clientSecret) {
      showAlert('Card payment is not available right now.');
      return;
    }

    setLoading(true, 'Processing your card payment…');
    const result = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: cardElement, billing_details: { name: nameInput.value.trim() } },
    });
    setLoading(false);

    if (result.error) {
      showAlert(result.error.message);
    } else if (result.paymentIntent.status === 'succeeded') {
      goToSuccess();
    }
  }

  function setupWalletButton() {
    if (!stripe || !clientSecret) return;

    paymentRequest = stripe.paymentRequest({
      country: 'FR',
      currency: order.currency,
      total: { label: 'Total', amount: order.totalCents },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    paymentRequest.canMakePayment().then((result) => {
      if (result) {
        const prButton = elements.create('paymentRequestButton', { paymentRequest });
        prButton.mount('#payment-request-button');
      } else {
        document.getElementById('payment-request-button').style.display = 'none';
        document.getElementById('wallet-unavailable').style.display = 'block';
      }
    });

    paymentRequest.on('paymentmethod', async (ev) => {
      const result = await stripe.confirmCardPayment(
        clientSecret,
        { payment_method: ev.paymentMethod.id },
        { handleActions: false }
      );
      if (result.error) {
        ev.complete('fail');
        showAlert(result.error.message);
        return;
      }
      ev.complete('success');
      if (result.paymentIntent.status === 'requires_action') {
        const { error } = await stripe.confirmCardPayment(clientSecret);
        if (error) { showAlert(error.message); return; }
      }
      goToSuccess();
    });
  }

  // ================= PAYPAL =================
  if (config.paypalClientId) {
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${config.paypalClientId}&currency=${order.currency.toUpperCase()}`;
    script.onload = () => {
      paypal.Buttons({
        style: { layout: 'vertical', shape: 'rect', label: 'paypal' },
        createOrder: async () => {
          const res = await fetch('/api/payments/paypal/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: order.id }),
          });
          const data = await res.json();
          return data.paypalOrderId;
        },
        onApprove: async (data) => {
          setLoading(true, 'Confirming your PayPal payment…');
          const res = await fetch('/api/payments/paypal/capture-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: order.id, paypalOrderId: data.orderID }),
          });
          setLoading(false);
          if (res.ok) goToSuccess();
          else showAlert('PayPal payment could not be completed.');
        },
        onError: () => showAlert('PayPal payment failed. Please try again.'),
      }).render('#paypal-button-container');
    };
    document.head.appendChild(script);
  }

  // ================= CRYPTO =================
  document.getElementById('pay-crypto-btn').addEventListener('click', async () => {
    setLoading(true, 'Creating your crypto charge…');
    try {
      const res = await fetch('/api/payments/crypto/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) { showAlert(data.error || 'Could not start crypto payment.'); return; }
      window.location.href = data.hostedUrl; // Coinbase Commerce hosted checkout
    } catch (err) {
      setLoading(false);
      showAlert('Network error — could not reach the server.');
    }
  });

  // ================= BANK TRANSFER =================
  document.getElementById('get-bank-details-btn').addEventListener('click', async () => {
    setLoading(true, 'Fetching bank details…');
    try {
      const res = await fetch('/api/payments/bank/reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      });
      const d = await res.json();
      setLoading(false);
      const box = document.getElementById('bank-details');
      box.style.display = 'block';
      box.innerHTML = `
        <div class="row"><span>Account name</span><span class="v">${d.accountName}</span></div>
        <div class="row"><span>IBAN</span><span class="v">${d.iban}</span></div>
        <div class="row"><span>BIC / SWIFT</span><span class="v">${d.bic}</span></div>
        <div class="row"><span>Bank</span><span class="v">${d.bankName}</span></div>
        <div class="row"><span>Amount</span><span class="v">${d.amount} ${d.currency}</span></div>
        <div class="row"><span>Reference</span><span class="v">${d.reference} <button class="copy-btn" id="copy-ref">Copy</button></span></div>
      `;
      document.getElementById('copy-ref').addEventListener('click', () => {
        navigator.clipboard.writeText(d.reference);
      });
    } catch (err) {
      setLoading(false);
      showAlert('Could not load bank details.');
    }
  });

  // ================= UI helpers =================
  function renderSummary(order) {
    const lineEl = document.getElementById('line-items');
    lineEl.innerHTML = order.items.map((i) => `
      <div class="line-item">
        <span class="name">${i.name}<span class="qty">×${i.qty}</span></span>
        <span class="mono">€${(i.lineTotal / 100).toFixed(2)}</span>
      </div>
    `).join('');
    document.getElementById('sum-subtotal').textContent = `€${(order.subtotalCents / 100).toFixed(2)}`;
    document.getElementById('sum-tax').textContent = `€${(order.taxCents / 100).toFixed(2)}`;
    document.getElementById('sum-total').textContent = `€${(order.totalCents / 100).toFixed(2)}`;
  }

  function goToSuccess() {
    Cart.clear();
    window.location.href = `success.html?orderId=${order.id}`;
  }

  function setLoading(on, text) {
    document.getElementById('loading-overlay').classList.toggle('show', on);
    if (text) document.getElementById('loading-text').textContent = text;
  }

  function showAlert(message) {
    document.getElementById('alert-box').innerHTML = `
      <div class="alert alert-error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
        <span>${message}</span>
      </div>`;
  }

  function stripeElementStyle() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      base: {
        color: dark ? '#F3F4F6' : '#14181F',
        fontFamily: 'Inter, sans-serif',
        fontSize: '15px',
        '::placeholder': { color: dark ? '#6B7280' : '#9AA1AE' },
      },
      invalid: { color: '#F04438' },
    };
  }

  // ================= Tab switching =================
  document.getElementById('method-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.method-tab');
    if (!tab) return;
    document.querySelectorAll('.method-tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.method-panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    document.querySelector(`.method-panel[data-panel="${tab.dataset.method}"]`).classList.add('active');
  });
})();
