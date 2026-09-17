const path = require('path');
const fs   = require('fs');
const { savePhoto, getPhotos, getPhotosForWorkout, deletePhoto, updateTags } = require('../models/photo.model');
const UPLOADS_DIR = require('../config/uploadsDir');

async function upload(req, res) {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'No file uploaded' });
    const { photoDate, workoutId } = req.body;
    if (!photoDate) return res.status(400).json({ error: 'photoDate required' });
    let tags = null;
    if (req.body.tags) {
      try { tags = JSON.parse(req.body.tags); } catch { tags = String(req.body.tags).split(',').map(t => t.trim()).filter(Boolean); }
    }

    const saved = [];
    for (const file of files) {
      const filePath = `/uploads/${file.filename}`;
      const id = await savePhoto({ userId: req.userId, filePath, photoDate, workoutId: workoutId || null, tags });
      saved.push({ id, filePath, photoDate, workoutId: workoutId || null, tags });
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
