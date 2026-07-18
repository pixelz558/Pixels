// server/controllers/cryptoController.js
// Crypto payments (Bitcoin, Ethereum, USDT, ...) are handled entirely by
// Coinbase Commerce. We never generate wallet addresses or touch private
// keys ourselves — that would be both insecure and unreliable. Coinbase
// Commerce creates a hosted "charge" page that accepts several coins and
// tells us via webhook when it's confirmed on-chain.

const fetch = require('node-fetch');
const { COINBASE_COMMERCE_API_KEY, COINBASE_COMMERCE_WEBHOOK_SECRET, DOMAIN } = require('../config/env');
const crypto = require('crypto');
const orderStore = require('../store/orderStore');

const COMMERCE_API = 'https://api.commerce.coinbase.com';

// POST /api/payments/crypto/charge  { orderId }
async function createCharge(req, res) {
  try {
    const { orderId } = req.body;
    const order = orderStore.getOrder(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const response = await fetch(`${COMMERCE_API}/charges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CC-Api-Key': COINBASE_COMMERCE_API_KEY,
        'X-CC-Version': '2018-03-22',
      },
      body: JSON.stringify({
        name: `Order ${order.id}`,
        description: order.items.map((i) => `${i.qty}× ${i.name}`).join(', '),
        pricing_type: 'fixed_price',
        local_price: { amount: (order.totalCents / 100).toFixed(2), currency: order.currency.toUpperCase() },
        metadata: { orderId: order.id },
        redirect_url: `${DOMAIN}/success.html?orderId=${order.id}`,
        cancel_url: `${DOMAIN}/cancel.html?orderId=${order.id}`,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Coinbase Commerce error:', errText);
      return res.status(502).json({ error: 'Could not create crypto charge.' });
    }

    const data = await response.json();
    orderStore.updateOrder(order.id, { paymentMethod: 'crypto' });
    res.json({ hostedUrl: data.data.hosted_url });
  } catch (err) {
    console.error('Crypto charge error:', err);
    res.status(500).json({ error: 'Could not create crypto charge.' });
  }
}

// POST /api/webhooks/coinbase — Coinbase Commerce calls this when a charge
// is confirmed, delayed, or fails. Signature verification is mandatory —
// never trust this endpoint without it.
async function handleWebhook(req, res) {
  const signature = req.headers['x-cc-webhook-signature'];
  const rawBody = req.body; // raw Buffer (see route setup)

  const expected = crypto
    .createHmac('sha256', COINBASE_COMMERCE_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  if (signature !== expected) {
    console.error('Coinbase webhook signature mismatch.');
    return res.status(400).send('Invalid signature.');
  }

  const event = JSON.parse(rawBody.toString('utf8'));
  const orderId = event.event?.data?.metadata?.orderId;

  if (orderId) {
    if (event.event.type === 'charge:confirmed') {
      orderStore.updateOrder(orderId, { status: 'paid' });
      console.log(`Order ${orderId} paid via crypto.`);
    } else if (event.event.type === 'charge:failed') {
      orderStore.updateOrder(orderId, { status: 'failed' });
    }
  }

  res.json({ received: true });
}

module.exports = { createCharge, handleWebhook };
