// Direct Kroger Developer Platform integration — unlike Instacart's
// link-based approach, Kroger's Cart API adds items straight into the
// user's own Kroger cart, which means each user has to individually
// authorize Reptura via OAuth first (client_credentials tokens only cover
// public data like product search, never cart writes).
// Docs: https://developer.kroger.com
const jwt = require('jsonwebtoken');
const { saveTokens, getTokens, saveLocation, clearTokens } = require('../models/kroger.model');

function getBaseUrl() {
  const env = (process.env.KROGER_ENV || 'certification').toLowerCase();
  return env === 'production' ? 'https://api.kroger.com' : 'https://api-ce.kroger.com';
}

function basicAuthHeader() {
  const raw = `${process.env.KROGER_CLIENT_ID}:${process.env.KROGER_CLIENT_SECRET}`;
  return 'Basic ' + Buffer.from(raw).toString('base64');
}

function redirectUri() {
  return `${process.env.SERVER_URL || 'http://localhost:5000'}/api/kroger/callback`;
}

// A short-lived app-level token for public endpoints (product/location
// search) — cached in memory since it's identical for every user and
// Kroger's own client_credentials tokens last ~30 minutes.
let appTokenCache = { token: null, expiresAt: 0 };
async function getAppToken() {
  if (appTokenCache.token && Date.now() < appTokenCache.expiresAt) return appTokenCache.token;
  const resp = await fetch(`${getBaseUrl()}/v1/connect/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': basicAuthHeader() },
    body: 'grant_type=client_credentials&scope=product.compact',
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error_description || 'Could not reach Kroger');
  appTokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return data.access_token;
}

// Returns a valid access token for this user, transparently refreshing it
// first if it's expired — the user never has to re-authorize for this.
async function getUserToken(userId) {
  const row = await getTokens(userId);
  if (!row) return null;
  if (new Date(row.expires_at) > new Date()) return row.access_token;

  const resp = await fetch(`${getBaseUrl()}/v1/connect/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': basicAuthHeader() },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(row.refresh_token)}`,
  });
  const data = await resp.json();
  if (!resp.ok) return null; // refresh token itself expired — user needs to reconnect
  await saveTokens(userId, { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in });
  return data.access_token;
}

function connect(req, res) {
  if (!process.env.KROGER_CLIENT_ID) {
    return res.status(500).json({ error: "Kroger isn't connected yet — add KROGER_CLIENT_ID/SECRET on the backend." });
  }
  const state = jwt.sign({ userId: req.userId }, process.env.JWT_SECRET, { expiresIn: '10m' });
  const params = new URLSearchParams({
    scope: 'cart.basic:write profile.compact',
    response_type: 'code',
    client_id: process.env.KROGER_CLIENT_ID,
    redirect_uri: redirectUri(),
    state,
  });
  res.json({ url: `${getBaseUrl()}/v1/connect/oauth2/authorize?${params.toString()}` });
}

// This is the URL Kroger itself redirects the user's browser to — it's
// hit directly by the browser (no Authorization header), so the signed
// state param is what tells us which Reptura user this is.
async function callback(req, res) {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  try {
    const { code, state, error: krogerError } = req.query;
    if (krogerError) return res.redirect(`${clientUrl}/account?kroger=denied`);
    let userId;
    try {
      ({ userId } = jwt.verify(state, process.env.JWT_SECRET));
    } catch {
      return res.redirect(`${clientUrl}/account?kroger=error`);
    }

    const resp = await fetch(`${getBaseUrl()}/v1/connect/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': basicAuthHeader() },
      body: `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri())}`,
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.error('Kroger token exchange failed:', data);
      return res.redirect(`${clientUrl}/account?kroger=error`);
    }

    await saveTokens(userId, { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in });
    res.redirect(`${clientUrl}/account?kroger=connected`);
  } catch (err) {
    console.error(err);
    res.redirect(`${clientUrl}/account?kroger=error`);
  }
}

async function status(req, res) {
  try {
    const row = await getTokens(req.userId);
    res.json({
      // Whether the Kroger app keys are set on the server at all — lets the
      // app show "not available yet" instead of a developer-facing error.
      configured: !!(process.env.KROGER_CLIENT_ID && process.env.KROGER_CLIENT_SECRET),
      connected: !!row, locationId: row?.location_id || null, locationName: row?.location_name || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function disconnect(req, res) {
  try {
    await clearTokens(req.userId);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function searchStores(req, res) {
  try {
    const zip = String(req.query.zip || '').trim();
    if (!/^\d{5}$/.test(zip)) return res.status(400).json({ error: 'Enter a valid 5-digit ZIP code' });
    const token = await getAppToken();
    const params = new URLSearchParams({ 'filter.zipCode.near': zip, 'filter.radiusInMiles': '15', 'filter.limit': '10' });
    const resp = await fetch(`${getBaseUrl()}/v1/locations?${params.toString()}`, {
      headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` },
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(502).json({ error: 'Kroger could not look up stores right now.' });
    const stores = (data.data || []).map(loc => ({
      locationId: loc.locationId,
      name: loc.chain || loc.name || 'Kroger-family store',
      address: [loc.address?.addressLine1, loc.address?.city, loc.address?.state].filter(Boolean).join(', '),
    }));
    res.json({ stores });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function setLocation(req, res) {
  try {
    const { locationId, name } = req.body;
    if (!locationId) return res.status(400).json({ error: 'locationId required' });
    await saveLocation(req.userId, locationId, name || null);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function addToCart(req, res) {
  try {
    const row = await getTokens(req.userId);
    if (!row) return res.status(401).json({ error: 'Connect your Kroger account first.' });
    if (!row.location_id) return res.status(400).json({ error: 'Pick a Kroger store first.' });

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'No items provided' });

    const userToken = await getUserToken(req.userId);
    if (!userToken) return res.status(401).json({ error: 'Your Kroger connection expired — please reconnect.' });
    const appToken = await getAppToken();

    const added = [];
    const notFound = [];
    for (const it of items.slice(0, 100)) {
      const name = String(it.name || '').trim();
      if (!name) continue;
      const params = new URLSearchParams({ 'filter.term': name, 'filter.locationId': row.location_id, 'filter.limit': '1' });
      const searchResp = await fetch(`${getBaseUrl()}/v1/products?${params.toString()}`, {
        headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${appToken}` },
      });
      const searchData = await searchResp.json();
      const upc = searchData?.data?.[0]?.upc;
      if (!upc) { notFound.push(name); continue; }
      added.push({ name, upc, quantity: Math.max(1, Math.round(Number(it.quantity) || 1)) });
    }

    if (added.length > 0) {
      const cartResp = await fetch(`${getBaseUrl()}/v1/cart/add`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ items: added.map(a => ({ upc: a.upc, quantity: a.quantity, modality: 'PICKUP' })) }),
      });
      if (!cartResp.ok) {
        const errBody = await cartResp.json().catch(() => ({}));
        console.error('Kroger cart add failed:', cartResp.status, errBody);
        return res.status(502).json({ error: 'Kroger could not add items to your cart right now.' });
      }
    }

    res.json({ added: added.map(a => a.name), notFound });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { connect, callback, status, disconnect, searchStores, setLocation, addToCart };
