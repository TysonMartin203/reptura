const pool = require('../config/db');
const Anthropic = require('@anthropic-ai/sdk');
const TEMPLATES = require('../data/workout-plan-templates');
const { createNotification } = require('../models/notification.model');
const { sendPushToUser } = require('../models/push.model');
const { findById } = require('../models/user.model');
const { buildStatsBlock } = require('../data/prompt-helpers');
const { areFriends } = require('../models/friend.model');
const { EXERCISE_DESCRIPTIONS } = require('../data/exercise-descriptions');
const { reorderExercisesByMuscleGroup } = require('../data/muscleGroups');

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

// ── Templates (read-only source material) ──
async function getTemplates(req, res) {
  res.json(TEMPLATES.map(t => ({ id: t.id, name: t.name, description: t.description, category: t.category, icon: t.icon, format: t.format })));
}

async function useTemplate(req, res) {
  try {
    const t = TEMPLATES.find(x => x.id === req.params.id);
    if (!t) return res.status(404).json({ error: 'Not found' });
    const name = req.body?.name || t.name;

    const [result] = await pool.query(
      'INSERT INTO WorkoutPlans (user_id, name, plan) VALUES (?, ?, ?)',
      [req.userId, name, JSON.stringify({ ...t.plan, format: t.format })]
    );
    res.json({ planId: result.insertId, plan: t.plan, planName: name, format: t.format });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── Saved plans CRUD ──
async function listPlans(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, is_favorite, shared_from_username, created_at FROM WorkoutPlans WHERE user_id = ? ORDER BY is_favorite DESC, created_at DESC',
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function getPlan(req, res) {
  try {
    const [[row]] = await pool.query('SELECT * FROM WorkoutPlans WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ plan: row.plan, name: row.name, is_favorite: row.is_favorite, shared_from_username: row.shared_from_username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function renamePlan(req, res) {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    await pool.query('UPDATE WorkoutPlans SET name = ? WHERE id = ? AND user_id = ?', [name.trim(), req.params.id, req.userId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function toggleFavorite(req, res) {
  try {
    const [[row]] = await pool.query('SELECT is_favorite FROM WorkoutPlans WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const next = row.is_favorite ? 0 : 1;
    await pool.query('UPDATE WorkoutPlans SET is_favorite = ? WHERE id = ?', [next, req.params.id]);
    res.json({ is_favorite: next });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function deletePlan(req, res) {
  try {
    const [result] = await pool.query('DELETE FROM WorkoutPlans WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function sharePlan(req, res) {
  try {
    const { friendId } = req.body;
    if (!friendId) return res.status(400).json({ error: 'friendId required' });

    const friends = await areFriends(req.userId, friendId);
    if (!friends) return res.status(403).json({ error: 'Not friends' });

    const [[plan]] = await pool.query('SELECT * FROM WorkoutPlans WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const sender = await findById(req.userId);
    const [result] = await pool.query(
      `INSERT INTO WorkoutPlans (user_id, name, plan, shared_from_user_id, shared_from_username)
       VALUES (?, ?, ?, ?, ?)`,
      [friendId, plan.name, JSON.stringify(plan.plan), req.userId, sender?.username || null]
    );

    await createNotification({
      userId: friendId, type: 'workout_plan_share',
      title: `${sender?.username || 'A friend'} shared a workout plan with you`,
      body: plan.name,
      data: { planId: result.insertId },
    });
    await sendPushToUser(friendId, {
      title: 'New shared workout plan',
      body: `${sender?.username || 'A friend'} sent you "${plan.name}"`,
      data: { type: 'workout_plan_share', planId: result.insertId },
    });

    res.status(201).json({ success: true, planId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── AI generation, built from the shared profile ──
async function generate(req, res) {
  try {
    const client = getClient();
    const { weight, goalWeight, goal, timeline, activityLevel = '', notes = '', planName = 'My Workout Plan', scope = 'week' } = req.body;

    const [prs] = await pool.query('SELECT exercise, max_weight FROM PRs WHERE user_id = ? LIMIT 8', [req.userId]);
    const prText = prs.length > 0 ? prs.map(p => `${p.exercise}: ${p.max_weight}lbs`).join(', ') : 'Not provided';

    if (scope === 'day') {
      const prompt = `You are a certified strength coach. Build ONE well-structured workout session as JSON, tailored to this person.

User stats:
${buildStatsBlock(req.body, { prs: prText })}

Pick a sensible focus for a single session (e.g. Push, Pull, Legs, Full Body, or whatever the notes suggest). If notes mention an injury or limitation, avoid exercises that would aggravate it. For each exercise give sets and a rep range as a string (e.g. "8-10"). Use common gym exercise names.

Order exercises like a real trainer would: big compound lifts first while fresh, isolation moves last. Never place an isolation exercise for a muscle before a compound exercise that already works that same muscle hard. Don't cluster two same-muscle isolation exercises back to back.

Return ONLY valid JSON, no markdown:
{
  "focus": "e.g. Push Day",
  "exercises": [
    { "category": "lifting", "exerciseName": "Bench Press", "sets": 4, "reps": "6-8", "notes": "" }
  ]
}`;

      const message = await client.messages.create({
        model: 'claude-sonnet-4-6', max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      });
      let text = message.content[0].text.trim();
      text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
      const workout = JSON.parse(text);
      // Guaranteed-correct exercise ordering regardless of what the AI produced —
      // same exercises, just spaced so the same muscle isn't hit twice in a row.
      workout.exercises = reorderExercisesByMuscleGroup(workout.exercises);
      return res.json({ workout });
    }

    const prompt = `You are a certified strength coach. Build a 7-day weekly workout split as JSON, tailored to this person.

User stats:
${buildStatsBlock(req.body, { prs: prText })}

Choose a sensible split (e.g. Push/Pull/Legs, Upper/Lower, Full Body, or a bro split) based on their goal. If the notes mention an injury or limitation, avoid exercises that would aggravate it. Include rest days appropriately — this is a full week, so not every day should be a training day. For each exercise give sets and a rep range as a string (e.g. "8-10"). Use common gym exercise names.

Order each day's exercises like a real trainer would program them: big compound lifts first while fresh, isolation moves last. Never put an isolation exercise for a muscle before a compound exercise that also heavily works that same muscle (e.g. don't put a tricep isolation move before Dips or Close-Grip Bench, since those already train triceps hard). When a day has more than one isolation exercise, don't cluster two exercises for the identical muscle back to back — alternate muscles when the split allows it (e.g. alternate biceps and triceps in an arm day, rather than all biceps then all triceps).

Return ONLY valid JSON, no markdown. Structure:
{
  "split_type": "e.g. Push Pull Legs",
  "days_per_week": number,
  "days": [
    { "day": "Monday", "type": "workout", "focus": "Push", "exercises": [
      { "category": "lifting", "exerciseName": "Bench Press", "sets": 4, "reps": "6-8", "notes": "" }
    ]},
    { "day": "Sunday", "type": "rest" }
  ]
}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    });

    let text = message.content[0].text.trim();
    text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    const plan = JSON.parse(text);
    if (Array.isArray(plan.days)) {
      plan.days.forEach(day => {
        if (Array.isArray(day.exercises)) day.exercises = reorderExercisesByMuscleGroup(day.exercises);
      });
    }

    const [result] = await pool.query(
      'INSERT INTO WorkoutPlans (user_id, name, plan) VALUES (?, ?, ?)',
      [req.userId, planName, JSON.stringify({ ...plan, format: 'week' })]
    );

    res.json({ planId: result.insertId, plan, planName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
}

async function regenerate(req, res) {
  try {
    const client = getClient();
    const { weight, goalWeight, goal, timeline, activityLevel = '', notes = '' } = req.body;

    const [[existing]] = await pool.query('SELECT * FROM WorkoutPlans WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!existing) return res.status(404).json({ error: 'Plan not found' });

    const [prs] = await pool.query('SELECT exercise, max_weight FROM PRs WHERE user_id = ? LIMIT 8', [req.userId]);
    const prText = prs.length > 0 ? prs.map(p => `${p.exercise}: ${p.max_weight}lbs`).join(', ') : 'Not provided';

    const prompt = `You are a certified strength coach. The user already has a workout plan called "${existing.name}" but wants it rebuilt based on updated info. Build a fresh 7-day weekly workout split as JSON.

Updated user stats:
${buildStatsBlock(req.body, { prs: prText })}

Choose a sensible split based on their goal. If the notes mention an injury or limitation, avoid exercises that would aggravate it. Include rest days appropriately. For each exercise give sets and a rep range as a string (e.g. "8-10"). Use common gym exercise names.

Order each day's exercises like a real trainer would: big compound lifts first while fresh, isolation moves last, and never an isolation move for a muscle placed before a compound that already works that same muscle hard. Don't cluster two same-muscle isolation exercises back to back — alternate muscles where the split allows it.

Return ONLY valid JSON, no markdown. Same structure as before:
{
  "split_type": "e.g. Push Pull Legs",
  "days_per_week": number,
  "days": [
    { "day": "Monday", "type": "workout", "focus": "Push", "exercises": [
      { "category": "lifting", "exerciseName": "Bench Press", "sets": 4, "reps": "6-8", "notes": "" }
    ]},
    { "day": "Sunday", "type": "rest" }
  ]
}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    });

    let text = message.content[0].text.trim();
    text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    const plan = JSON.parse(text);
    if (Array.isArray(plan.days)) {
      plan.days.forEach(day => {
        if (Array.isArray(day.exercises)) day.exercises = reorderExercisesByMuscleGroup(day.exercises);
      });
    }

    await pool.query('UPDATE WorkoutPlans SET plan = ? WHERE id = ?', [JSON.stringify({ ...plan, format: 'week' }), req.params.id]);

    res.json({ planId: Number(req.params.id), plan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
}

// ── Swap a single exercise, with a reason (mirrors the meal-swap flow) ──
async function swapExercise(req, res) {
  try {
    const client = getClient();
    const { exerciseName, category = 'lifting', sets, reps, reason, detail, planId, dayIdx, exIdx } = req.body;

    let reasonText = '';
    if (reason === 'restriction' && detail) {
      reasonText = `The replacement must avoid: ${detail} (e.g. an injury or lack of equipment) — do not suggest anything involving that.`;
    } else if (reason === 'dislike') {
      reasonText = detail
        ? `They don't want this exercise because: ${detail}. Pick something meaningfully different that targets the same area.`
        : `They just don't want this specific exercise — pick something meaningfully different that targets the same muscles.`;
    }

    const prompt = `Suggest one alternative ${category} exercise to replace "${exerciseName}" that trains the same muscle group(s) or purpose.
${reasonText}
Keep the same rough sets/rep range: ${sets || '?'} sets of ${reps || '?'}.
Return ONLY JSON with just these fields, nothing else: { "exerciseName": "...", "sets": ${sets || 3}, "reps": "${reps || '8-12'}" }`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    let text = message.content[0].text.trim();
    text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    const suggestion = JSON.parse(text);
    const exercise = { category, exerciseName: suggestion.exerciseName, sets: suggestion.sets, reps: suggestion.reps, notes: '' };

    // Persist to the saved plan, if this swap came from one, so it sticks around.
    if (planId != null && exIdx != null) {
      const [[row]] = await pool.query('SELECT * FROM WorkoutPlans WHERE id = ? AND user_id = ?', [planId, req.userId]);
      if (row) {
        const plan = typeof row.plan === 'string' ? JSON.parse(row.plan) : row.plan;
        if (dayIdx != null && plan.days) {
          plan.days[dayIdx].exercises[exIdx] = exercise;
        } else if (plan.exercises) {
          plan.exercises[exIdx] = exercise;
        }
        await pool.query('UPDATE WorkoutPlans SET plan = ? WHERE id = ?', [JSON.stringify(plan), planId]);
      }
    }

    res.json({ exercise });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
}

// ── Directly edit an exercise's name/sets/reps — no AI, just a manual change ──
async function editExercise(req, res) {
  try {
    const { exerciseName, sets, reps, category = 'lifting', planId, dayIdx, exIdx } = req.body;
    if (!exerciseName?.trim()) return res.status(400).json({ error: 'exerciseName required' });
    if (planId == null || exIdx == null) return res.status(400).json({ error: 'planId and exIdx required' });

    const [[row]] = await pool.query('SELECT * FROM WorkoutPlans WHERE id = ? AND user_id = ?', [planId, req.userId]);
    if (!row) return res.status(404).json({ error: 'Plan not found' });

    const plan = typeof row.plan === 'string' ? JSON.parse(row.plan) : row.plan;
    const exercise = { category, exerciseName: exerciseName.trim(), sets: sets || undefined, reps: reps || undefined, notes: '' };

    if (dayIdx != null && plan.days) {
      exercise.notes = plan.days[dayIdx].exercises[exIdx]?.notes || '';
      plan.days[dayIdx].exercises[exIdx] = exercise;
    } else if (plan.exercises) {
      exercise.notes = plan.exercises[exIdx]?.notes || '';
      plan.exercises[exIdx] = exercise;
    } else {
      return res.status(400).json({ error: 'Could not locate that exercise in the plan' });
    }

    await pool.query('UPDATE WorkoutPlans SET plan = ? WHERE id = ?', [JSON.stringify(plan), planId]);
    res.json({ exercise });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
}

// ── Short AI explanation of a single exercise (how to perform, what it targets) ──
async function exerciseInfo(req, res) {
  try {
    const { exerciseName, category = 'lifting' } = req.body;
    if (!exerciseName) return res.status(400).json({ error: 'exerciseName required' });

    if (EXERCISE_DESCRIPTIONS[exerciseName]) {
      return res.json({ info: EXERCISE_DESCRIPTIONS[exerciseName] });
    }

    const client = getClient();
    const prompt = `In 2-3 short sentences, explain the ${category} exercise "${exerciseName}": what it targets and a quick form cue. No markdown, no headers, plain text only.`;
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });
    res.json({ info: message.content[0].text.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
}

// ── Build a plan entirely by hand, no AI ──
async function createCustom(req, res) {
  try {
    const { name, plan } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Plan name required' });
    if (plan?.format === 'week') {
      if (!Array.isArray(plan.days) || !plan.days.some(d => d.type === 'workout' && d.exercises?.length))
        return res.status(400).json({ error: 'Add at least one exercise to at least one day' });
    } else {
      if (!Array.isArray(plan?.exercises) || plan.exercises.length === 0)
        return res.status(400).json({ error: 'Add at least one exercise' });
    }
    const [result] = await pool.query(
      'INSERT INTO WorkoutPlans (user_id, name, plan) VALUES (?, ?, ?)',
      [req.userId, name.trim(), JSON.stringify(plan)]
    );
    res.status(201).json({ planId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = {
  getTemplates, useTemplate,
  listPlans, getPlan, renamePlan, toggleFavorite, deletePlan, sharePlan,
  generate, regenerate, swapExercise, editExercise, exerciseInfo, createCustom,
};
