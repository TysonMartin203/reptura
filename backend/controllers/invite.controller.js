const { createInvite, getInvites, respondInvite } = require('../models/invite.model');
const { createNotification } = require('../models/notification.model');
const { sendPushToUser } = require('../models/push.model');
const { findById } = require('../models/user.model');
const pool = require('../config/db');

async function create(req, res) {
  try {
    const { receiverId, proposedAt, message } = req.body;
    if (!receiverId || !proposedAt) return res.status(400).json({ error: 'receiverId and proposedAt required' });
    const id = await createInvite({ senderId: req.userId, receiverId, proposedAt, message });

    const sender = await findById(req.userId);
    const when = new Date(proposedAt).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    await createNotification({
      userId: receiverId, type: 'train_invite',
      title: `${sender?.username || 'A friend'} wants to train together`,
      body: `${when}${message ? ' — ' + message : ''}`,
      data: { inviteId: id },
    });
    const [[receiver]] = await pool.query('SELECT notify_invites FROM Users WHERE id = ?', [receiverId]);
    if (receiver?.notify_invites !== 0) {
      await sendPushToUser(receiverId, {
        title: 'Train-together invite',
        body: `${sender?.username || 'A friend'} wants to lift ${when}`,
        data: { type: 'train_invite', inviteId: id },
      });
    }

    res.status(201).json({ id });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Server error' });
  }
}

async function list(req, res) {
  try {
    res.json(await getInvites(req.userId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function accept(req, res) {
  try {
    const ok = await respondInvite(req.params.id, req.userId, 'accepted');
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function decline(req, res) {
  try {
    const ok = await respondInvite(req.params.id, req.userId, 'declined');
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { create, list, accept, decline };
