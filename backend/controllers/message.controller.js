const { sendMessage, getConversation, getUnreadSenderIds } = require('../models/message.model');
const { sendPushToUser } = require('../models/push.model');
const { findById } = require('../models/user.model');
const pool = require('../config/db');

async function send(req, res) {
  try {
    const { receiverId, message } = req.body;
    if (!receiverId || !message) return res.status(400).json({ error: 'receiverId and message required' });
    const id = await sendMessage({ senderId: req.userId, receiverId, message });

    const [[receiver]] = await pool.query('SELECT notify_messages FROM Users WHERE id = ?', [receiverId]);
    if (receiver?.notify_messages !== 0) {
      const sender = await findById(req.userId);
      sendPushToUser(receiverId, {
        title: sender?.username || 'New message',
        body: message.length > 80 ? message.slice(0, 77) + '…' : message,
        data: { type: 'message', from: req.userId },
      }).catch(err => console.error('Push failed:', err));
    }

    res.status(201).json({ id });
  } catch (err) {
    if (err.message === 'Not friends') return res.status(403).json({ error: 'Not friends' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function conversation(req, res) {
  try {
    const messages = await getConversation(req.userId, req.params.friendId);
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function unread(req, res) {
  try {
    const senderIds = await getUnreadSenderIds(req.userId);
    res.json(senderIds);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { send, conversation, unread };
