const pool = require('../config/db');

async function addFeedEvent({ userId, type, refId, headline, detail }) {
  await pool.query(
    'INSERT INTO FeedEvents (user_id, type, ref_id, headline, detail) VALUES (?, ?, ?, ?, ?)',
    [userId, type, refId || null, headline, detail || null]
  );
}

// Feed = the user's own events + their accepted friends' events, filtered by
// the viewer's own feed-type preference and any friends they've muted.
// Muting never hides the viewer's own posts — only other people's.
async function getFeed(userId, viewerId) {
  const [[viewer]] = await pool.query('SELECT feed_types FROM Users WHERE id = ?', [viewerId]);
  const enabledTypes = viewer?.feed_types ? viewer.feed_types.split(',').filter(Boolean) : null;

  const [muted] = await pool.query('SELECT muted_user_id FROM FeedMutes WHERE user_id = ?', [viewerId]);
  const mutedIds = muted.map(m => m.muted_user_id);

  const params = [userId, userId, userId, userId];
  let typeClause = '';
  if (enabledTypes && enabledTypes.length) {
    typeClause = 'AND (fe.type NOT IN (\'workout\',\'pr\',\'challenge\',\'meal\') OR fe.type IN (?) OR fe.user_id = ?)';
    params.push(enabledTypes, viewerId);
  }
  let muteClause = '';
  if (mutedIds.length) {
    muteClause = 'AND (fe.user_id = ? OR fe.user_id NOT IN (?))';
    params.push(viewerId, mutedIds);
  }

  const [rows] = await pool.query(
    `SELECT fe.*, u.username, u.avatar_url
     FROM FeedEvents fe
     JOIN Users u ON u.id = fe.user_id
     WHERE fe.type != 'template_pick'
       AND (
         (fe.type NOT IN ('workout','pr','meal'))
         OR (fe.type IN ('workout','pr') AND EXISTS (SELECT 1 FROM Workouts w WHERE w.id = fe.ref_id))
         OR (fe.type = 'meal' AND EXISTS (SELECT 1 FROM LoggedMeals lm WHERE lm.id = fe.ref_id))
       )
       AND (fe.user_id = ?
        OR fe.user_id IN (
          SELECT IF(f.requester_id = ?, f.receiver_id, f.requester_id)
          FROM Friends f
          WHERE (f.requester_id = ? OR f.receiver_id = ?) AND f.status = 'accepted'
        ))
       ${typeClause}
       ${muteClause}
     ORDER BY fe.created_at DESC
     LIMIT 60`,
    params
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

// Feed preferences: which content types show, and which friends are muted.
async function getFeedPrefs(userId) {
  const [[user]] = await pool.query('SELECT feed_types FROM Users WHERE id = ?', [userId]);
  const [muted] = await pool.query(
    `SELECT u.id, u.username, u.avatar_url FROM FeedMutes fm JOIN Users u ON u.id = fm.muted_user_id WHERE fm.user_id = ?`,
    [userId]
  );
  return {
    feedTypes: user?.feed_types ? user.feed_types.split(',').filter(Boolean) : null, // null = all
    mutedFriends: muted,
  };
}

async function setFeedTypes(userId, types) {
  // Empty/omitted array is stored as NULL (meaning "show everything"), not an
  // empty string, so the getFeed filter above treats it as no restriction.
  const value = Array.isArray(types) && types.length ? types.join(',') : null;
  await pool.query('UPDATE Users SET feed_types = ? WHERE id = ?', [value, userId]);
  return value ? value.split(',') : null;
}

async function muteFriend(userId, mutedUserId) {
  await pool.query(
    'INSERT IGNORE INTO FeedMutes (user_id, muted_user_id) VALUES (?, ?)',
    [userId, mutedUserId]
  );
}

async function unmuteFriend(userId, mutedUserId) {
  await pool.query('DELETE FROM FeedMutes WHERE user_id = ? AND muted_user_id = ?', [userId, mutedUserId]);
}

module.exports = { addFeedEvent, getFeed, setReaction, removeReaction, getFeedPrefs, setFeedTypes, muteFriend, unmuteFriend };
