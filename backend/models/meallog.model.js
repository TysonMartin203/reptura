const pool = require('../config/db');

function mergeMealData(existing, incoming) {
  const existingIngredients = existing.ingredients ? (typeof existing.ingredients === 'string' ? JSON.parse(existing.ingredients) : existing.ingredients) : [];
  const mergedIngredients = [...existingIngredients, ...(incoming.ingredients || [])];
  const name = [existing.name, incoming.name].filter(Boolean).join(', ').slice(0, 500);
  const notes = [existing.notes, incoming.notes].filter(Boolean).join(' — ').slice(0, 280) || null;
  return {
    name,
    calories: (Number(existing.calories) || 0) + (Number(incoming.calories) || 0) || null,
    protein: (Number(existing.protein) || 0) + (Number(incoming.protein) || 0) || null,
    carbs: (Number(existing.carbs) || 0) + (Number(incoming.carbs) || 0) || null,
    fat: (Number(existing.fat) || 0) + (Number(incoming.fat) || 0) || null,
    notes,
    ingredients: mergedIngredients.length ? mergedIngredients : null,
  };
}

// Finds an existing logged meal at this exact (user, date, mealType) slot, if any.
async function findMealSlot(userId, date, mealType, excludeId = null) {
  const [rows] = await pool.query(
    `SELECT * FROM LoggedMeals WHERE user_id = ? AND date = ? AND meal_type = ? ${excludeId ? 'AND id != ?' : ''} LIMIT 1`,
    excludeId ? [userId, date, mealType, excludeId] : [userId, date, mealType]
  );
  return rows[0] || null;
}

