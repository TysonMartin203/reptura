const { getFeed, setReaction, removeReaction, getFeedPrefs, setFeedTypes, muteFriend, unmuteFriend } = require('../models/feed.model');
const { createNotification } = require('../models/notification.model');
const { sendPushToUser } = require('../models/push.model');
const { findById } = require('../models/user.model');
const pool = require('../config/db');

const VALID_REACTIONS = ['fire', 'flex', 'clap', 'whoa', 'heart'];
const REACTION_EMOJI = { fire: '🔥', flex: '💪', clap: '👊', whoa: '😮', heart: '❤️' };

async function list(req, res) {
  try {
    res.json(await getFeed(req.userId, req.userId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function react(req, res) {
  try {
    const { reaction } = req.body;
    if (!VALID_REACTIONS.includes(reaction)) return res.status(400).json({ error: 'Invalid reaction' });
    const event = await setReaction(req.params.id, req.userId, reaction);

    // Don't notify yourself for reacting to your own post.
    if (event && event.user_id !== req.userId) {
      const [[owner]] = await pool.query('SELECT notify_reactions FROM Users WHERE id = ?', [event.user_id]);
      if (owner?.notify_reactions !== 0) {
        const reactor = await findById(req.userId);
        const title = `${reactor?.username || 'Someone'} reacted ${REACTION_EMOJI[reaction] || ''} to your post`;
        await createNotification({
          userId: event.user_id, type: 'reaction',
          title, body: event.headline || '',
          data: { from: req.userId, feedEventId: req.params.id, reaction },
        });
        sendPushToUser(event.user_id, {
          title, body: event.headline || '',
          data: { type: 'reaction', from: req.userId },
        }).catch(err => console.error('Push failed:', err));
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function unreact(req, res) {
  try {
    await removeReaction(req.params.id, req.userId);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

const VALID_TYPES = ['workout', 'pr', 'challenge', 'meal'];

async function getPrefs(req, res) {
  try {
    res.json(await getFeedPrefs(req.userId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function updateTypes(req, res) {
  try {
    let { types } = req.body;
    if (!Array.isArray(types)) return res.status(400).json({ error: 'types must be an array' });
    types = types.filter(t => VALID_TYPES.includes(t));
    const saved = await setFeedTypes(req.userId, types);
    res.json({ feedTypes: saved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function mute(req, res) {
  try {
    await muteFriend(req.userId, req.params.friendId);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function unmute(req, res) {
  try {
    await unmuteFriend(req.userId, req.params.friendId);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { list, react, unreact, getPrefs, updateTypes, mute, unmute };
