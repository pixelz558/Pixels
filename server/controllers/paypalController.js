// server/controllers/paypalController.js
const paypal = require('@paypal/checkout-server-sdk');
const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENV } = require('../config/env');
const orderStore = require('../store/orderStore');

function paypalClient() {
  const env =
    PAYPAL_ENV === 'live'
      ? new paypal.core.LiveEnvironment(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET)
      : new paypal.core.SandboxEnvironment(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET);
  return new paypal.core.PayPalHttpClient(env);
}

// POST /api/payments/paypal/create-order  { orderId }
// Creates a PayPal order for the exact amount computed server-side.
async function createOrder(req, res) {
  try {
    const { orderId } = req.body;
    const order = orderStore.getOrder(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const amount = (order.totalCents / 100).toFixed(2);
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: order.id,
          amount: { currency_code: order.currency.toUpperCase(), value: amount },
        },
      ],
    });

    const response = await paypalClient().execute(request);
    res.json({ paypalOrderId: response.result.id });
  } catch (err) {
    console.error('PayPal create order error:', err);
    res.status(500).json({ error: 'Could not create PayPal order.' });
  }
}

// POST /api/payments/paypal/capture-order  { orderId, paypalOrderId }
// Called after the buyer approves the payment in the PayPal popup.
async function captureOrder(req, res) {
  try {
    const { orderId, paypalOrderId } = req.body;
    const order = orderStore.getOrder(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const request = new paypal.orders.OrdersCaptureRequest(paypalOrderId);
    request.requestBody({});
    const response = await paypalClient().execute(request);

    const captureStatus = response.result.status;
    if (captureStatus === 'COMPLETED') {
      orderStore.updateOrder(orderId, { status: 'paid', paymentMethod: 'paypal' });
      return res.json({ status: 'paid' });
    }

    orderStore.updateOrder(orderId, { status: 'failed' });
    res.status(402).json({ status: 'failed' });
  } catch (err) {
    console.error('PayPal capture error:', err);
    res.status(500).json({ error: 'Could not capture PayPal payment.' });
  }
}

module.exports = { createOrder, captureOrder };
