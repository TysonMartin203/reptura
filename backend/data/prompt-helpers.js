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

module.exports = { buildStatsBlock, formatHeight };
