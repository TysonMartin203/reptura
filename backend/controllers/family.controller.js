const { listMembers, addMember, updateMember, deleteMember } = require('../models/family.model');

async function list(req, res) {
  try {
    res.json({ members: await listMembers(req.userId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function create(req, res) {
  try {
    const { name, age, weight, goal } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required' });
    const id = await addMember(req.userId, { name: String(name).trim().slice(0, 100), age, weight, goal });
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function update(req, res) {
  try {
    const { name, age, weight, goal } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required' });
    const ok = await updateMember(req.params.id, req.userId, { name: String(name).trim().slice(0, 100), age, weight, goal });
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function remove(req, res) {
  try {
    const ok = await deleteMember(req.params.id, req.userId);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { list, create, update, remove };
