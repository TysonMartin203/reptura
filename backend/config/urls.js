// CLIENT_URL holds *every* origin the frontend is served from, comma-separated,
// because CORS has to allow all of them (the custom domain, its www variant,
// the netlify.app fallback). But anywhere the server sends a browser **to** the
// app — an OAuth redirect, a password-reset link — it needs exactly one
// address. Reading CLIENT_URL directly in those places glues the whole list
// into one broken URL, so everything that needs a destination uses frontendUrl().

function splitOrigins(value) {
  return String(value || '')
    .split(',')
    .map(s => s.trim().replace(/\/+$/, '')) // tolerate spaces and trailing slashes
    .filter(Boolean);
}

// Deliberately strict: an entry like "https//www.example.com" (missing the
// colon) must fail this, or a typo silently becomes a redirect target.
function isUsableOrigin(url) {
  return /^https?:\/\/[^/\s]+/i.test(url);
}

// Origins allowed to call the API. Always includes local dev.
function clientOrigins() {
  return ['http://localhost:5173', ...splitOrigins(process.env.CLIENT_URL).filter(isUsableOrigin)];
}

// The single canonical address to send a browser to. FRONTEND_URL wins when
// set (explicit override); otherwise the first *valid* CLIENT_URL entry, so a
// malformed one can't become the destination.
function frontendUrl() {
  const explicit = splitOrigins(process.env.FRONTEND_URL).filter(isUsableOrigin)[0];
  if (explicit) return explicit;
  return splitOrigins(process.env.CLIENT_URL).filter(isUsableOrigin)[0] || 'http://localhost:5173';
}

// Entries that were set but don't parse as URLs. Logged at boot so a missing
// colon shows up in the server logs instead of quietly breaking CORS for one
// domain and leaving the browser to report an opaque "Load failed".
function malformedOrigins() {
  return [...splitOrigins(process.env.CLIENT_URL), ...splitOrigins(process.env.FRONTEND_URL)]
    .filter(v => !isUsableOrigin(v));
}

module.exports = { splitOrigins, isUsableOrigin, clientOrigins, frontendUrl, malformedOrigins };
