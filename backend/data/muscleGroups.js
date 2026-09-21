// Maps each lifting exercise to its primary muscle group and whether it's a
// compound (multi-joint) or isolation move. Used to deterministically reorder
// a workout's exercises — guaranteed correct every time, unlike relying on an
// AI prompt to get spacing right — while never changing WHICH exercises are
// in the workout, only the order they're listed in.
const MUSCLE_GROUPS = {
  // Chest
  'Bench Press': ['Chest', true], 'Incline Dumbbell Press': ['Chest', true], 'Incline Bench Press': ['Chest', true], 'Decline Bench Press': ['Chest', true],
  'Dumbbell Fly': ['Chest', false], 'Cable Fly': ['Chest', false], 'Push-Up': ['Chest', true],
  'Chest Press Machine': ['Chest', true], 'Pec Deck': ['Chest', false], 'Cable Crossover': ['Chest', false],
  'Smith Machine Bench': ['Chest', true], 'Diamond Push-Up': ['Chest', true],
  // Back
  'Deadlift': ['Back', true], 'Pull-Up': ['Back', true], 'Chin-Up': ['Back', true], 'Lat Pulldown': ['Back', true],
  'Barbell Row': ['Back', true], 'Dumbbell Row': ['Back', true], 'Seated Cable Row': ['Back', true],
  'T-Bar Row': ['Back', true], 'Face Pull': ['Back', false], 'Hyperextension': ['Back', false],
  'Chest Supported Row': ['Back', true], 'Reverse Pec Deck': ['Back', false], 'Rack Pull': ['Back', true],
  'Straight Arm Pulldown': ['Back', false], 'Inverted Row': ['Back', true], 'Good Morning': ['Back', true],
  'Assisted Pull-Up': ['Back', true],
  // Shoulders
  'Overhead Press': ['Shoulders', true], 'Dumbbell Shoulder Press': ['Shoulders', true], 'Arnold Press': ['Shoulders', true],
  'Lateral Raise': ['Shoulders', false], 'Cable Lateral Raise': ['Shoulders', false], 'Front Raise': ['Shoulders', false],
  'Rear Delt Fly': ['Shoulders', false], 'Shrug': ['Shoulders', false], 'Upright Row': ['Shoulders', false],
  'Landmine Press': ['Shoulders', true],
  // Quads
  'Squat': ['Quads', true], 'Front Squat': ['Quads', true], 'Hack Squat': ['Quads', true], 'Leg Press': ['Quads', true],
  'Vertical Leg Press': ['Quads', true], 'Lunge': ['Quads', true], 'Bulgarian Split Squat': ['Quads', true],
  'Leg Extension': ['Quads', false], 'Goblet Squat': ['Quads', true], 'Box Squat': ['Quads', true],
  'Smith Machine Squat': ['Quads', true], 'Hack Squat Machine': ['Quads', true], 'Leg Press Machine': ['Quads', true],
  'Step Up': ['Quads', true], 'Walking Lunge': ['Quads', true], 'Bodyweight Squat': ['Quads', true],
  'Jump Squat': ['Quads', true], 'Pistol Squat': ['Quads', true],
  // Hamstrings
  'Romanian Deadlift': ['Hamstrings', true], 'Leg Curl': ['Hamstrings', false], 'Seated Leg Curl Machine': ['Hamstrings', false], 'Prone Leg Curl Machine': ['Hamstrings', false],
  'Nordic Curl': ['Hamstrings', false],
  // Glutes
  'Hip Thrust': ['Glutes', true], 'Glute Bridge': ['Glutes', true], 'Glute Kickback Machine': ['Glutes', false],
  'Sumo Deadlift': ['Glutes', true], 'Hip Abductor (Outer Thigh)': ['Glutes', false], 'Hip Adductor (Inner Thigh)': ['Glutes', false],
  // Calves
  'Calf Raise': ['Calves', false], 'Standing Calf Raise Machine': ['Calves', false], 'Seated Calf Raise Machine': ['Calves', false],
  // Biceps
  'Barbell Curl': ['Biceps', false], 'Dumbbell Curl': ['Biceps', false], 'Hammer Curl': ['Biceps', false],
  'Preacher Curl': ['Biceps', false], 'Preacher Curl Machine': ['Biceps', false], 'Concentration Curl': ['Biceps', false],
  'Cable Curl': ['Biceps', false], 'Incline Dumbbell Curl': ['Biceps', false], 'Zottman Curl': ['Biceps', false],
  'Spider Curl': ['Biceps', false],
  // Triceps
  'Tricep Pushdown': ['Triceps', false], 'Skull Crusher': ['Triceps', false], 'Close Grip Bench Press': ['Triceps', true],
  'Overhead Tricep Extension': ['Triceps', false], 'Dip': ['Triceps', true], 'Assisted Dip Machine': ['Triceps', true],
  'Kickback': ['Triceps', false], 'Bench Dip': ['Triceps', false],
  // Core
  'Plank': ['Core', false], 'Crunch': ['Core', false], 'Sit-Up': ['Core', false], 'Leg Raise': ['Core', false],
  'Russian Twist': ['Core', false], 'Cable Crunch': ['Core', false], 'Ab Wheel': ['Core', false],
  'Mountain Climber': ['Core', false], 'Hanging Leg Raise': ['Core', false], 'Torso Rotation Machine': ['Core', false],
  'Bicycle Crunch': ['Core', false], 'Side Plank': ['Core', false], 'V-Up': ['Core', false],
  'Flutter Kicks': ['Core', false], 'Dead Bug': ['Core', false], 'Pallof Press': ['Core', false],
  // Full body / power — these work many muscles at once, so they're never
  // treated as "same muscle" conflicts with anything and are left in place
  // relative to each other rather than reshuffled.
  'Clean and Jerk': ['FullBody', true], 'Snatch': ['FullBody', true], 'Power Clean': ['FullBody', true],
  'Power Snatch': ['FullBody', true], 'Box Jump': ['FullBody', true], 'Burpee': ['FullBody', true],
  'Superman Hold': ['Back', false],
};

