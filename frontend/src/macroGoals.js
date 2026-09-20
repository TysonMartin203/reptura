// Macro targets are stored as a percentage split of the daily calorie goal
// rather than fixed grams, so they stay correct when the calorie goal changes.
// Protein/carbs = 4 cal/g, fat = 9 cal/g.
const DEFAULT_SPLIT = { protein: 30, carbs: 40, fat: 30 };

// Returns the split as percentages, falling back to the standard 30/40/30.
// Older profiles stored gram goals directly (proteinGoal/carbsGoal/fatGoal);
// those are converted back to percentages here so existing users keep the
// targets they set before this switched to percentages.
export function getMacroSplit(profile, calorieGoal) {
  const pct = {
    protein: Number(profile?.proteinPct),
    carbs:   Number(profile?.carbsPct),
    fat:     Number(profile?.fatPct),
  };
  if (Number.isFinite(pct.protein) && Number.isFinite(pct.carbs) && Number.isFinite(pct.fat)
      && pct.protein + pct.carbs + pct.fat > 0) {
    return pct;
  }

  const cg = Number(calorieGoal) || 0;
  if (cg && (profile?.proteinGoal || profile?.carbsGoal || profile?.fatGoal)) {
    const legacy = {
      protein: profile.proteinGoal ? Math.round((Number(profile.proteinGoal) * 4 / cg) * 100) : DEFAULT_SPLIT.protein,
      carbs:   profile.carbsGoal   ? Math.round((Number(profile.carbsGoal)   * 4 / cg) * 100) : DEFAULT_SPLIT.carbs,
      fat:     profile.fatGoal     ? Math.round((Number(profile.fatGoal)     * 9 / cg) * 100) : DEFAULT_SPLIT.fat,
    };
    return legacy;
  }
  return { ...DEFAULT_SPLIT };
}

export function getMacroGoals(profile, calorieGoal) {
  const cg = Number(calorieGoal) || 0;
  if (!cg) return { protein: null, carbs: null, fat: null };
  const split = getMacroSplit(profile, cg);
  return {
    protein: Math.round((cg * split.protein / 100) / 4),
    carbs:   Math.round((cg * split.carbs   / 100) / 4),
    fat:     Math.round((cg * split.fat     / 100) / 9),
  };
}
