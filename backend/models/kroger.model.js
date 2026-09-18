const pool = require('../config/db');

async function saveTokens(userId, { accessToken, refreshToken, expiresIn }) {
  const expiresAt = new Date(Date.now() + (expiresIn - 60) * 1000); // 60s safety margin
  await pool.query(
    `INSERT INTO KrogerAuth (user_id, access_token, refresh_token, expires_at)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE access_token = VALUES(access_token), refresh_token = VALUES(refresh_token), expires_at = VALUES(expires_at)`,
    [userId, accessToken, refreshToken, expiresAt]
  );
}

async function getTokens(userId) {
  const [[row]] = await pool.query('SELECT * FROM KrogerAuth WHERE user_id = ?', [userId]);
  return row || null;
}

async function saveLocation(userId, locationId, locationName) {
  await pool.query('UPDATE KrogerAuth SET location_id = ?, location_name = ? WHERE user_id = ?', [locationId, locationName, userId]);
}

async function clearTokens(userId) {
  await pool.query('DELETE FROM KrogerAuth WHERE user_id = ?', [userId]);
}

module.exports = { saveTokens, getTokens, saveLocation, clearTokens };
