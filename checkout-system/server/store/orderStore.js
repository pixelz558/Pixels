// server/store/orderStore.js
// In-memory order storage for demo purposes.
// In production, replace this with a real database (Postgres, MongoDB, etc.) —
// the interface below is intentionally tiny so swapping it out is a one-file change.

const crypto = require('crypto');

const orders = new Map();

function createOrder({ items, subtotalCents, taxCents, totalCents, currency }) {
  const id = crypto.randomUUID();
  const order = {
    id,
    items,
    subtotalCents,
    taxCents,
    totalCents,
    currency,
    status: 'pending', // pending | paid | failed | canceled
    paymentMethod: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  orders.set(id, order);
  return order;
}

function getOrder(id) {
  return orders.get(id) || null;
}

function updateOrder(id, patch) {
  const order = orders.get(id);
  if (!order) return null;
  Object.assign(order, patch, { updatedAt: Date.now() });
  orders.set(id, order);
  return order;
}

module.exports = { createOrder, getOrder, updateOrder };
