const { createChallenge, listChallenges, joinChallenge, deleteChallenge, getChallengeProgress } = require('../models/challenge.model');

const NEEDS_EXERCISE = ['pr_gain', 'most_distance', 'bodyweight_reps', 'reach_weight', 'reach_reps', 'reach_pace', 'reach_distance'];

async function create(req, res) {
  try {
    const { title, type, exercise, targetValue, startDate, endDate, visibility } = req.body;
    if (!title || !type || !startDate || !endDate)
      return res.status(400).json({ error: 'title, type, startDate, endDate required' });
    if (NEEDS_EXERCISE.includes(type) && !exercise)
      return res.status(400).json({ error: 'exercise required for this challenge type' });
    const id = await createChallenge(req.userId, { title, type, exercise, targetValue, startDate, endDate, visibility });
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function list(req, res) {
  try {
    res.json(await listChallenges(req.userId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function join(req, res) {
  try {
    await joinChallenge(req.params.id, req.userId);
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Server error' });
  }
}

async function remove(req, res) {
  try {
    await deleteChallenge(req.params.id, req.userId);
    res.json({ success: true });
  } catch (err) {
    if (!err.status) console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Server error' });
  }
}

async function progress(req, res) {
  try {
    const result = await getChallengeProgress(req.params.id, req.userId);
    if (!result) return res.status(404).json({ error: 'Not found' });
    if (result.forbidden) return res.status(403).json({ error: 'Not visible to you' });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { create, list, join, remove, progress };
