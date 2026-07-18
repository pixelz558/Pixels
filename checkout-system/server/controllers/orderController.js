// server/controllers/orderController.js
const { PRODUCTS } = require('../config/products');
const { TAX_RATE, CURRENCY } = require('../config/env');
const orderStore = require('../store/orderStore');

// POST /api/orders — build an order from { items: [{ id, qty }] }
// Prices always come from the server's product catalog, never from the client.
function createOrder(req, res) {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty.' });
  }

  let subtotalCents = 0;
  const resolvedItems = [];

  for (const { id, qty } of items) {
    const product = PRODUCTS[id];
    const quantity = Number(qty) || 0;
    if (!product || quantity <= 0 || quantity > 99) {
      return res.status(400).json({ error: `Invalid item: ${id}` });
    }
    const lineTotal = product.priceCents * quantity;
    subtotalCents += lineTotal;
    resolvedItems.push({ id, name: product.name, qty: quantity, priceCents: product.priceCents, lineTotal });
  }

  const taxCents = Math.round(subtotalCents * TAX_RATE);
  const totalCents = subtotalCents + taxCents;

  const order = orderStore.createOrder({
    items: resolvedItems,
    subtotalCents,
    taxCents,
    totalCents,
    currency: CURRENCY,
  });

  res.json(order);
}

// GET /api/orders/:id — used by checkout/success/cancel pages to display or poll status
function getOrder(req, res) {
  const order = orderStore.getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  res.json(order);
}

module.exports = { createOrder, getOrder };
