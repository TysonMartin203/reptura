const jwt = require('jsonwebtoken');

// How long a login lasts with no use at all. Any request more than a day after
// the token was issued gets a fresh one (see middleware/auth.js), so anyone who
// opens the app at least once a month simply stays signed in.
const SESSION_DAYS = 30;
const RENEW_AFTER_SECONDS = 24 * 60 * 60;

function signSession(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });
}

module.exports = { SESSION_DAYS, RENEW_AFTER_SECONDS, signSession };
