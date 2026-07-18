# Modern Checkout System

A complete, modular checkout system: Card (Visa/Mastercard/Amex), Apple Pay,
Google Pay, PayPal, Crypto (BTC/ETH/USDT via Coinbase Commerce), and Bank
Transfer — with a clean, responsive, dark/light-mode UI.

```
/public
  index.html      demo storefront
  checkout.html   the checkout page itself
  success.html    shown after a confirmed payment
  cancel.html     shown after a failed/canceled payment
  css/
  js/
/server
  server.js
  config/         env loading, product catalog
  controllers/    one file per payment method
  routes/         orders + payments endpoints
  store/          in-memory order storage (swap for a real DB)
package.json
.env.example
```

## How payments actually get confirmed (important)

**No order is ever marked "paid" by the browser.** Each payment method has a
matching backend callback that Stripe, PayPal, or Coinbase Commerce calls
directly, server-to-server, after they've verified the money moved:

| Method | Confirmed by |
|---|---|
| Card | Stripe webhook (`payment_intent.succeeded`) |
| Apple Pay / Google Pay | Same Stripe webhook — they're just wallets on top of the same PaymentIntent |
| PayPal | Server-side capture call (`/api/payments/paypal/capture-order`) |
| Crypto | Coinbase Commerce webhook (`charge:confirmed`), signature-verified |
| Bank transfer | Manual — order is marked "pending" until someone confirms the transfer landed |

Prices are also computed **only** on the server, from `server/config/products.js`
— the client just sends product IDs and quantities, so nobody can tamper with
the price in the browser.

## 1. Install

```bash
npm install
```

## 2. Add your API keys

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Then fill in:

- **Stripe** (Card + Apple Pay + Google Pay) — `STRIPE_SECRET_KEY`,
  `STRIPE_PUBLISHABLE_KEY` from https://dashboard.stripe.com/apikeys, and
  `STRIPE_WEBHOOK_SECRET` (see step 3).
- **PayPal** — `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` from
  https://developer.paypal.com/dashboard/applications (start in `sandbox` mode).
- **Coinbase Commerce** — `COINBASE_COMMERCE_API_KEY` and
  `COINBASE_COMMERCE_WEBHOOK_SECRET` from
  https://beta.commerce.coinbase.com/settings/security.
- **Bank details** — your real IBAN/BIC, shown to customers who choose bank
  transfer.

Use **test/sandbox** keys everywhere until you're ready to take real money.

## 3. Run webhooks locally

**Stripe:**
```bash
stripe listen --forward-to localhost:4000/api/webhooks/stripe
```
Copy the `whsec_...` it prints into `STRIPE_WEBHOOK_SECRET`.

**Coinbase Commerce:** in your Commerce dashboard, add a webhook endpoint
pointing at `https://<your-public-url>/api/webhooks/coinbase` (use a tool
like `ngrok` to expose localhost while testing) and copy its shared secret
into `COINBASE_COMMERCE_WEBHOOK_SECRET`.

## 4. Start the server

```bash
npm start
```

Visit http://localhost:4000. Test cards: `4242 4242 4242 4242` (success),
`4000 0000 0000 9995` (declined), any future expiry, any CVC.

## Apple Pay setup note

Apple Pay requires domain verification before it will actually show up:
in the Stripe Dashboard → Settings → Payment methods → Apple Pay, add and
verify your domain, and host the file Stripe gives you at
`/.well-known/apple-developer-merchantid-domain-association`. Google Pay
needs no extra setup beyond Stripe's `automatic_payment_methods`.

## Going to production

1. Deploy to a Node host (Render, Railway, Fly.io, a VPS...) — this needs a
   long-running server, not a static host.
2. Swap `server/store/orderStore.js` for a real database — the in-memory
   store resets on every restart and won't work with multiple server
   instances.
3. Switch all keys to live/production versions.
4. Put `server/controllers/bankController.js`'s `confirmBankTransfer` behind
   real admin authentication before exposing it publicly.
5. Set `DOMAIN` to your real HTTPS URL (Apple Pay, PayPal, and Coinbase
   Commerce all require HTTPS in production).

## Customizing

- Products/prices: `server/config/products.js`.
- Tax rate / currency: `.env` (`TAX_RATE`, `CURRENCY`).
- Colors, fonts, dark/light theme tokens: `public/css/style.css` (`:root`,
  `[data-theme="dark"]`).
- Checkout layout: `public/css/checkout.css` + `public/checkout.html`.
