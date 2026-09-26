const path = require('path');
const fs   = require('fs');
const { savePhoto, getPhotos, getPhotosForWorkout, deletePhoto, updateTags } = require('../models/photo.model');
const UPLOADS_DIR = require('../config/uploadsDir');

// Tags arrive as a JSON array, a comma-separated string, or nothing at all.
// Returns null rather than [] for "no tags" so existing rows keep their shape.
function normalizeTags(value) {
  if (value == null || value === '') return null;
  let out = value;
  if (typeof out === 'string') {
    try { out = JSON.parse(out); } catch { out = out.split(','); }
  }
  if (!Array.isArray(out)) return null;
  const cleaned = out.map(t => String(t).trim()).filter(Boolean);
  return cleaned.length ? cleaned : null;
}

async function upload(req, res) {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'No file uploaded' });
    const { photoDate, workoutId } = req.body;
    if (!photoDate) return res.status(400).json({ error: 'photoDate required' });
    // Tags shared by every photo in the batch (the older shape).
    let tags = normalizeTags(req.body.tags);

    // Per-photo tags: an array of tag-lists, index-aligned with the uploaded
    // files, so one batch can mix "Back & Biceps" with "Triceps". Falls back to
    // the shared `tags` above when absent, keeping older callers working.
    let tagsPerFile = null;
    if (req.body.tagsPerFile) {
      try {
        const parsed = JSON.parse(req.body.tagsPerFile);
        if (Array.isArray(parsed)) tagsPerFile = parsed;
      } catch { /* malformed — fall back to the shared tags */ }
    }

    const saved = [];
    for (let i = 0; i < files.length; i++) {
      const filePath = `/uploads/${files[i].filename}`;
      const fileTags = tagsPerFile ? normalizeTags(tagsPerFile[i]) : tags;
      const id = await savePhoto({ userId: req.userId, filePath, photoDate, workoutId: workoutId || null, tags: fileTags });
      saved.push({ id, filePath, photoDate, workoutId: workoutId || null, tags: fileTags });
    }
    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function list(req, res) {
  try {
    const photos = await getPhotos(req.userId);
    res.json(photos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function listForWorkout(req, res) {
  try {
    const photos = await getPhotosForWorkout(req.params.workoutId, req.userId);
    res.json(photos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function remove(req, res) {
  try {
    const filePath = await deletePhoto(req.params.id, req.userId);
    if (!filePath) return res.status(404).json({ error: 'Not found' });
    const abs = path.join(UPLOADS_DIR, filePath.split('/').pop());
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function updateTagsHandler(req, res) {
  try {
    let tags = req.body.tags;
    if (typeof tags === 'string') {
      try { tags = JSON.parse(tags); } catch { tags = tags.split(',').map(t => t.trim()).filter(Boolean); }
    }
    if (!Array.isArray(tags)) tags = [];
    const ok = await updateTags(req.params.id, req.userId, tags);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, tags });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { upload, list, listForWorkout, remove, updateTagsHandler };
