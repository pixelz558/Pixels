// server/controllers/bankController.js
// There is no universal "instant" bank transfer API — real sites (and this
// one) show the buyer your bank details plus a unique reference code, mark
// the order "pending", and a human (or a bank-statement import job) later
// matches the incoming transfer to the reference and confirms it.

const { BANK_DETAILS } = require('../config/env');
const orderStore = require('../store/orderStore');

// POST /api/payments/bank/reference  { orderId }
function getBankInstructions(req, res) {
  const { orderId } = req.body;
  const order = orderStore.getOrder(orderId);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  orderStore.updateOrder(orderId, { status: 'pending', paymentMethod: 'bank_transfer' });

  res.json({
    ...BANK_DETAILS,
    reference: `ORDER-${order.id.slice(0, 8).toUpperCase()}`,
    amount: (order.totalCents / 100).toFixed(2),
    currency: order.currency.toUpperCase(),
  });
}

// POST /api/payments/bank/confirm  { orderId }
// Admin-only in a real app (add auth middleware!) — manually marks a bank
// transfer as received. Included here as the hook a back-office tool would call.
function confirmBankTransfer(req, res) {
  const { orderId } = req.body;
  const order = orderStore.updateOrder(orderId, { status: 'paid' });
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  res.json(order);
}

module.exports = { getBankInstructions, confirmBankTransfer };
