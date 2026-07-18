// server/config/products.js
// The ONLY place prices are defined. The client sends product IDs + quantities;
// the server looks up real prices here and computes totals itself.
// Never trust a price sent from the browser.

const PRODUCTS = {
  'pro-plan-monthly': { name: 'Pro Plan — Monthly', priceCents: 2900 },
  'pro-plan-yearly': { name: 'Pro Plan — Yearly', priceCents: 29000 },
  'starter-pack': { name: 'Starter Pack', priceCents: 900 },
};

module.exports = { PRODUCTS };
