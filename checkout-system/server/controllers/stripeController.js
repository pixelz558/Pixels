// server/controllers/stripeController.js
// Handles card payments AND Apple Pay / Google Pay — all three go through
// Stripe's PaymentIntent API. Apple Pay / Google Pay are just alternate
// "wallets" surfaced by Stripe's Payment Request Button on the frontend;
// no separate backend integration is needed for them.

const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } = require('../config/env');
const stripe = require('stripe')(STRIPE_SECRET_KEY);
const orderStore = require('../store/orderStore');

// POST /api/payments/stripe/intent  { orderId }
async function createPaymentIntent(req, res) {
  try {
    const { orderId } = req.body;
    const order = orderStore.getOrder(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (order.status === 'paid') return res.status(409).json({ error: 'Order already paid.' });

    const intent = await stripe.paymentIntents.create({
      amount: order.totalCents,
      currency: order.currency,
      automatic_payment_methods: { enabled: true }, // lets Stripe surface card/wallets automatically
      metadata: { orderId: order.id },
    });

    res.json({ clientSecret: intent.client_secret });
  } catch (err) {
    console.error('Stripe intent error:', err);
    res.status(500).json({ error: 'Could not initialize card payment.' });
  }
}

// POST /api/webhooks/stripe — Stripe calls this server-to-server after payment.
// This is the ONLY place an order is marked "paid" for Stripe payments.
async function handleWebhook(req, res) {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature invalid:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    const orderId = intent.metadata?.orderId;
    if (orderId) {
      orderStore.updateOrder(orderId, { status: 'paid', paymentMethod: 'card' });
      console.log(`Order ${orderId} paid via Stripe.`);
    }
  } else if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object;
    const orderId = intent.metadata?.orderId;
    if (orderId) orderStore.updateOrder(orderId, { status: 'failed' });
  }

  res.json({ received: true });
}

module.exports = { createPaymentIntent, handleWebhook };
