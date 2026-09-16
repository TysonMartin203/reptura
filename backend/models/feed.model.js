const pool = require('../config/db');

async function addFeedEvent({ userId, type, refId, headline, detail }) {
  await pool.query(
    'INSERT INTO FeedEvents (user_id, type, ref_id, headline, detail) VALUES (?, ?, ?, ?, ?)',
    [userId, type, refId || null, headline, detail || null]
  );
}

// Feed = the user's own events + their accepted friends' events
async function getFeed(userId, viewerId) {
  const [rows] = await pool.query(
    `SELECT fe.*, u.username, u.avatar_url
     FROM FeedEvents fe
     JOIN Users u ON u.id = fe.user_id
     WHERE fe.type != 'template_pick'
       AND (fe.type NOT IN ('workout','pr') OR EXISTS (SELECT 1 FROM Workouts w WHERE w.id = fe.ref_id))
       AND (fe.user_id = ?
        OR fe.user_id IN (
          SELECT IF(f.requester_id = ?, f.receiver_id, f.requester_id)
          FROM Friends f
          WHERE (f.requester_id = ? OR f.receiver_id = ?) AND f.status = 'accepted'
        ))
     ORDER BY fe.created_at DESC
     LIMIT 60`,
    [userId, userId, userId, userId]
  );
  if (!rows.length) return [];

  const ids = rows.map(r => r.id);
  const [reactions] = await pool.query(
    `SELECT feed_event_id, reaction, user_id FROM Reactions WHERE feed_event_id IN (?)`,
    [ids]
  );
  const byEvent = {};
  for (const r of reactions) {
    (byEvent[r.feed_event_id] = byEvent[r.feed_event_id] || []).push(r);
  }

  return rows.map(row => {
    const evReactions = byEvent[row.id] || [];
    const counts = {};
    let myReaction = null;
    for (const r of evReactions) {
      counts[r.reaction] = (counts[r.reaction] || 0) + 1;
      if (r.user_id === viewerId) myReaction = r.reaction;
    }
    return { ...row, reactionCounts: counts, myReaction };
  });
}

async function setReaction(feedEventId, userId, reaction) {
  await pool.query(
    `INSERT INTO Reactions (feed_event_id, user_id, reaction) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE reaction = VALUES(reaction)`,
    [feedEventId, userId, reaction]
  );
  const [[event]] = await pool.query('SELECT user_id, headline FROM FeedEvents WHERE id = ?', [feedEventId]);
  return event || null;
}

async function removeReaction(feedEventId, userId) {
  await pool.query('DELETE FROM Reactions WHERE feed_event_id = ? AND user_id = ?', [feedEventId, userId]);
}

module.exports = { addFeedEvent, getFeed, setReaction, removeReaction };
