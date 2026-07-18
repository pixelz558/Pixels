// server/routes/payments.js
const express = require('express');
const router = express.Router();

const stripeController = require('../controllers/stripeController');
const paypalController = require('../controllers/paypalController');
const cryptoController = require('../controllers/cryptoController');
const bankController = require('../controllers/bankController');

// Card + Apple Pay + Google Pay (all via Stripe)
router.post('/stripe/intent', stripeController.createPaymentIntent);

// PayPal
router.post('/paypal/create-order', paypalController.createOrder);
router.post('/paypal/capture-order', paypalController.captureOrder);

// Crypto (Coinbase Commerce: BTC, ETH, USDT, ...)
router.post('/crypto/charge', cryptoController.createCharge);

// Bank transfer
router.post('/bank/reference', bankController.getBankInstructions);
router.post('/bank/confirm', bankController.confirmBankTransfer); // protect with admin auth in production

module.exports = router;
