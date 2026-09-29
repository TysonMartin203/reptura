const pool = require('../config/db');

// One unfinished workout per user, kept on the server so it survives the app
// being closed, the phone clearing its storage, or switching devices.
// Table: WorkoutDrafts (see the SQL in the release notes / MIGRATION_minor_v27.sql).

async function getDraft(userId) {
  const [[row]] = await pool.query('SELECT data, updated_at FROM WorkoutDrafts WHERE user_id = ?', [userId]);
  if (!row) return null;
  let data = row.data;
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return null; } }
  return { draft: data, updatedAt: row.updated_at };
}

async function saveDraft(userId, data) {
  await pool.query(
    `INSERT INTO WorkoutDrafts (user_id, data, updated_at) VALUES (?, ?, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = VALUES(updated_at)`,
    [userId, JSON.stringify(data)]
  );
}

async function clearDraft(userId) {
  await pool.query('DELETE FROM WorkoutDrafts WHERE user_id = ?', [userId]);
}

module.exports = { getDraft, saveDraft, clearDraft };