// Logging a meal for a slot that already has one merges into it (adds to what's
// already there for that meal) rather than creating a second separate entry.
async function logMeal({ userId, date, mealType, name, calories, protein, carbs, fat, notes, ingredients }) {
  const existing = await findMealSlot(userId, date, mealType);
  if (existing) {
    const merged = mergeMealData(existing, { name, calories, protein, carbs, fat, notes, ingredients });
    await pool.query(
      `UPDATE LoggedMeals SET name=?, calories=?, protein=?, carbs=?, fat=?, notes=?, ingredients=? WHERE id=?`,
      [merged.name, merged.calories, merged.protein, merged.carbs, merged.fat, merged.notes, merged.ingredients ? JSON.stringify(merged.ingredients) : null, existing.id]
    );
    return existing.id;
  }
  const [result] = await pool.query(
    `INSERT INTO LoggedMeals (user_id, date, meal_type, name, calories, protein, carbs, fat, notes, ingredients)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, date, mealType, name, calories || null, protein || null, carbs || null, fat || null, notes || null, ingredients ? JSON.stringify(ingredients) : null]
  );
  return result.insertId;
}

// Edits an existing logged meal. If the date/meal type is changed to a slot
// that already has a meal, this one merges into that slot (matches the same
// "add to what's already there" rule as logging) and the original row is
// removed; otherwise it's a normal in-place update.
async function updateMeal(id, userId, { date, mealType, name, calories, protein, carbs, fat, notes, ingredients }) {
  const [[current]] = await pool.query('SELECT * FROM LoggedMeals WHERE id = ? AND user_id = ?', [id, userId]);
  if (!current) return null;

  const slotChanged = date !== current.date || mealType !== current.meal_type;
  if (slotChanged) {
    const target = await findMealSlot(userId, date, mealType, id);
    if (target) {
      const merged = mergeMealData(target, { name, calories, protein, carbs, fat, notes, ingredients });
      await pool.query(
        `UPDATE LoggedMeals SET name=?, calories=?, protein=?, carbs=?, fat=?, notes=?, ingredients=? WHERE id=?`,
        [merged.name, merged.calories, merged.protein, merged.carbs, merged.fat, merged.notes, merged.ingredients ? JSON.stringify(merged.ingredients) : null, target.id]
      );
      await pool.query('DELETE FROM LoggedMeals WHERE id = ?', [id]);
      return target.id;
    }
  }

  await pool.query(
    `UPDATE LoggedMeals SET date=?, meal_type=?, name=?, calories=?, protein=?, carbs=?, fat=?, notes=?, ingredients=? WHERE id=? AND user_id=?`,
    [date, mealType, name, calories || null, protein || null, carbs || null, fat || null, notes || null, ingredients ? JSON.stringify(ingredients) : null, id, userId]
  );
  return id;
}

async function getMealsForDate(userId, date) {
  const [rows] = await pool.query(
    'SELECT * FROM LoggedMeals WHERE user_id = ? AND date = ? ORDER BY created_at ASC',
    [userId, date]
  );
  return rows;
}

async function getMealHistory(userId) {
  const [rows] = await pool.query(
    'SELECT * FROM LoggedMeals WHERE user_id = ? ORDER BY date DESC, created_at DESC LIMIT 200',
    [userId]
  );
  return rows;
}

async function deleteMeal(id, userId) {
  const [result] = await pool.query('DELETE FROM LoggedMeals WHERE id = ? AND user_id = ?', [id, userId]);
  return result.affectedRows > 0;
}

async function getDailyTotals(userId, date) {
  const [[row]] = await pool.query(
    `SELECT COALESCE(SUM(calories),0) AS calories, COALESCE(SUM(protein),0) AS protein,
            COALESCE(SUM(carbs),0) AS carbs, COALESCE(SUM(fat),0) AS fat, COUNT(*) AS mealCount
     FROM LoggedMeals WHERE user_id = ? AND date = ?`,
    [userId, date]
  );
  return {
    calories: Number(row.calories), protein: Number(row.protein),
    carbs: Number(row.carbs), fat: Number(row.fat), mealCount: row.mealCount,
  };
}

// Sums calories burned from cardio exercises logged for a given day — only
// counts exercises that actually have a calorie value (manually entered,
// formula-calculated for sports, or otherwise), so entries with no calorie
// data simply contribute nothing rather than being estimated.
async function getCaloriesBurned(userId, date) {
  const [[row]] = await pool.query(
    `SELECT COALESCE(SUM(we.calories),0) AS burned
     FROM WorkoutExercises we
     JOIN Workouts w ON w.id = we.workout_id
     WHERE w.user_id = ? AND w.date = ? AND we.category = 'cardio' AND we.calories IS NOT NULL`,
    [userId, date]
  );
  return Number(row.burned);
}

// Recomputes a meal's name/totals from whatever ingredients remain after
// removing one. Deletes the whole meal if that was the last ingredient.
async function deleteIngredient(mealId, userId, ingredientIndex) {
  const [[meal]] = await pool.query('SELECT * FROM LoggedMeals WHERE id = ? AND user_id = ?', [mealId, userId]);
  if (!meal) return null;
  const ingredients = meal.ingredients ? (typeof meal.ingredients === 'string' ? JSON.parse(meal.ingredients) : meal.ingredients) : [];
  if (ingredientIndex < 0 || ingredientIndex >= ingredients.length) return null;
  const removed = ingredients[ingredientIndex];
  const remaining = ingredients.filter((_, i) => i !== ingredientIndex);

  if (remaining.length === 0) {
    await pool.query('DELETE FROM LoggedMeals WHERE id = ?', [mealId]);
    return { deleted: true };
  }
  const name = remaining.map(i => i.name).join(', ').slice(0, 500);
  const sum = (field) => remaining.reduce((t, i) => t + (Number(i[field]) || 0), 0) || null;
  await pool.query(
    'UPDATE LoggedMeals SET name=?, calories=?, protein=?, carbs=?, fat=?, ingredients=? WHERE id=?',
    [name, sum('calories'), sum('protein'), sum('carbs'), sum('fat'), JSON.stringify(remaining), mealId]
  );
  return { deleted: false, removed };
}

// Moves a single ingredient out of one meal and into another day/meal-type
// slot — pulling it out uses the same recompute as deleteIngredient, and
// placing it uses the same merge-aware logMeal as logging normally does, so
// it combines with whatever's already in the target slot rather than
// duplicating a separate entry there.
async function moveIngredient(mealId, userId, ingredientIndex, newDate, newMealType) {
  const [[meal]] = await pool.query('SELECT * FROM LoggedMeals WHERE id = ? AND user_id = ?', [mealId, userId]);
  if (!meal) return null;
  const ingredients = meal.ingredients ? (typeof meal.ingredients === 'string' ? JSON.parse(meal.ingredients) : meal.ingredients) : [];
  if (ingredientIndex < 0 || ingredientIndex >= ingredients.length) return null;
  const moved = ingredients[ingredientIndex];

  const removal = await deleteIngredient(mealId, userId, ingredientIndex);
  const newMealId = await logMeal({
    userId, date: newDate, mealType: newMealType, name: moved.name,
    calories: moved.calories, protein: moved.protein, carbs: moved.carbs, fat: moved.fat,
    ingredients: [moved],
  });
  return { removedFrom: removal, movedTo: newMealId };
}

module.exports = { logMeal, updateMeal, getMealsForDate, getMealHistory, deleteMeal, getDailyTotals, getCaloriesBurned, deleteIngredient, moveIngredient };


