# Parcel — pixel canvas with real Stripe payments

A 120×80 shared canvas (9,600 pixels). Each pixel costs €1. Buyers drag-select
a rectangle, pick a color and a name, and pay through a real Stripe Checkout
session. A pixel is only marked as "claimed" **after** Stripe confirms the
payment via webhook — never on the client, and never before the charge succeeds.

## 1. Install

```bash
npm install
```

## 2. Configure Stripe

1. Create a Stripe account at https://dashboard.stripe.com if you don't have one.
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Fill in `STRIPE_SECRET_KEY` from https://dashboard.stripe.com/apikeys
   (start with a **test** key, `sk_test_...`, until you're ready to go live).

## 3. Run the webhook locally (development)

Stripe needs to call your server when a payment completes. Locally, use the
[Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhook
```

This prints a webhook signing secret (`whsec_...`) — put it in `.env` as
`STRIPE_WEBHOOK_SECRET`.

## 4. Start the server

```bash
npm start
```

Visit http://localhost:3000, select some pixels, and click **Pay with
Stripe**. Use Stripe's test card `4242 4242 4242 4242`, any future expiry,
any CVC. After payment, Stripe redirects back and the pixels appear once the
webhook lands (usually within a couple seconds).

## 5. Going live

1. Deploy `server.js` + `public/` to a host that can run Node (Render,
   Railway, Fly.io, a VPS, etc.) — this **cannot** run as a static site,
   it needs a persistent server process.
2. Switch to your live Stripe keys (`sk_live_...`).
3. In the Stripe Dashboard, add a **live** webhook endpoint pointing at
   `https://yourdomain.com/api/webhook`, subscribed to
   `checkout.session.completed`, and put its signing secret in your
   production `.env`.
4. Set `DOMAIN` in `.env` to your real public URL.
5. Replace the file-based store (`data/pixels.json`) with a real database
   (Postgres, SQLite, etc.) if you expect concurrent traffic at scale —
   the JSON file is fine for a demo or low-traffic launch, but a real DB
   avoids any edge-case write contention under heavy load.

## How the money flow works

1. Client drags a selection → sends the rectangle to `POST /api/checkout`.
2. Server checks which pixels in that rectangle are still free, creates a
   Stripe Checkout Session priced at €1 × available pixels, and returns the
   session's hosted payment URL.
3. Browser redirects to Stripe's own checkout page (you never see card
   details — Stripe handles that).
4. On success, Stripe calls your `/api/webhook` server-to-server with a
   signed event. The server verifies the signature, then writes the
   purchased pixels to `data/pixels.json`.
5. The browser polls `/api/pixels` and shows the newly claimed pixels.

## Notes

- Pixel data is stored in `data/pixels.json`. Back it up if this goes live.
- If a rectangle partially overlaps already-claimed pixels, only the free
  ones are charged and claimed.
- All amounts are in EUR, one pixel = €1 (`PRICE_PER_PIXEL_CENTS` in
  `server.js` if you want to change the price).
