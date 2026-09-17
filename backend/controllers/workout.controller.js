const fs = require('fs');
const path = require('path');
const { savePhoto } = require('../models/photo.model');
const pool = require('../config/db');
const UPLOADS_DIR = require('../config/uploadsDir');
const Anthropic = require('@anthropic-ai/sdk');
const {
  createWorkout, updateWorkout, getWorkouts, getWorkoutById, getWorkoutForViewing,
  deleteWorkout, deleteWorkoutPhoto,
} = require('../models/workout.model');

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    // Raise the SDK's default retry ceiling (2) for 429/5xx and cap how
    // long a single call can hang, so bursts of concurrent users don't
    // fail fast under load.
    maxRetries: 4,
    timeout: 30_000,
  });
}

function parsePayload(req) {
  // Body arrives as multipart/form-data with a JSON "data" field
  // (plus an optional "photo" file), so both create and edit can attach a photo.
  const raw = req.body.data;
  if (!raw) throw Object.assign(new Error('Missing workout data'), { status: 400 });
  const data = JSON.parse(raw);
  if (!data.date) throw Object.assign(new Error('Date is required'), { status: 400 });
  if (!Array.isArray(data.exercises) || data.exercises.length === 0)
    throw Object.assign(new Error('At least one exercise is required'), { status: 400 });
  for (const ex of data.exercises) {
    if (!ex.exerciseName || !ex.category)
      throw Object.assign(new Error('Each exercise needs a name and category'), { status: 400 });
  }
  return data;
}

async function create(req, res) {
  try {
    const data = parsePayload(req);
    const photoPath = req.file ? `/uploads/${req.file.filename}` : null;

    const result = await createWorkout({
      userId: req.userId,
      name: data.name,
      date: data.date,
      notesBefore: data.notesBefore,
      notesAfter: data.notesAfter,
      photoPath,
      exercises: data.exercises,
    });

    if (photoPath) {
      await savePhoto({ userId: req.userId, filePath: photoPath, photoDate: data.date, workoutId: result.workoutId });
    }

    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Server error' });
  }
}

async function update(req, res) {
  try {
    const data = parsePayload(req);
    const photoPath = req.file ? `/uploads/${req.file.filename}` : undefined;

    const result = await updateWorkout(req.params.id, req.userId, {
      name: data.name,
      date: data.date,
      notesBefore: data.notesBefore,
      notesAfter: data.notesAfter,
      photoPath,
      exercises: data.exercises,
    });
    if (!result) return res.status(404).json({ error: 'Not found' });

    if (photoPath) {
      await savePhoto({ userId: req.userId, filePath: photoPath, photoDate: data.date, workoutId: result.workoutId });
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Server error' });
  }
}

async function list(req, res) {
  try {
    const workouts = await getWorkouts(req.userId);
    res.json(workouts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function getOne(req, res) {
  try {
    const workout = await getWorkoutById(req.params.id, req.userId);
    if (!workout) return res.status(404).json({ error: 'Not found' });
    res.json(workout);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// Friend-safe read-only view — used from the Feed. Never includes the photo.
async function getView(req, res) {
  try {
    const workout = await getWorkoutForViewing(req.params.id, req.userId);
    if (!workout) return res.status(404).json({ error: 'Not found' });
    if (workout.forbidden) return res.status(403).json({ error: 'Not friends with this user' });
    res.json(workout);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// Remove a workout's photo. `keep=true` leaves it in Progress Photos (just
// unlinks it from this workout); `keep=false` deletes it entirely, file included.
async function removePhoto(req, res) {
  try {
    const keep = req.query.keep === 'true';
    const oldPath = await deleteWorkoutPhoto(req.params.id, req.userId);
    if (oldPath === null) return res.status(404).json({ error: 'Not found' });
    if (!oldPath) return res.json({ success: true }); // no photo was attached anyway

    const [[photoRow]] = await pool.query(
      'SELECT id FROM ProgressPhotos WHERE user_id = ? AND file_path = ? AND workout_id = ?',
      [req.userId, oldPath, req.params.id]
    );

    if (keep) {
      if (photoRow) await pool.query('UPDATE ProgressPhotos SET workout_id = NULL WHERE id = ?', [photoRow.id]);
    } else {
      if (photoRow) await pool.query('DELETE FROM ProgressPhotos WHERE id = ?', [photoRow.id]);
      const abs = path.join(UPLOADS_DIR, oldPath.split('/').pop());
      fs.unlink(abs, () => {}); // best-effort; fine if it's already gone
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function remove(req, res) {
  try {
    const deleted = await deleteWorkout(req.params.id, req.userId);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// Parse a spoken description of a workout into one or more structured exercises.
async function parseVoice(req, res) {
  try {
    const { transcript } = req.body;
    if (!transcript?.trim()) return res.status(400).json({ error: 'No transcript provided' });
    const client = getClient();

    const prompt = `The user spoke this description of a workout: "${transcript.trim()}"

Turn it into one or more structured exercise entries. Return ONLY valid JSON, no markdown — an array of objects, each in this exact structure:
{
  "category": "lifting" or "cardio" (lowercase, exactly one of these two words),
  "exerciseName": "e.g. Bench Press for lifting. For cardio, use exactly one of: Running, Biking, Swimming, Walking, Rowing, Elliptical, Stair Climber, Jump Rope, Hiking, HIIT, Other",
  "sets": number or null (lifting only — omit/null if perSets is used instead),
  "reps": number or null (lifting only, use the highest number mentioned if a range was given — note: speech-to-text sometimes mishears 'rep' as 'wrap', treat 'wrap/wraps' as 'rep/reps'),
  "weight": number or null (lifting only, in lbs — omit/null if perSets is used instead),
  "perSets": [{"reps": number, "weight": number}, ...] or null (lifting only — use this INSTEAD of sets/reps/weight when the person describes different reps and/or weight for different sets of the same exercise, e.g. "first set 10 at 135, second set 8 at 155, third set 6 at 175" — one array entry per set, in the order mentioned),
  "durationMinutes": number or null (cardio only),
  "distance": number or null (cardio only),
  "distanceUnit": "mi" or "km" or null (cardio only)
}

If the person describes multiple exercises, return one object per exercise, in the order mentioned. If a detail wasn't mentioned, use null for it rather than guessing. Classify running/walking/biking/swimming/rowing/hiking/jump rope/elliptical/stair-climbing/HIIT-style descriptions as "cardio"; classify named strength exercises (bench press, squat, curl, etc.) as "lifting".`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });

    let text = message.content[0].text.trim();
    text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    const result = JSON.parse(text);
    res.json({ exercises: Array.isArray(result) ? result : [result] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not parse that: ' + err.message });
  }
}

module.exports = { create, update, list, getOne, getView, removePhoto, remove, parseVoice };