// Reorders a list of exercise objects (each with an exerciseName) so that:
//  1. Cardio exercises are left exactly where they are, in their original
//     relative order — this is a lifting-day concern only.
//  2. Compound lifts for a muscle come before isolation lifts for the same
//     muscle, but the actual set of exercises is never changed — only order.
//  3. No two exercises hitting the same muscle group are ever placed directly
//     back-to-back when it's possible to avoid it, by interleaving with
//     exercises for other muscles first.
// This never adds, removes, or swaps which exercises are present — same
// exercises, better order.
const blocks = m => m !== 'FullBody' && m !== 'Other'; // these never count as "same muscle"

// How many same-muscle pairs are left if the rest of the workout is placed
// with the "most exercises remaining first" rule — the standard optimal
// strategy for spacing repeated items apart.
function remainingCost(counts, last) {
  const c = { ...counts };
  let left = Object.values(c).reduce((a, b) => a + b, 0), prev = last, pairs = 0;
  while (left > 0) {
    const keys = Object.keys(c).filter(k => c[k] > 0);
    const eligible = keys.filter(k => k !== prev);
    const pool = eligible.length ? eligible : keys;
    const pick = pool.reduce((best, k) => (c[k] > c[best] ? k : best), pool[0]);
    if (pick === prev) pairs++;
    c[pick]--; left--; prev = blocks(pick) ? pick : null;
  }
  return pairs;
}

// Reorders a workout's lifting exercises so the same muscle isn't worked twice
// in a row whenever that's avoidable. Never adds, removes, or swaps exercises —
// same exercises, better order. Cardio is left at the end, untouched.
//
// Among orderings that are equally well spaced, it follows the plan's own
// order (so the main compound lift still leads the day), and within a muscle
// compound lifts come before isolation work.
function reorderExercisesByMuscleGroup(exercises) {
  const lifting = exercises.filter(e => e.category === 'lifting' || !e.category);
  const cardio = exercises.filter(e => e.category === 'cardio');
  if (lifting.length <= 1) return exercises;

  const groups = {};
  lifting.forEach((ex, pos) => {
    const [muscle, compound] = MUSCLE_GROUPS[ex.exerciseName] || ['Other', true];
    (groups[muscle] = groups[muscle] || []).push({ ex, compound, pos });
  });
  Object.values(groups).forEach(g => g.sort((a, b) => (b.compound - a.compound) || (a.pos - b.pos)));

  const counts = {};
  Object.keys(groups).forEach(k => { counts[k] = groups[k].length; });
  const result = [];
  let last = null;
  while (result.length < lifting.length) {
    const keys = Object.keys(counts).filter(k => counts[k] > 0);
    const eligible = keys.filter(k => k !== last);
    const pool = eligible.length ? eligible : keys;
    const cost = k => (k === last ? 1 : 0) + remainingCost({ ...counts, [k]: counts[k] - 1 }, blocks(k) ? k : null);
    const costs = Object.fromEntries(pool.map(k => [k, cost(k)]));
    const best = Math.min(...Object.values(costs));
    const pick = pool.filter(k => costs[k] === best).sort((a, b) => groups[a][0].pos - groups[b][0].pos)[0];
    result.push(groups[pick].shift().ex);
    counts[pick]--;
    last = blocks(pick) ? pick : null;
  }
  return [...result, ...cardio];
}

// Same-muscle pairs a list currently has, and the fewest it could possibly have.
function samePairs(exercises) {
  const l = exercises.filter(e => e.category !== 'cardio');
  let pairs = 0;
  for (let i = 1; i < l.length; i++) {
    const a = (MUSCLE_GROUPS[l[i - 1].exerciseName] || ['Other'])[0];
    const b = (MUSCLE_GROUPS[l[i].exerciseName] || ['Other'])[0];
    if (a === b && blocks(a)) pairs++;
  }
  return pairs;
}
function minPairs(exercises) {
  const l = exercises.filter(e => e.category !== 'cardio');
  const c = {};
  l.forEach(e => { const m = (MUSCLE_GROUPS[e.exerciseName] || ['Other'])[0]; if (blocks(m)) c[m] = (c[m] || 0) + 1; });
  const most = Math.max(0, ...Object.values(c));
  return Math.max(0, 2 * most - l.length - 1);
}

// Fixes a whole plan (single workout or a week of days) in place. Only touches
// a day that has avoidable back-to-back pairs, so a day that's already well
// ordered is never reshuffled. Returns true if anything changed.
function fixPlanOrder(plan) {
  if (!plan) return false;
  let changed = false;
  const fix = list => {
    if (!Array.isArray(list) || samePairs(list) <= minPairs(list)) return list;
    changed = true;
    return reorderExercisesByMuscleGroup(list);
  };
  if (Array.isArray(plan.days)) plan.days.forEach(d => { if (d) d.exercises = fix(d.exercises); });
  else if (Array.isArray(plan.exercises)) plan.exercises = fix(plan.exercises);
  return changed;
}

module.exports = { MUSCLE_GROUPS, reorderExercisesByMuscleGroup, fixPlanOrder };
