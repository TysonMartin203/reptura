// One-time cleanup script — goes through every already-saved workout plan
// and reorders its exercises so the same muscle group isn't worked twice in
// a row, using the same deterministic algorithm applied to newly generated
// plans. Never adds, removes, or swaps exercises — only their order changes.
//
// Run once from the backend folder, after setting the same DB_HOST/DB_USER/
// DB_PASSWORD/DB_NAME env vars Railway uses for the live database:
//   node scripts/reorder-existing-plans.js
//
// Safe to run more than once — a plan that's already well-ordered is left
// with the same order it already had.

require('dotenv').config();
const pool = require('../config/db');
const { reorderExercisesByMuscleGroup } = require('../data/muscleGroups');

async function run() {
  const [plans] = await pool.query('SELECT id, plan FROM WorkoutPlans');
  console.log(`Found ${plans.length} saved plan(s).`);

  let updated = 0;
  for (const row of plans) {
    let plan;
    try {
      plan = typeof row.plan === 'string' ? JSON.parse(row.plan) : row.plan;
    } catch (err) {
      console.warn(`Plan ${row.id}: couldn't parse, skipping.`);
      continue;
    }

    let changed = false;
    if (Array.isArray(plan.days)) {
      plan.days.forEach(day => {
        if (Array.isArray(day.exercises)) {
          const reordered = reorderExercisesByMuscleGroup(day.exercises);
          if (JSON.stringify(reordered) !== JSON.stringify(day.exercises)) changed = true;
          day.exercises = reordered;
        }
      });
    } else if (Array.isArray(plan.exercises)) {
      const reordered = reorderExercisesByMuscleGroup(plan.exercises);
      if (JSON.stringify(reordered) !== JSON.stringify(plan.exercises)) changed = true;
      plan.exercises = reordered;
    }

    if (changed) {
      await pool.query('UPDATE WorkoutPlans SET plan = ? WHERE id = ?', [JSON.stringify(plan), row.id]);
      updated++;
      console.log(`Plan ${row.id}: reordered.`);
    }
  }

  console.log(`Done. ${updated} of ${plans.length} plan(s) needed reordering.`);
  process.exit(0);
}

run().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
