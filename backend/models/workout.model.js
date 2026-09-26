const pool = require('../config/db');
const { maybeUpdatePR } = require('./pr.model');
const { maybeUpdateCardioPR } = require('./cardiopr.model');
const { addFeedEvent } = require('./feed.model');
const { areFriends } = require('./friend.model');
const { BODYWEIGHT_EXERCISES } = require('../data/bodyweight-exercises');

function effectiveMaxWeight(ex) {
  if (ex.perSetWeights && Array.isArray(ex.setsData) && ex.setsData.length > 0) {
    const weights = ex.setsData.map(s => Number(s.weight)).filter(w => !isNaN(w));
    return weights.length ? Math.max(...weights) : null;
  }
  return ex.weight != null && ex.weight !== '' ? Number(ex.weight) : null;
}

function effectiveMaxReps(ex) {
  if (ex.perSetWeights && Array.isArray(ex.setsData) && ex.setsData.length > 0) {
    const reps = ex.setsData.map(s => Number(s.reps)).filter(r => !isNaN(r));
    return reps.length ? Math.max(...reps) : null;
  }
  return ex.reps != null && ex.reps !== '' ? Number(ex.reps) : null;
}

async function insertExercises(conn, workoutId, exercises, userId, date) {
  const prResults = [];
  let order = 0;
  for (const ex of exercises) {
    const isLifting = ex.category === 'lifting';
    const [result] = await conn.query(
      `INSERT INTO WorkoutExercises
       (workout_id, category, exercise_name, order_index, notes,
        sets, reps, weight, per_set_weights, bodyweight,
        duration_minutes, distance, distance_unit, calories, avg_heart_rate, pace, intensity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        workoutId, ex.category, ex.exerciseName, order++, ex.notes || null,
        isLifting ? (ex.sets || null) : null,
        isLifting ? (ex.reps || null) : null,
        isLifting ? (ex.weight != null && ex.weight !== '' ? ex.weight : null) : null,
        isLifting && ex.perSetWeights ? 1 : 0,
        isLifting && ex.bodyweight ? 1 : 0,
        !isLifting ? (ex.durationMinutes || null) : null,
        !isLifting ? (ex.distance || null) : null,
        !isLifting ? (ex.distanceUnit || null) : null,
        !isLifting ? (ex.calories || null) : null,
        !isLifting ? (ex.avgHeartRate || null) : null,
        !isLifting ? (ex.pace || null) : null,
        !isLifting ? (ex.intensity || null) : null,
      ]
    );
    const workoutExerciseId = result.insertId;

    if (isLifting && ex.perSetWeights && Array.isArray(ex.setsData)) {
      for (let i = 0; i < ex.setsData.length; i++) {
        const s = ex.setsData[i];
        await conn.query(
          'INSERT INTO WorkoutSets (workout_exercise_id, set_number, reps, weight) VALUES (?, ?, ?, ?)',
          [workoutExerciseId, i + 1, s.reps || null, s.weight != null && s.weight !== '' ? s.weight : null]
        );
      }
    }

    if (isLifting) {
      const maxWeight = effectiveMaxWeight(ex);
      const maxReps = effectiveMaxReps(ex);
      // A PR is "most reps" when the user ticked Bodyweight, or when a
      // known-bodyweight exercise was logged with no weight at all. Anything
      // with weight on the bar stays a weight PR — including weighted
      // pull-ups and dips.
      const repsPR = ex.bodyweight || (maxWeight == null && BODYWEIGHT_EXERCISES.has(ex.exerciseName));
      if (repsPR) {
        if (maxReps != null) {
          const prResult = await maybeUpdatePR({
            userId, exercise: ex.exerciseName, weight: maxReps, date,
            workoutId, workoutExerciseId, conn, unit: 'reps',
          });
          prResults.push({ exercise: ex.exerciseName, unit: 'reps', ...prResult });
        }
      } else if (maxWeight != null) {
        const prResult = await maybeUpdatePR({
          userId, exercise: ex.exerciseName, weight: maxWeight, date,
          workoutId, workoutExerciseId, conn, unit: 'lbs',
        });
        prResults.push({ exercise: ex.exerciseName, unit: 'lbs', ...prResult });
      }
    } else {
      const cardioResult = await maybeUpdateCardioPR({
        userId, activity: ex.exerciseName, distance: ex.distance, distanceUnit: ex.distanceUnit,
        durationMinutes: ex.durationMinutes, date, workoutId, workoutExerciseId, conn,
      });
      if (cardioResult) prResults.push(cardioResult);
    }
  }
  return prResults;
}

async function createWorkout({ userId, name, date, notesBefore, notesAfter, photoPath, exercises }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [wResult] = await conn.query(
      'INSERT INTO Workouts (user_id, name, date, notes_before, notes_after, photo_path) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, name || null, date, notesBefore || null, notesAfter || null, photoPath || null]
    );
    const workoutId = wResult.insertId;
    const prResults = await insertExercises(conn, workoutId, exercises || [], userId, date);
    await conn.commit();

    const exCount = (exercises || []).length;
    const names = (exercises || []).slice(0, 2).map(e => e.exerciseName).join(', ');
    addFeedEvent({
      userId, type: 'workout', refId: workoutId,
      headline: name ? `logged "${name}" — ${exCount} exercise${exCount === 1 ? '' : 's'}` : `logged a workout — ${exCount} exercise${exCount === 1 ? '' : 's'}`,
      detail: names,
    }).catch(err => console.error('Feed event failed:', err));

    return { workoutId, prResults };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function updateWorkout(id, userId, { name, date, notesBefore, notesAfter, photoPath, exercises }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [owned] = await conn.query('SELECT id, photo_path FROM Workouts WHERE id = ? AND user_id = ?', [id, userId]);
    if (!owned[0]) { await conn.rollback(); return null; }

    const finalPhotoPath = photoPath !== undefined ? photoPath : owned[0].photo_path;
    await conn.query(
      'UPDATE Workouts SET name = ?, date = ?, notes_before = ?, notes_after = ?, photo_path = ? WHERE id = ?',
      [name || null, date, notesBefore || null, notesAfter || null, finalPhotoPath, id]
    );
    // Simplest correct approach to edits: replace all exercises for this workout.
    await conn.query('DELETE FROM WorkoutExercises WHERE workout_id = ?', [id]);
    const prResults = await insertExercises(conn, id, exercises || [], userId, date);
    await conn.commit();
    return { workoutId: Number(id), prResults };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getWorkouts(userId) {
  const [rows] = await pool.query(
    `SELECT w.id, w.name, w.date, w.notes_before, w.notes_after, w.photo_path, w.created_at,
            COUNT(we.id) AS exercise_count,
            GROUP_CONCAT(DISTINCT we.category) AS categories,
            SUBSTRING_INDEX(GROUP_CONCAT(we.exercise_name ORDER BY we.order_index), ',', 1) AS first_exercise
     FROM Workouts w
     LEFT JOIN WorkoutExercises we ON we.workout_id = w.id
     WHERE w.user_id = ?
     GROUP BY w.id
     ORDER BY w.date DESC, w.created_at DESC`,
    [userId]
  );
  return rows;
}

async function attachExercises(workout) {
  const [exRows] = await pool.query(
    'SELECT * FROM WorkoutExercises WHERE workout_id = ? ORDER BY order_index ASC, id ASC',
    [workout.id]
  );
  const exerciseIds = exRows.map(e => e.id);
  let setsByExercise = {};
  if (exerciseIds.length) {
    const [setRows] = await pool.query(
      `SELECT * FROM WorkoutSets WHERE workout_exercise_id IN (?) ORDER BY set_number ASC`,
      [exerciseIds]
    );
    setsByExercise = setRows.reduce((acc, s) => {
      (acc[s.workout_exercise_id] = acc[s.workout_exercise_id] || []).push(s);
      return acc;
    }, {});
  }
  workout.exercises = exRows.map(e => ({ ...e, sets_data: setsByExercise[e.id] || [] }));
  return workout;
}

async function getWorkoutById(id, userId) {
  const [wRows] = await pool.query('SELECT * FROM Workouts WHERE id = ? AND user_id = ?', [id, userId]);
  if (!wRows[0]) return null;
  return attachExercises(wRows[0]);
}

// Read-only view for a friend: allowed if owner or friend of owner, but the
// photo is always stripped out regardless of who's asking — feed access to a
// workout was never meant to include the photo.
async function getWorkoutForViewing(id, viewerId) {
  const [wRows] = await pool.query(
    `SELECT w.*, u.username FROM Workouts w JOIN Users u ON u.id = w.user_id WHERE w.id = ?`,
    [id]
  );
  if (!wRows[0]) return null;
  const workout = wRows[0];
  const isOwner = workout.user_id === viewerId;
  if (!isOwner) {
    const friends = await areFriends(viewerId, workout.user_id);
    if (!friends) return { forbidden: true };
  }
  await attachExercises(workout);
  workout.photo_path = null; // never expose the photo through the friend-view path
  workout.is_owner = isOwner;
  if (!isOwner) {
    // Keep the workout and set counts visible, but never the actual weight used —
    // this is meant to stay a self-improvement app, not a place to compare numbers.
    workout.exercises = workout.exercises.map(ex => {
      const { weight, sets_data, ...rest } = ex;
      return { ...rest, sets_data: (sets_data || []).map(s => ({ set_number: s.set_number, reps: s.reps })) };
    });
  }
  return workout;
}

async function deleteWorkoutPhoto(id, userId) {
  const [[row]] = await pool.query('SELECT photo_path FROM Workouts WHERE id = ? AND user_id = ?', [id, userId]);
  if (!row) return null;
  await pool.query('UPDATE Workouts SET photo_path = NULL WHERE id = ?', [id]);
  return row.photo_path;
}

async function deleteWorkout(id, userId) {
  const [result] = await pool.query(
    'DELETE FROM Workouts WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  if (result.affectedRows > 0) {
    // Feed entries reference workouts loosely (not a real FK, since ref_id means
    // different things per event type), so they don't cascade-delete on their own.
    await pool.query(
      `DELETE FROM FeedEvents WHERE user_id = ? AND ref_id = ? AND type IN ('workout','pr')`,
      [userId, id]
    ).catch(err => console.error('Feed cleanup failed:', err));
  }
  return result.affectedRows > 0;
}

module.exports = {
  createWorkout, updateWorkout, getWorkouts, getWorkoutById, getWorkoutForViewing,
  deleteWorkout, deleteWorkoutPhoto,
};
