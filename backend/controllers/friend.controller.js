const { findByUsername } = require('../models/user.model');
const { sendRequest, acceptRequest, getFriends, getRecommendedFriends } = require('../models/friend.model');

async function add(req, res) {
  try {
    const { username } = req.body;
    const target = await findByUsername(username);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.id === req.userId) return res.status(400).json({ error: 'Cannot add yourself' });
    await sendRequest(req.userId, target.id);
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
