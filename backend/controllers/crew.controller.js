const {
  createCrew, getMyCrews, getCrew, inviteMember, getCrewInvites, respondCrewInvite,
  getMessages, sendMessage, deleteCrew,
} = require('../models/crew.model');

async function create(req, res) {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const id = await createCrew(req.userId, name.trim());
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function list(req, res) {
  try {
    res.json(await getMyCrews(req.userId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function getOne(req, res) {
  try {
    const crew = await getCrew(req.params.id, req.userId);
    if (!crew) return res.status(404).json({ error: 'Not found' });
    res.json(crew);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function invite(req, res) {
  try {
    const id = await inviteMember(req.params.id, req.userId, req.body.friendId);
    res.json({ success: true, inviteId: id });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Server error' });
  }
}

async function listInvites(req, res) {
  try {
    res.json(await getCrewInvites(req.userId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function acceptInvite(req, res) {
  try {
    const crewId = await respondCrewInvite(req.params.id, req.userId, true);
    res.json({ success: true, crewId });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Server error' });
  }
}

async function declineInvite(req, res) {
  try {
    await respondCrewInvite(req.params.id, req.userId, false);
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Server error' });
  }
}

async function messages(req, res) {
  try {
    res.json(await getMessages(req.params.id, req.userId));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Server error' });
  }
}

async function send(req, res) {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message required' });
    const id = await sendMessage(req.params.id, req.userId, message.trim());
    res.status(201).json({ id });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Server error' });
  }
}

async function remove(req, res) {
  try {
    await deleteCrew(req.params.id, req.userId);
    res.json({ success: true });
  } catch (err) {
    if (!err.status) console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Server error' });
  }
}

module.exports = { create, list, getOne, invite, listInvites, acceptInvite, declineInvite, messages, send, remove };
