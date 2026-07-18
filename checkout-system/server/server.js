// server/server.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const { PORT, DOMAIN, STRIPE_PUBLISHABLE_KEY, PAYPAL_CLIENT_ID } = require('./config/env');

const stripeController = require('./controllers/stripeController');
const cryptoController = require('./controllers/cryptoController');
const ordersRouter = require('./routes/orders');
const paymentsRouter = require('./routes/payments');

const app = express();

// --- Webhooks need the RAW request body for signature verification, ---
// --- so they're registered BEFORE express.json() and are exempt from it. ---
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeController.handleWebhook);
app.post('/api/webhooks/coinbase', express.raw({ type: 'application/json' }), cryptoController.handleWebhook);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Frontend needs the Stripe *publishable* key and PayPal client ID to init
// their SDKs. These are safe to expose (unlike the secret keys).
app.get('/api/config', (req, res) => {
  res.json({
    stripePublishableKey: STRIPE_PUBLISHABLE_KEY,
    paypalClientId: PAYPAL_CLIENT_ID,
  });
});

app.use('/api/orders', ordersRouter);
app.use('/api/payments', paymentsRouter);

app.listen(PORT, () => {
  console.log(`Checkout system running at ${DOMAIN}`);
});
