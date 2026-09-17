const { findByUsername, findById } = require('../models/user.model');
const { sendRequest, acceptRequest, getFriends, getRecommendedFriends } = require('../models/friend.model');
const { createNotification } = require('../models/notification.model');
const { sendPushToUser } = require('../models/push.model');
const pool = require('../config/db');

async function add(req, res) {
  try {
    const { username } = req.body;
    const target = await findByUsername(username);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.id === req.userId) return res.status(400).json({ error: 'Cannot add yourself' });
    await sendRequest(req.userId, target.id);

    const sender = await findById(req.userId);
    await createNotification({
      userId: target.id, type: 'friend_request',
      title: `${sender?.username || 'Someone'} sent you a friend request`,
      body: 'Tap to view your friend requests',
      data: { from: req.userId },
    });
    const [[receiver]] = await pool.query('SELECT notify_friend_requests FROM Users WHERE id = ?', [target.id]);
    if (receiver?.notify_friend_requests !== 0) {
      await sendPushToUser(target.id, {
        title: `${sender?.username || 'Someone'} sent you a friend request`,
        body: 'Tap to view your friend requests',
        data: { type: 'friend_request', from: req.userId },
      });
    }

    res.status(201).json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'Request already sent' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function accept(req, res) {
  try {
    await acceptRequest(req.params.requesterId, req.userId);

    const accepter = await findById(req.userId);
    await createNotification({
      userId: req.params.requesterId, type: 'friend_request',
      title: `${accepter?.username || 'Someone'} accepted your friend request`,
      body: 'You are now friends!',
      data: { from: req.userId },
    });
    const [[requester]] = await pool.query('SELECT notify_friend_requests FROM Users WHERE id = ?', [req.params.requesterId]);
    if (requester?.notify_friend_requests !== 0) {
      await sendPushToUser(req.params.requesterId, {
        title: `${accepter?.username || 'Someone'} accepted your friend request`,
        body: 'You are now friends!',
        data: { type: 'friend_request', from: req.userId },
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function list(req, res) {
  try {
    const friends = await getFriends(req.userId);
    res.json(friends);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function recommended(req, res) {
  try {
    const suggestions = await getRecommendedFriends(req.userId);
    res.json(suggestions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { add, accept, list, recommended };
