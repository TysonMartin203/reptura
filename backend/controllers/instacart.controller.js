// Server-side proxy to Instacart's Developer Platform API — keeps the API
// key off the client and does the actual "build a shoppable list" call.
// Docs: https://docs.instacart.com/developer_platform_api

// Every unit here is confirmed valid on Instacart's own Units of Measurement
// page (docs.instacart.com/developer_platform_api/api/units_of_measurement).
// Sending anything outside this set just makes that one item fall back to
// name-only matching per their docs — never send an unrecognized unit.
const INSTACART_UNIT_WHITELIST = new Set([
  'cup', 'fl oz ounce', 'gallon', 'milliliter', 'liter', 'pint', 'quart',
  'tbs', 'tsp', 'gram', 'kilogram', 'pound', 'ounce', 'can', 'bunch',
  'head', 'package', 'large', 'medium', 'small', 'each',
]);

function getBaseUrl() {
  const env = (process.env.INSTACART_ENV || 'development').toLowerCase();
  return env === 'production'
    ? 'https://connect.instacart.com'
    : 'https://connect.dev.instacart.tools';
}

async function createShoppingList(req, res) {
  try {
    if (!process.env.INSTACART_API_KEY) {
      return res.status(500).json({ error: "Instacart isn't connected yet — add INSTACART_API_KEY on the backend." });
    }
    const { title, items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' });
    }

    const line_items = items.slice(0, 100).map(it => {
      const li = { name: String(it.name || '').trim().slice(0, 200) || 'Grocery item' };
      if (it.quantity != null && it.unit && INSTACART_UNIT_WHITELIST.has(it.unit)) {
        li.line_item_measurements = [{ quantity: Number(it.quantity), unit: it.unit }];
      }
      return li;
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let resp;
    try {
      resp = await fetch(`${getBaseUrl()}/idp/v1/products/products_link`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.INSTACART_API_KEY}`,
        },
        body: JSON.stringify({
          title: (title || 'Reptura Shopping List').slice(0, 200),
          link_type: 'shopping_list',
          line_items,
          landing_page_configuration: {
            partner_linkback_url: 'https://reptura.fit',
          },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error('Instacart API error:', resp.status, JSON.stringify(data));
      const msg = data?.message || (Array.isArray(data?.errors) && data.errors[0]?.message) || null;
      return res.status(502).json({ error: msg || 'Instacart could not build the shopping list right now.' });
    }

    res.json({ url: data.products_link_url });
  } catch (err) {
    console.error(err);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Instacart took too long to respond — please try again.' });
    }
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { createShoppingList };
