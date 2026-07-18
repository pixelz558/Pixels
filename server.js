require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const Stripe = require('stripe');

const {
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  DOMAIN = 'http://localhost:3000',
  PORT = 3000,
} = process.env;

if (!STRIPE_SECRET_KEY) {
  console.error('Missing STRIPE_SECRET_KEY in .env — see .env.example');
  process.exit(1);
}

const stripe = Stripe(STRIPE_SECRET_KEY);
const app = express();

const GRID_W = 120;
const GRID_H = 80;
const PRICE_PER_PIXEL_CENTS = 100; // 1 EUR

const DATA_FILE = path.join(__dirname, 'data', 'pixels.json');
if (!fs.existsSync(path.dirname(DATA_FILE))) fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}');

// Simple write queue so concurrent webhook events can't corrupt the file
let writeChain = Promise.resolve();
function readPixels() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function writePixels(pixels) {
  writeChain = writeChain.then(() =>
    fs.promises.writeFile(DATA_FILE, JSON.stringify(pixels))
  );
  return writeChain;
}

function rectCells(x1, y1, x2, y2) {
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  const cells = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) cells.push(`${x},${y}`);
  }
  return cells;
}

// --- Stripe webhook must read the RAW body, so it's registered before express.json() ---
app.post('/api/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { x1, y1, x2, y2, color, owner } = session.metadata || {};
    if (x1 !== undefined) {
      const cells = rectCells(Number(x1), Number(y1), Number(x2), Number(y2));
      const pixels = readPixels();
      const now = Date.now();
      let claimed = 0;
      for (const key of cells) {
        if (!pixels[key]) {
          pixels[key] = { c: color, o: (owner || 'anonymous').slice(0, 24), t: now, s: session.id };
          claimed++;
        }
      }
      writePixels(pixels);
      console.log(`Checkout ${session.id} completed — claimed ${claimed}/${cells.length} pixels`);
    }
  }

  res.json({ received: true });
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Current canvas state
app.get('/api/pixels', (req, res) => {
  res.json(readPixels());
});

// Create a Checkout Session for a rectangular selection
app.post('/api/checkout', async (req, res) => {
  try {
    const { x1, y1, x2, y2, color, owner } = req.body;
    for (const v of [x1, y1, x2, y2]) {
      if (!Number.isInteger(v)) return res.status(400).json({ error: 'Invalid coordinates.' });
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(color || '')) return res.status(400).json({ error: 'Invalid color.' });
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    if (minX < 0 || minY < 0 || maxX >= GRID_W || maxY >= GRID_H) {
      return res.status(400).json({ error: 'Selection is outside the canvas.' });
    }

    const cells = rectCells(x1, y1, x2, y2);
    const pixels = readPixels();
    const conflicts = cells.filter((k) => pixels[k]);
    const available = cells.length - conflicts.length;

    if (available === 0) {
      return res.status(409).json({ error: 'All selected pixels are already claimed.' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `${available} pixel${available > 1 ? 's' : ''} on Parcel`,
              description: `Block (${minX},${minY}) to (${maxX},${maxY})`,
            },
            unit_amount: PRICE_PER_PIXEL_CENTS,
          },
          quantity: available,
        },
      ],
      success_url: `${DOMAIN}/?success=true`,
      cancel_url: `${DOMAIN}/?canceled=true`,
      metadata: {
        x1: String(x1), y1: String(y1), x2: String(x2), y2: String(y2),
        color, owner: (owner || 'anonymous').slice(0, 24),
      },
    });

    res.json({ url: session.url, conflicts: conflicts.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create checkout session.' });
  }
});

app.listen(PORT, () => console.log(`Parcel running at ${DOMAIN} (port ${PORT})`));
