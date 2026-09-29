const { getDraft, saveDraft, clearDraft } = require('../models/workoutDraft.model');

const MAX_BYTES = 200 * 1024; // a draft is a form's worth of text — anything bigger is a mistake

async function get(req, res) {
  try {
    res.json((await getDraft(req.userId)) || { draft: null });
  } catch (err) {
    // Table missing (SQL not run yet) or DB hiccup: behave as "no draft" so
    // logging a workout is never blocked by this feature.
    console.error('Workout draft read failed:', err.message);
    res.json({ draft: null });
  }
}

async function put(req, res) {
  try {
    const data = req.body?.draft;
    if (!data || typeof data !== 'object' || Array.isArray(data))
      return res.status(400).json({ error: 'draft must be an object' });
    if (!Array.isArray(data.exercises)) return res.status(400).json({ error: 'draft.exercises must be a list' });
    if (Buffer.byteLength(JSON.stringify(data)) > MAX_BYTES) return res.status(413).json({ error: 'Draft too large' });
    await saveDraft(req.userId, data);
    res.json({ success: true });
  } catch (err) {
    console.error('Workout draft save failed:', err.message);
    res.status(500).json({ error: 'Could not save draft' });
  }
}

async function remove(req, res) {
  try {
    await clearDraft(req.userId);
    res.json({ success: true });
  } catch (err) {
    console.error('Workout draft clear failed:', err.message);
    res.status(500).json({ error: 'Could not clear draft' });
  }
}

module.exports = { get, put, remove };
