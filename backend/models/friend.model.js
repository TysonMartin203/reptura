const pool = require('../config/db');

async function sendRequest(requesterId, receiverId) {
  await pool.query(
    'INSERT INTO Friends (requester_id, receiver_id, status) VALUES (?, ?, "pending")',
    [requesterId, receiverId]
  );
}

async function acceptRequest(requesterId, receiverId) {
  await pool.query(
    'UPDATE Friends SET status = "accepted" WHERE requester_id = ? AND receiver_id = ?',
    [requesterId, receiverId]
  );
}

async function getFriends(userId) {
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.email, f.status,
            CASE WHEN f.requester_id = ? THEN 'sent' ELSE 'received' END AS direction
     FROM Friends f
     JOIN Users u ON u.id = IF(f.requester_id = ?, f.receiver_id, f.requester_id)
     WHERE f.requester_id = ? OR f.receiver_id = ?`,
    [userId, userId, userId, userId]
  );
  return rows;
}

async function areFriends(userId1, userId2) {
  const [rows] = await pool.query(
    `SELECT 1 FROM Friends
     WHERE status = 'accepted'
       AND ((requester_id = ? AND receiver_id = ?) OR (requester_id = ? AND receiver_id = ?))`,
    [userId1, userId2, userId2, userId1]
  );
  return rows.length > 0;
}

// People who share at least one accepted friend with you, excluding anyone
// you're already connected to (accepted or pending, either direction) and
// yourself, sorted by how many mutual friends they have with you.
async function getRecommendedFriends(userId) {
  const [rows] = await pool.query(
    `WITH my_friends AS (
       SELECT CASE WHEN requester_id = ? THEN receiver_id ELSE requester_id END AS friend_id
       FROM Friends WHERE status = 'accepted' AND (requester_id = ? OR receiver_id = ?)
     ),
     excluded AS (
       SELECT CASE WHEN requester_id = ? THEN receiver_id ELSE requester_id END AS excluded_id
       FROM Friends WHERE requester_id = ? OR receiver_id = ?
       UNION SELECT ?
     )
     SELECT u.id, u.username, COUNT(*) AS mutual_count
     FROM my_friends mf
     JOIN Friends f2 ON (f2.requester_id = mf.friend_id OR f2.receiver_id = mf.friend_id) AND f2.status = 'accepted'
     JOIN Users u ON u.id = CASE WHEN f2.requester_id = mf.friend_id THEN f2.receiver_id ELSE f2.requester_id END
     WHERE u.id NOT IN (SELECT excluded_id FROM excluded)
     GROUP BY u.id, u.username
     ORDER BY mutual_count DESC, u.username ASC
     LIMIT 20`,
    [userId, userId, userId, userId, userId, userId, userId]
  );
  return rows;
}

module.exports = { sendRequest, acceptRequest, getFriends, areFriends, getRecommendedFriends };
