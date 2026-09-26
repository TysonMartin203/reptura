// Single source of truth for how a user's stats get described to the AI.
// Previously each prompt hand-rolled its own stat block, which meant a new
// field (like height) had to be added in six places and could silently drift
// out of sync between them.
//
// Written compactly on purpose: these lines go into every meal/workout plan
// request, so trimming filler wording ("Current weight:" -> "Weight:",
// dropping "not provided" noise for fields the user left blank) cuts tokens
// on every single call without losing any information the model uses.

function formatHeight(profile) {
  const ft = Number(profile.heightFeet) || 0;
  const inch = Number(profile.heightInches) || 0;
  if (!ft && !inch) return null;
  return `${ft}'${inch}"`;
}

// The user's chosen macro ratio, as percentages of daily calories. Only
// included when they've actually set one — otherwise the model picks a
// sensible split itself.
function macroSplit(profile) {
  const p = Number(profile.proteinPct), c = Number(profile.carbsPct), f = Number(profile.fatPct);
  if (![p, c, f].every(Number.isFinite)) return null;
  if (p + c + f === 0) return null;
  return `${p}% protein / ${c}% carbs / ${f}% fat`;
}

// Returns a compact "- Key: value" block, omitting anything the user hasn't
// filled in — an absent line reads the same as "not provided" to the model
// but costs nothing.
function buildStatsBlock(profile = {}, extras = {}) {
  const height = formatHeight(profile);
  const lines = [
    profile.weight       && `Weight: ${profile.weight}lbs`,
    height               && `Height: ${height}`,
    profile.goalWeight   && `Goal weight: ${profile.goalWeight}lbs`,
    profile.goal         && `Goal: ${profile.goal}`,
    profile.timeline     && `Timeline: ${profile.timeline}wk`,
    profile.activityLevel && `Activity: ${profile.activityLevel}`,
    profile.calorieGoal  && `Target calories/day: ${profile.calorieGoal} (hit this closely)`,
    macroSplit(profile)  && `Macro split: ${macroSplit(profile)} (hit these ratios)`,
    extras.prs           && `PRs: ${extras.prs}`,
    profile.restrictions?.length && `Restrictions: ${profile.restrictions.join(', ')}`,
    profile.dislikes     && `Avoid: ${profile.dislikes}`,
    profile.wantedFoods  && `Include: ${profile.wantedFoods}`,
    extras.appliances    && `Appliances: ${extras.appliances}`,
    profile.equipment?.length && `Equipment: ${profile.equipment.join(', ')}`,
    profile.injuries     && `Injuries/limitations: ${profile.injuries}`,
    profile.notes        && `Notes: ${profile.notes}`,
  ].filter(Boolean);
  return lines.map(l => `- ${l}`).join('\n');
}

// Shared by the "generate" and "rebuild" meal plan prompts so the two can't
// drift. The rule that actually moves the grocery bill is the SKU count: the
// cost of a plan tracks how many separate things you have to buy, far more than
// which things they are. Two chicken cuts is two packages; one cut cooked two
// ways is one.
function budgetRules(isFamily) {
  const weekly = isFamily ? '$150-200 for the household' : '$75-100 for one person';
  return `CRITICAL BUDGET RULES — the goal is the SHORTEST possible grocery list, not just cheap items:
- ONE CUT PER PROTEIN. If any meal uses chicken breast, then EVERY chicken meal that week uses breast — never add thighs, tenders or a whole chicken as a second purchase. Grilled chicken breast on Monday and fried chicken on Thursday both use the same breasts. Same rule for beef (one cut), pork, and fish.
- Before adding any ingredient, check whether something already in the plan does the job. Adding a new item must be worth its own package price.
- Buy-in-package thinking: if a meal needs part of an item (half a cabbage, a bunch of cilantro, a tub of sour cream), plan other meals that finish the rest. Nothing should be bought for a single quarter-used purpose.
- One format per staple: one rice, one pasta shape, one cheese, one cooking oil, one vinegar — not several.
- No single-use specialty items. A spice blend, sauce or condiment that appears in only one meal is a wasted purchase unless it's already a pantry staple.
- Prioritize affordable proteins: eggs, canned tuna, chicken thighs, ground turkey, beans, lentils. Seasonal, cheap produce: carrots, cabbage, onions, bananas, apples, frozen vegetables. Staple grains: oats, rice, pasta, bread.
- Keep weekly grocery cost under ${weekly}.
- Balance all this with variety: reusing an INGREDIENT across the week is the point, but avoid serving the same or a near-identical MEAL back-to-back or on consecutive days — change the preparation, seasoning, or pairing so shared ingredients don't feel repetitive.`;
}

module.exports = { buildStatsBlock, formatHeight, budgetRules };
