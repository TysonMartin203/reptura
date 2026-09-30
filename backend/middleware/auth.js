const jwt = require('jsonwebtoken');
const { RENEW_AFTER_SECONDS, signSession } = require('../config/session');

// A rejected login carries code SESSION_EXPIRED. The app signs out ONLY on that
// code — other 401s (wrong current password, Kroger needing a reconnect) must
// never log someone out.
function expired(res, error) {
  return res.status(401).json({ error, code: 'SESSION_EXPIRED' });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return expired(res, 'Please log in.');
  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return expired(res, 'Your session expired — please log in again.');
  }
  req.userId = payload.userId;

  // Sliding session: once a token is a day old, hand back a fresh one. The app
  // swaps it in (api/client.js), so regular use never hits an expiry.
  const age = Math.floor(Date.now() / 1000) - (payload.iat || 0);
  if (age > RENEW_AFTER_SECONDS) {
    try { res.set('X-Refreshed-Token', signSession(payload.userId)); } catch { /* never block a request over this */ }
  }
  next();
}

module.exports = authMiddleware;
