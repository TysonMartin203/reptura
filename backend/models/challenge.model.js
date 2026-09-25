const pool = require('../config/db');
const { areFriends } = require('./friend.model');
const { addFeedEvent } = require('./feed.model');

const TYPE_LABELS = {
  most_workouts: 'Most workouts',
  pr_gain: exercise => `Biggest ${exercise} gain`,
  total_volume: 'Most total volume lifted',
  most_distance: exercise => `Most ${exercise || 'cardio'} distance`,
  most_calories: 'Most calories burned',
  most_meals_logged: 'Most meals logged',
  bodyweight_reps: exercise => `Most ${exercise} reps in one set`,
  reach_weight: exercise => `Reach a target ${exercise} weight`,
  reach_reps: exercise => `Reach a target ${exercise} rep count`,
  reach_pace: exercise => `Reach a target ${exercise} pace`,
  reach_distance: exercise => `Reach a target ${exercise || 'cardio'} distance in one outing`,
};

function labelFor(type, exercise) {
  const l = TYPE_LABELS[type];
  return typeof l === 'function' ? l(exercise) : l || type;
}

async function createChallenge(userId, { title, type, exercise, targetValue, startDate, endDate, visibility }) {
  const needsExercise = ['pr_gain', 'most_distance', 'bodyweight_reps', 'reach_weight', 'reach_reps', 'reach_pace', 'reach_distance'].includes(type);
  const [result] = await pool.query(
    `INSERT INTO Challenges (creator_id, title, type, exercise, target_value, start_date, end_date, visibility)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, title, type, needsExercise ? exercise : null, targetValue || null, startDate, endDate, visibility === 'personal' ? 'personal' : 'public']
  );
  const id = result.insertId;
  await pool.query('INSERT INTO ChallengeParticipants (challenge_id, user_id) VALUES (?, ?)', [id, userId]);
  // Personal goals are private — no point announcing them on the feed.
  if (visibility !== 'personal') {
    addFeedEvent({
      userId, type: 'challenge', refId: id,
      headline: `started a challenge — ${title}`,
      detail: labelFor(type, exercise),
    }).catch(err => console.error('Feed event failed:', err));
  }
  return id;
}

// Visible = created by you, joined by you, or created by a friend — personal
// challenges are excluded from the friend-visible part entirely, so they never
// show up for anyone but their creator.
async function listChallenges(userId) {
  const [rows] = await pool.query(
    `SELECT DISTINCT c.*, u.username AS creator_username,
            EXISTS(SELECT 1 FROM ChallengeParticipants p WHERE p.challenge_id = c.id AND p.user_id = ?) AS joined
     FROM Challenges c
     JOIN Users u ON u.id = c.creator_id
     LEFT JOIN ChallengeParticipants cp ON cp.challenge_id = c.id AND cp.user_id = ?
     LEFT JOIN Friends f ON (
       (f.requester_id = ? AND f.receiver_id = c.creator_id) OR
       (f.receiver_id = ? AND f.requester_id = c.creator_id)
     ) AND f.status = 'accepted'
     WHERE c.creator_id = ? OR (c.visibility = 'public' AND (cp.user_id IS NOT NULL OR f.status = 'accepted'))
     ORDER BY c.end_date ASC`,
    [userId, userId, userId, userId, userId]
  );
  return rows;
}

async function joinChallenge(challengeId, userId) {
  const [[challenge]] = await pool.query('SELECT * FROM Challenges WHERE id = ?', [challengeId]);
  if (!challenge) throw Object.assign(new Error('Not found'), { status: 404 });
  const friends = await areFriends(userId, challenge.creator_id);
  if (!friends && challenge.creator_id !== userId)
    throw Object.assign(new Error('You can only join challenges from friends'), { status: 403 });
  await pool.query('INSERT IGNORE INTO ChallengeParticipants (challenge_id, user_id) VALUES (?, ?)', [challengeId, userId]);
  if (userId !== challenge.creator_id) {
    addFeedEvent({
      userId, type: 'challenge', refId: challengeId,
      headline: `joined a challenge — ${challenge.title}`,
      detail: labelFor(challenge.type, challenge.exercise),
    }).catch(err => console.error('Feed event failed:', err));
  }
}

// Only the creator can delete a challenge. ChallengeParticipants cascades off
// the foreign key, but feed posts point at the challenge by ref_id with no FK,
// so they'd be left behind pointing at nothing — clear them explicitly (their
// reactions cascade from FeedEvents).
async function deleteChallenge(challengeId, userId) {
  const [[challenge]] = await pool.query('SELECT creator_id FROM Challenges WHERE id = ?', [challengeId]);
  if (!challenge) throw Object.assign(new Error('Not found'), { status: 404 });
  if (challenge.creator_id !== userId)
    throw Object.assign(new Error('Only the person who created this challenge can delete it'), { status: 403 });

  await pool.query("DELETE FROM FeedEvents WHERE type = 'challenge' AND ref_id = ?", [challengeId]);
  await pool.query('DELETE FROM Challenges WHERE id = ?', [challengeId]);
}

// Per-participant progress for a single challenge, scoped to its date window.
async function getChallengeProgress(challengeId, userId) {
  const [[challenge]] = await pool.query('SELECT * FROM Challenges WHERE id = ?', [challengeId]);
  if (!challenge) return null;

  const [participants] = await pool.query(
    `SELECT u.id, u.username FROM ChallengeParticipants cp JOIN Users u ON u.id = cp.user_id WHERE cp.challenge_id = ?`,
    [challengeId]
  );
  const isParticipant = participants.some(p => p.id === userId);
  if (!isParticipant) {
    const friends = await areFriends(userId, challenge.creator_id);
    if (!friends && challenge.creator_id !== userId) return { forbidden: true };
  }

  const { type, exercise, start_date: start, end_date: end } = challenge;
  let unit = '';
  const leaderboard = await Promise.all(participants.map(async (p) => {
    let progress = 0;
    if (type === 'most_workouts') {
      const [[r]] = await pool.query('SELECT COUNT(*) AS n FROM Workouts WHERE user_id=? AND date BETWEEN ? AND ?', [p.id, start, end]);
      progress = r.n; unit = 'workouts';
    } else if (type === 'total_volume') {
      const [[r]] = await pool.query(
        `SELECT COALESCE(SUM(CASE WHEN we.per_set_weights=1 THEN (
           SELECT COALESCE(SUM(COALESCE(ws.reps,0)*COALESCE(ws.weight,0)),0) FROM WorkoutSets ws WHERE ws.workout_exercise_id=we.id
         ) ELSE COALESCE(we.sets,0)*COALESCE(we.reps,0)*COALESCE(we.weight,0) END),0) AS v
         FROM WorkoutExercises we JOIN Workouts w ON w.id=we.workout_id
         WHERE w.user_id=? AND we.category='lifting' AND w.date BETWEEN ? AND ?`,
        [p.id, start, end]
      );
      progress = Number(r.v) || 0; unit = 'lbs';
    } else if (type === 'most_distance') {
      const [[r]] = await pool.query(
        `SELECT COALESCE(SUM(CASE we.distance_unit
            WHEN 'km' THEN we.distance*0.621371 WHEN 'm' THEN we.distance*0.000621371
            WHEN 'yd' THEN we.distance*0.000568182 WHEN 'mi' THEN we.distance ELSE 0 END),0) AS miles
         FROM WorkoutExercises we JOIN Workouts w ON w.id=we.workout_id
         WHERE w.user_id=? AND we.category='cardio' AND we.exercise_name=? AND w.date BETWEEN ? AND ?`,
        [p.id, exercise, start, end]
      );
      progress = Math.round((Number(r.miles) || 0) * 100) / 100; unit = 'mi';
    } else if (type === 'most_calories') {
      const [[r]] = await pool.query(
        `SELECT COALESCE(SUM(we.calories),0) AS c FROM WorkoutExercises we JOIN Workouts w ON w.id=we.workout_id
         WHERE w.user_id=? AND we.category='cardio' AND w.date BETWEEN ? AND ?`,
        [p.id, start, end]
      );
      progress = Number(r.c) || 0; unit = 'cal';
    } else if (type === 'most_meals_logged') {
      const [[r]] = await pool.query('SELECT COUNT(*) AS n FROM LoggedMeals WHERE user_id=? AND date BETWEEN ? AND ?', [p.id, start, end]);
      progress = r.n; unit = 'meals';
    } else if (type === 'bodyweight_reps') {
      const [[r]] = await pool.query(
        `SELECT MAX(GREATEST(COALESCE(we.reps,0), COALESCE((
            SELECT MAX(ws.reps) FROM WorkoutSets ws WHERE ws.workout_exercise_id=we.id
          ),0))) AS reps
         FROM WorkoutExercises we JOIN Workouts w ON w.id=we.workout_id
         WHERE w.user_id=? AND we.exercise_name=? AND we.category='lifting' AND w.date BETWEEN ? AND ?`,
        [p.id, exercise, start, end]
      );
      progress = Number(r.reps) || 0; unit = 'reps';
    } else if (type === 'pr_gain') {
      const [[baseline]] = await pool.query(
        `SELECT MAX(GREATEST(COALESCE(we.weight,0), COALESCE((
            SELECT MAX(ws.weight) FROM WorkoutSets ws WHERE ws.workout_exercise_id = we.id
          ),0))) AS w
         FROM WorkoutExercises we JOIN Workouts w ON w.id = we.workout_id
         WHERE w.user_id = ? AND we.exercise_name = ? AND we.category = 'lifting' AND w.date < ?`,
        [p.id, exercise, start]
      );
      const [[peak]] = await pool.query(
        `SELECT MAX(GREATEST(COALESCE(we.weight,0), COALESCE((
            SELECT MAX(ws.weight) FROM WorkoutSets ws WHERE ws.workout_exercise_id = we.id
          ),0))) AS w
         FROM WorkoutExercises we JOIN Workouts w ON w.id = we.workout_id
         WHERE w.user_id = ? AND we.exercise_name = ? AND we.category = 'lifting' AND w.date BETWEEN ? AND ?`,
        [p.id, exercise, start, end]
      );
      const base = Number(baseline.w) || 0, peakW = Number(peak.w) || 0;
      progress = Math.max(0, peakW - base); unit = 'lbs gained';
    } else if (type === 'reach_weight') {
      const [[r]] = await pool.query(
        `SELECT MAX(GREATEST(COALESCE(we.weight,0), COALESCE((
            SELECT MAX(ws.weight) FROM WorkoutSets ws WHERE ws.workout_exercise_id = we.id
          ),0))) AS w
         FROM WorkoutExercises we JOIN Workouts w ON w.id = we.workout_id
         WHERE w.user_id = ? AND we.exercise_name = ? AND we.category = 'lifting' AND w.date BETWEEN ? AND ?`,
        [p.id, exercise, start, end]
      );
      progress = Number(r.w) || 0; unit = 'lbs';
    } else if (type === 'reach_reps') {
      const [[r]] = await pool.query(
        `SELECT MAX(GREATEST(COALESCE(we.reps,0), COALESCE((
            SELECT MAX(ws.reps) FROM WorkoutSets ws WHERE ws.workout_exercise_id=we.id
          ),0))) AS reps
         FROM WorkoutExercises we JOIN Workouts w ON w.id=we.workout_id
         WHERE w.user_id=? AND we.exercise_name=? AND we.category='lifting' AND w.date BETWEEN ? AND ?`,
        [p.id, exercise, start, end]
      );
      progress = Number(r.reps) || 0; unit = 'reps';
    } else if (type === 'reach_distance') {
      const [[r]] = await pool.query(
        `SELECT MAX(CASE we.distance_unit
            WHEN 'km' THEN we.distance*0.621371 WHEN 'm' THEN we.distance*0.000621371
            WHEN 'yd' THEN we.distance*0.000568182 WHEN 'mi' THEN we.distance ELSE 0 END) AS miles
         FROM WorkoutExercises we JOIN Workouts w ON w.id=we.workout_id
         WHERE w.user_id=? AND we.category='cardio' AND we.exercise_name=? AND w.date BETWEEN ? AND ?`,
        [p.id, exercise, start, end]
      );
      progress = Math.round((Number(r.miles) || 0) * 100) / 100; unit = 'mi (best single outing)';
    } else if (type === 'reach_pace') {
      // Lower is better here — best (fastest) seconds-per-mile pace achieved
      // in a single session. null means no qualifying session yet, so it
      // never looks like a (falsely impressive) instant 0-second mile.
      const [[r]] = await pool.query(
        `SELECT MIN(we.duration_minutes*60 / (CASE we.distance_unit
            WHEN 'km' THEN we.distance*0.621371 WHEN 'm' THEN we.distance*0.000621371
            WHEN 'yd' THEN we.distance*0.000568182 WHEN 'mi' THEN we.distance ELSE NULL END)) AS best_pace
         FROM WorkoutExercises we JOIN Workouts w ON w.id=we.workout_id
         WHERE w.user_id=? AND we.category='cardio' AND we.exercise_name=? AND w.date BETWEEN ? AND ?
           AND we.duration_minutes IS NOT NULL AND we.distance IS NOT NULL AND we.distance > 0`,
        [p.id, exercise, start, end]
      );
      progress = r.best_pace != null ? Math.round(Number(r.best_pace)) : null; unit = 'sec/mi (best pace)';
    }
    return { id: p.id, username: p.username, progress };
  }));

  const target = Number(challenge.target_value) || null;
  const lowerIsBetter = type === 'reach_pace';
  leaderboard.forEach(entry => {
    entry.reached = target != null && entry.progress != null
      ? (lowerIsBetter ? entry.progress <= target : entry.progress >= target)
      : false;
  });
  leaderboard.sort((a, b) => {
    if (a.progress == null) return 1;
    if (b.progress == null) return -1;
    return lowerIsBetter ? a.progress - b.progress : b.progress - a.progress;
  });
  return { ...challenge, unit, leaderboard };
}

module.exports = { createChallenge, listChallenges, joinChallenge, deleteChallenge, getChallengeProgress };
