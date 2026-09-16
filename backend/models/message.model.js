const pool = require('../config/db');
const { areFriends } = require('./friend.model');

async function sendMessage({ senderId, receiverId, message }) {
  const friends = await areFriends(senderId, receiverId);
  if (!friends) throw new Error('Not friends');
  const [result] = await pool.query(
    'INSERT INTO Messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
    [senderId, receiverId, message]
  );
  return result.insertId;
}

// Opening a conversation marks every message the other person sent you as read.
async function getConversation(userId1, userId2) {
  await pool.query(
    'UPDATE Messages SET read_at = NOW() WHERE sender_id = ? AND receiver_id = ? AND read_at IS NULL',
    [userId2, userId1]
  );
  const [rows] = await pool.query(
    `SELECT m.*, u.username AS sender_username
     FROM Messages m
     JOIN Users u ON u.id = m.sender_id
     WHERE (m.sender_id = ? AND m.receiver_id = ?)
        OR (m.sender_id = ? AND m.receiver_id = ?)
     ORDER BY m.created_at ASC`,
    [userId1, userId2, userId2, userId1]
  );
  return rows;
}

// Which of your friends have sent you at least one message you haven't
// opened yet — used to show a small indicator in the Friends list.
async function getUnreadSenderIds(userId) {
  const [rows] = await pool.query(
    'SELECT DISTINCT sender_id FROM Messages WHERE receiver_id = ? AND read_at IS NULL',
    [userId]
  );
  return rows.map(r => r.sender_id);
}

module.exports = { sendMessage, getConversation, getUnreadSenderIds };
