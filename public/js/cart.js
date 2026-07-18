// public/js/cart.js
// Minimal cart: just remembers what the shopper picked so checkout.html
// can ask the server to price it. No prices are stored client-side.
const Cart = {
  KEY: 'demo_cart_items',
  set(items) { sessionStorage.setItem(this.KEY, JSON.stringify(items)); },
  get() {
    try { return JSON.parse(sessionStorage.getItem(this.KEY)) || []; }
    catch { return []; }
  },
  clear() { sessionStorage.removeItem(this.KEY); },
};
