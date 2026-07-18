// server/config/env.js
// Loads and validates environment variables in one place so the rest of
// the app never touches `process.env` directly.
require('dotenv').config();

function required(name, fallback = undefined) {
  const val = process.env[name] ?? fallback;
  return val;
}

module.exports = {
  PORT: process.env.PORT || 4000,
  DOMAIN: process.env.DOMAIN || 'http://localhost:4000',

  // Stripe (cards, Apple Pay, Google Pay all go through Stripe)
  STRIPE_SECRET_KEY: required('STRIPE_SECRET_KEY'),
  STRIPE_PUBLISHABLE_KEY: required('STRIPE_PUBLISHABLE_KEY'),
  STRIPE_WEBHOOK_SECRET: required('STRIPE_WEBHOOK_SECRET'),

  // PayPal
  PAYPAL_CLIENT_ID: required('PAYPAL_CLIENT_ID'),
  PAYPAL_CLIENT_SECRET: required('PAYPAL_CLIENT_SECRET'),
  PAYPAL_ENV: process.env.PAYPAL_ENV || 'sandbox', // 'sandbox' | 'live'

  // Coinbase Commerce (crypto: BTC, ETH, USDT, etc.)
  COINBASE_COMMERCE_API_KEY: required('COINBASE_COMMERCE_API_KEY'),
  COINBASE_COMMERCE_WEBHOOK_SECRET: required('COINBASE_COMMERCE_WEBHOOK_SECRET'),

  // Bank transfer details shown to the customer (no API — manual reconciliation)
  BANK_DETAILS: {
    accountName: process.env.BANK_ACCOUNT_NAME || 'Your Company Ltd.',
    iban: process.env.BANK_IBAN || 'FR76 XXXX XXXX XXXX XXXX XXXX XXX',
    bic: process.env.BANK_BIC || 'XXXXXXXX',
    bankName: process.env.BANK_NAME || 'Your Bank',
  },

  TAX_RATE: parseFloat(process.env.TAX_RATE || '0.20'), // 20% default VAT
  CURRENCY: process.env.CURRENCY || 'eur',
};
