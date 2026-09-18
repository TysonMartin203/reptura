const pool = require('../config/db');
const Anthropic = require('@anthropic-ai/sdk');
const { createNotification } = require('../models/notification.model');
const { sendPushToUser } = require('../models/push.model');
const { findById } = require('../models/user.model');
const { areFriends } = require('../models/friend.model');
const { buildDeterministicRecipe } = require('../models/deterministic-recipe');

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

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS MealPlans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(100) NOT NULL DEFAULT 'My Meal Plan',
      profile JSON,
      plan JSON,
      is_favorite TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
      INDEX idx_meal_user (user_id)
    ) ENGINE=InnoDB
  `);
  // Migrate old single-plan table if needed (add missing columns)
  await pool.query(`ALTER TABLE MealPlans ADD COLUMN IF NOT EXISTS name VARCHAR(100) NOT NULL DEFAULT 'My Meal Plan'`).catch(()=>{});
  await pool.query(`ALTER TABLE MealPlans ADD COLUMN IF NOT EXISTS is_favorite TINYINT(1) NOT NULL DEFAULT 0`).catch(()=>{});
  await pool.query(`ALTER TABLE MealPlans ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT NULL`).catch(()=>{});
  await pool.query(`ALTER TABLE MealPlans ADD COLUMN IF NOT EXISTS created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`).catch(()=>{});
  // Remove unique constraint if it exists (allow multiple plans per user).
  // Add a plain (non-unique) index first so the foreign key has something
  // else to rely on, then drop the old unique index.
  await pool.query(`ALTER TABLE MealPlans ADD INDEX idx_meal_user (user_id)`).catch(()=>{});
  await pool.query(`ALTER TABLE MealPlans DROP INDEX user_id`).catch(()=>{});
}

// List all plans for user
async function listPlans(req, res) {
  try {
    await ensureTable();
    const [rows] = await pool.query(
      'SELECT id, name, is_favorite, category, created_at, JSON_EXTRACT(plan, "$.daily_calories") as daily_calories FROM MealPlans WHERE user_id = ? ORDER BY is_favorite DESC, created_at DESC',
      [req.userId]
    );
    res.json({ plans: rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

// Get a single plan
async function getPlan(req, res) {
  try {
    await ensureTable();
    const [rows] = await pool.query('SELECT * FROM MealPlans WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ plan: rows[0].plan, profile: rows[0].profile, name: rows[0].name, is_favorite: rows[0].is_favorite, shared_from_username: rows[0].shared_from_username, source: rows[0].source });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

// Rename a plan
async function renamePlan(req, res) {
  try {
    await pool.query('UPDATE MealPlans SET name = ? WHERE id = ? AND user_id = ?', [req.body.name, req.params.id, req.userId]);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

// Toggle favorite
async function toggleFavorite(req, res) {
  try {
    await pool.query('UPDATE MealPlans SET is_favorite = NOT is_favorite WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    const [[row]] = await pool.query('SELECT is_favorite FROM MealPlans WHERE id = ?', [req.params.id]);
    res.json({ is_favorite: !!row?.is_favorite });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

// Delete a plan
async function deletePlan(req, res) {
  try {
    await pool.query('DELETE FROM MealPlans WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

// Generate a new plan
async function generate(req, res) {
  try {
    await ensureTable();
    const client = getClient();
    const { weight, goalWeight, goal, timeline, activityLevel = '', calorieGoal = '', restrictions = [], dislikes = '', wantedFoods = '', appliances = [], notes = '', planName = 'My Meal Plan', familyMembers = [] } = req.body;

    const [prs] = await pool.query('SELECT exercise, max_weight FROM PRs WHERE user_id = ? LIMIT 5', [req.userId]);
    const prText = prs.length > 0 ? prs.map(p => `${p.exercise}: ${p.max_weight}lbs`).join(', ') : 'Not provided';
    const applianceText = appliances.length > 0 ? appliances.join(', ') : 'stovetop, oven, microwave (assume basic)';

    const isFamily = Array.isArray(familyMembers) && familyMembers.length > 0;
    const familyText = isFamily
      ? familyMembers.map(m => `${m.name}${m.age ? ` (age ${m.age})` : ''}${m.weight ? `, ${m.weight}lbs` : ''}${m.goal ? `, goal: ${m.goal}` : ''}`).join('; ')
      : '';
    const familySection = isFamily ? `

FAMILY MEAL PLAN — this plan must work for the whole household eating together, not just one person:
- Household members besides the primary user: ${familyText}
- Build ONE shared meal per slot (e.g. one dinner the whole family eats), not separate meals per person — that keeps cooking and grocery cost down
- Note portion guidance by age where it matters (young children typically need noticeably smaller portions than adults — call this out in the meal notes or ingredients when relevant, e.g. "kids: half portion")
- Keep meals kid-friendly and broadly appealing — avoid anything a picky child is likely to refuse, unless the household's notes say otherwise
- If household members have different goals (e.g. one adult cutting, a child just eating normally), the shared base meal should suit everyone, with an optional simple add-on noted for whoever needs more (e.g. "add an extra scoop of rice for higher-calorie goals") rather than building separate dishes
- Still respect every dietary restriction listed below — assume they apply to whoever in the household has them unless stated otherwise` : '';

    const prompt = `You are a certified nutritionist and personal trainer. Create a budget-friendly 7-day meal plan as JSON.

CRITICAL BUDGET RULES:
- Reuse proteins and staple ingredients across the week (e.g. a rotisserie chicken or a pack of chicken thighs used in 3 different meals) so the grocery list stays short and affordable
- Prioritize affordable proteins: eggs, canned tuna, chicken thighs, ground turkey, beans, lentils
- Use seasonal/affordable produce: carrots, cabbage, bananas, apples, frozen vegetables
- Staple grains: oats, rice, pasta, bread — use repeatedly across different meals
- Keep weekly grocery cost under ${isFamily ? '$150-200 for the household' : '$75-100 for one person'}
- Balance this with variety: reusing an INGREDIENT across the week is good (keeps cost down), but avoid serving the same or a near-identical MEAL back-to-back or on consecutive days — vary the preparation, seasoning, or pairing so it doesn't feel repetitive day to day, even when the underlying ingredients are shared
${familySection}

User stats:
- Current weight: ${weight || 'not provided'} lbs
- Goal weight: ${goalWeight || 'not provided'} lbs
- Goal: ${goal}
- Timeline: ${timeline || 'not provided'} weeks
- Activity level: ${activityLevel || 'not provided'}
- Daily calorie goal (if given, target this closely instead of estimating your own): ${calorieGoal || 'not specified — estimate based on the stats above'}
- Lifting PRs: ${prText}
- Dietary restrictions: ${restrictions.length > 0 ? restrictions.join(', ') : 'none'}
- Foods to avoid: ${dislikes || 'none'}
- Foods to include: ${wantedFoods || 'none'}
- Available appliances: ${applianceText}
- Additional notes from the user: ${notes || 'none'}

Only suggest recipes makeable with the listed appliances. Unless the user has requested specific foods, default to universally popular, crowd-pleasing meals that most people enjoy — things like chicken and rice, pasta, tacos, burgers, eggs, stir fry, sandwiches, oatmeal, and similar widely-liked foods. Avoid niche or polarizing ingredients like tofu, tempeh, liver, anchovies, Brussels sprouts, or bitter greens unless explicitly requested.

Return ONLY valid JSON, no markdown. Structure:
{
  "daily_calories": number,
  "macros": { "protein": number, "carbs": number, "fat": number },
  "budget_tip": "one sentence money-saving tip for this week",
  "days": [
    {
      "day": "Monday",
      "meals": [
        {
          "type": "Breakfast",
          "name": "Meal name",
          "calories": number,
          "protein": number,
          "carbs": number,
          "fat": number,
          "ingredients": ["2 eggs", "1 cup oats"],
          "can_substitute": true
        }
      ]
    }
  ]
}
Include Breakfast, Lunch, Dinner, and one Snack per day for all 7 days.`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }]
    });

    let text = message.content[0].text.trim();
    text = text.replace(/^```json\s*/,'').replace(/\s*```$/,'').trim();
    const plan = JSON.parse(text);

    const category = isFamily ? 'Family Plan' : null;
    const [result] = await pool.query(
      'INSERT INTO MealPlans (user_id, name, profile, plan, category) VALUES (?, ?, ?, ?, ?)',
      [req.userId, planName, JSON.stringify(req.body), JSON.stringify(plan), category]
    );

    res.json({ plan, planId: result.insertId, planName });
  } catch (err) {
    console.error(err);
    if (err.message === 'ANTHROPIC_API_KEY not set')
      return res.status(503).json({ error: 'AI meal planning not configured yet.' });
    res.status(500).json({ error: 'Failed to generate: ' + err.message });
  }
}

// Rebuild an existing saved plan from updated weight/goal/notes — replaces its
// content in place rather than creating a new plan.
async function regenerate(req, res) {
  try {
    await ensureTable();
    const client = getClient();
    const { weight, goalWeight, goal, timeline, activityLevel = '', calorieGoal = '', restrictions = [], dislikes = '', wantedFoods = '', appliances = [], notes = '' } = req.body;

    const [[existing]] = await pool.query('SELECT * FROM MealPlans WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!existing) return res.status(404).json({ error: 'Plan not found' });

    const [prs] = await pool.query('SELECT exercise, max_weight FROM PRs WHERE user_id = ? LIMIT 5', [req.userId]);
    const prText = prs.length > 0 ? prs.map(p => `${p.exercise}: ${p.max_weight}lbs`).join(', ') : 'Not provided';
    const applianceText = appliances.length > 0 ? appliances.join(', ') : 'stovetop, oven, microwave (assume basic)';

    const prompt = `You are a certified nutritionist and personal trainer. The user already has a meal plan called "${existing.name}" but wants it rebuilt based on updated info. Create a fresh budget-friendly 7-day meal plan as JSON.

CRITICAL BUDGET RULES:
- Reuse proteins across multiple days
- Prioritize affordable proteins: eggs, canned tuna, chicken thighs, ground turkey, beans, lentils
- Keep weekly grocery cost under $75-100 for one person
- Balance this with variety: reusing an INGREDIENT across the week is good (keeps cost down), but avoid serving the same or a near-identical MEAL back-to-back or on consecutive days

Updated user stats:
- Current weight: ${weight || 'not provided'} lbs
- Goal weight: ${goalWeight || 'not provided'} lbs
- Goal: ${goal || 'not provided'}
- Timeline: ${timeline || 'not provided'} weeks
- Activity level: ${activityLevel || 'not provided'}
- Daily calorie goal (if given, target this closely instead of estimating your own): ${calorieGoal || 'not specified — estimate based on the stats above'}
- Lifting PRs: ${prText}
- Dietary restrictions: ${restrictions.length > 0 ? restrictions.join(', ') : 'none'}
- Foods to avoid: ${dislikes || 'none'}
- Foods to include: ${wantedFoods || 'none'}
- Available appliances: ${applianceText}
- Additional notes from the user: ${notes || 'none'}

Only suggest recipes makeable with the listed appliances. Unless the user has requested specific foods, default to universally popular, crowd-pleasing meals that most people enjoy — things like chicken and rice, pasta, tacos, burgers, eggs, stir fry, sandwiches, oatmeal, and similar widely-liked foods. Avoid niche or polarizing ingredients like tofu, tempeh, liver, anchovies, Brussels sprouts, or bitter greens unless explicitly requested.

Return ONLY valid JSON, no markdown. Same structure as before:
{
  "daily_calories": number,
  "macros": { "protein": number, "carbs": number, "fat": number },
  "budget_tip": "one sentence money-saving tip for this week",
  "days": [{ "day": "Monday", "meals": [{ "type": "Breakfast", "name": "...", "calories": number, "protein": number, "carbs": number, "fat": number, "ingredients": ["..."], "can_substitute": true }] }]
}
Include Breakfast, Lunch, Dinner, and one Snack per day for all 7 days.`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    });

    let text = message.content[0].text.trim();
    text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    const plan = JSON.parse(text);

    await pool.query(
      'UPDATE MealPlans SET plan = ?, profile = ?, source = ? WHERE id = ?',
      [JSON.stringify(plan), JSON.stringify(req.body), 'ai', req.params.id]
    );

    res.json({ plan, planId: Number(req.params.id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to regenerate: ' + err.message });
  }
}

// Swap a single meal
async function swap(req, res) {
  try {
    const client = getClient();
    const { mealName, restrictions = [], macroTarget, appliances = [], planId, dayIdx, mealIdx, reason, detail } = req.body;
    const applianceText = appliances.length > 0 ? appliances.join(', ') : 'stovetop, oven, microwave';

    let reasonText = '';
    if (reason === 'restriction' && detail) {
      reasonText = `The user cannot have the following, so it must not appear anywhere in the replacement meal or its ingredients: ${detail}.`;
    } else if (reason === 'dislike') {
      reasonText = detail
        ? `The user doesn't want this meal because: ${detail}. Pick something meaningfully different that avoids that.`
        : `The user just doesn't want this specific meal — pick something meaningfully different.`;
    }

    const prompt = `Suggest one budget-friendly alternative meal to replace "${mealName}".
Dietary restrictions: ${restrictions.length > 0 ? restrictions.join(', ') : 'none'}.
${reasonText}
Available appliances: ${applianceText}.
Match approximately: ${macroTarget.calories} calories, ${macroTarget.protein}g protein, ${macroTarget.carbs}g carbs, ${macroTarget.fat}g fat.
Use affordable, common ingredients. Return ONLY JSON:
{ "name": "...", "calories": number, "protein": number, "carbs": number, "fat": number, "ingredients": ["item with amount"], "can_substitute": true }`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    let text = message.content[0].text.trim();
    text = text.replace(/^```json\s*/,'').replace(/\s*```$/,'').trim();
    const meal = JSON.parse(text);

    // Update the plan in the database
    if (planId) {
      const [[row]] = await pool.query('SELECT plan FROM MealPlans WHERE id = ? AND user_id = ?', [planId, req.userId]);
      if (row) {
        const planData = row.plan;
        planData.days[dayIdx].meals[mealIdx] = { ...planData.days[dayIdx].meals[mealIdx], ...meal, swapped: true };
        await pool.query('UPDATE MealPlans SET plan = ? WHERE id = ?', [JSON.stringify(planData), planId]);
      }
    }

    res.json({ meal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Swap failed' });
  }
}

// replaced below

// ── Get recipe steps for a specific meal ──
async function getRecipe(req, res) {
  try {
    const { mealName, ingredients = [], useCache } = req.body;

    if (useCache) {
      return res.json({ recipe: buildDeterministicRecipe(mealName, ingredients) });
    }

    const client = getClient();

    const prompt = `Give me a simple step-by-step recipe for "${mealName}".
Ingredients: ${ingredients.join(', ')}.
Return ONLY JSON:
{
  "prep_time": "X min",
  "cook_time": "X min",
  "steps": ["Step 1: ...", "Step 2: ...", "Step 3: ..."]
}
Keep it clear and beginner-friendly. 5-8 steps max.`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    });

    let text = message.content[0].text.trim();
    text = text.replace(/^```json\s*/,'').replace(/\s*```$/,'').trim();
    const recipe = JSON.parse(text);
    res.json({ recipe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load recipe' });
  }
}

// ── Get template list ──
async function getTemplates(req, res) {
  const TEMPLATES = require('../data/meal-templates');
  res.json({ templates: TEMPLATES.map(t => ({ id: t.id, name: t.name, description: t.description, category: t.category, icon: t.icon, daily_calories: t.plan.daily_calories })) });
}

// ── Use a template (save it as a user plan) ──
async function useTemplate(req, res) {
  try {
    await ensureTable();
    const TEMPLATES = require('../data/meal-templates');
    const template = TEMPLATES.find(t => t.id === req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    const name = req.body.name || template.name;
    const [result] = await pool.query(
      'INSERT INTO MealPlans (user_id, name, plan, source) VALUES (?, ?, ?, ?)',
      [req.userId, name, JSON.stringify(template.plan), 'template']
    );
    res.json({ planId: result.insertId, plan: template.plan, planName: name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── Build a plan entirely by hand, no AI ──
async function createCustom(req, res) {
  try {
    await ensureTable();
    const { name, plan } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Plan name required' });
    if (!plan?.days?.length) return res.status(400).json({ error: 'At least one day with a meal is required' });
    const [result] = await pool.query(
      'INSERT INTO MealPlans (user_id, name, plan, source) VALUES (?, ?, ?, ?)',
      [req.userId, name.trim(), JSON.stringify(plan), 'custom']
    );
    res.status(201).json({ planId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// Get a single template by id
async function getTemplateById(req, res) {
  const TEMPLATES = require('../data/meal-templates');
  const t = TEMPLATES.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Not found' });
  res.json({ plan: t.plan, name: t.name });
}

// ── Share a saved plan with a friend (copies it into their plans) ──
async function sharePlan(req, res) {
  try {
    await ensureTable();
    const { friendId } = req.body;
    if (!friendId) return res.status(400).json({ error: 'friendId required' });

    const friends = await areFriends(req.userId, friendId);
    if (!friends) return res.status(403).json({ error: 'Not friends' });

    const [[plan]] = await pool.query('SELECT * FROM MealPlans WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const sender = await findById(req.userId);
    const [result] = await pool.query(
      `INSERT INTO MealPlans (user_id, name, plan, source, shared_from_user_id, shared_from_username)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [friendId, plan.name, JSON.stringify(plan.plan), plan.source || 'ai', req.userId, sender?.username || null]
    );

    await createNotification({
      userId: friendId, type: 'meal_share',
      title: `${sender?.username || 'A friend'} shared a meal plan with you`,
      body: plan.name,
      data: { planId: result.insertId },
    });
    await sendPushToUser(friendId, {
      title: 'New shared meal plan',
      body: `${sender?.username || 'A friend'} sent you "${plan.name}"`,
      data: { type: 'meal_share', planId: result.insertId },
    });

    res.status(201).json({ success: true, planId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// Generate just one meal — for "I need an idea for lunch right now" rather than a whole week.
async function generateSingleMeal(req, res) {
  try {
    const client = getClient();
    const { mealType = 'Lunch', weight, goal, calorieGoal = '', restrictions = [], dislikes = '', wantedFoods = '', appliances = [], craving = '' } = req.body;
    const applianceText = appliances.length > 0 ? appliances.join(', ') : 'stovetop, oven, microwave (assume basic)';

    const prompt = `You are a certified nutritionist. Suggest ONE ${mealType.toLowerCase()} idea as JSON.

User context:
- Goal: ${goal || 'not provided'}
- Daily calorie goal: ${calorieGoal || 'not specified'}
- Dietary restrictions: ${restrictions.length > 0 ? restrictions.join(', ') : 'none'}
- Foods to avoid: ${dislikes || 'none'}
- Foods to include: ${wantedFoods || 'none'}
- Available appliances: ${applianceText}
- What they're in the mood for: ${craving || 'no particular craving — surprise them with something popular and easy'}

Keep it affordable and only use the listed appliances. Default to universally popular, crowd-pleasing food unless a craving was given.

Return ONLY valid JSON, no markdown:
{ "type": "${mealType}", "name": "Meal name", "calories": number, "protein": number, "carbs": number, "fat": number, "ingredients": ["2 eggs","1 cup oats"] }`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });
    let text = message.content[0].text.trim();
    text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    res.json(JSON.parse(text));
  } catch (err) {
    console.error(err);
    if (err.message === 'ANTHROPIC_API_KEY not set')
      return res.status(503).json({ error: 'AI meal planning not configured yet.' });
    res.status(500).json({ error: 'Failed to generate: ' + err.message });
  }
}

// Generate a single day's worth of meals — saved the same way a full week plan is,
// just with one day, so it reuses the existing plan-viewing UI.
async function generateDayPlan(req, res) {
  try {
    await ensureTable();
    const client = getClient();
    const { weight, goalWeight, goal, activityLevel = '', calorieGoal = '', restrictions = [], dislikes = '', wantedFoods = '', appliances = [], notes = '', planName, numDays = 1 } = req.body;
    const days = Math.max(1, Math.min(3, Number(numDays) || 1));
    const applianceText = appliances.length > 0 ? appliances.join(', ') : 'stovetop, oven, microwave (assume basic)';
    const dayLabels = days === 1 ? ['Today'] : Array.from({ length: days }, (_, i) => `Day ${i + 1}`);

    const prompt = `You are a certified nutritionist. Create ${days} day${days>1?'s':''} of meals (Breakfast, Lunch, Dinner, one Snack per day) as JSON. Day labels, in order: ${dayLabels.join(', ')}.

User stats:
- Current weight: ${weight || 'not provided'} lbs
- Goal weight: ${goalWeight || 'not provided'} lbs
- Goal: ${goal || 'not provided'}
- Activity level: ${activityLevel || 'not provided'}
- Daily calorie goal (if given, target this closely): ${calorieGoal || 'not specified — estimate based on the stats above'}
- Dietary restrictions: ${restrictions.length > 0 ? restrictions.join(', ') : 'none'}
- Foods to avoid: ${dislikes || 'none'}
- Foods to include: ${wantedFoods || 'none'}
- Available appliances: ${applianceText}
- Additional notes: ${notes || 'none'}

Keep it affordable and only use the listed appliances. Default to universally popular, crowd-pleasing meals unless the user requested specific foods.${days > 1 ? ' Reuse proteins and staple ingredients across the days to keep the grocery list short, but avoid repeating the same or a near-identical meal on consecutive days.' : ''}

Return ONLY valid JSON, no markdown:
{
  "daily_calories": number,
  "macros": { "protein": number, "carbs": number, "fat": number },
  "days": [{ "day": "${dayLabels[0]}", "meals": [
    { "type": "Breakfast", "name": "...", "calories": number, "protein": number, "carbs": number, "fat": number, "ingredients": ["..."], "can_substitute": true }
  ]}${days>1 ? ', { "day": "..." , "meals": [...] }' : ''}]
}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: days > 1 ? 4000 : 2000,
      messages: [{ role: 'user', content: prompt }],
    });
    let text = message.content[0].text.trim();
    text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    const plan = JSON.parse(text);
    const finalName = planName || (days === 1 ? "Today's Plan" : `${days}-Day Plan`);

    const [result] = await pool.query(
      'INSERT INTO MealPlans (user_id, name, profile, plan) VALUES (?, ?, ?, ?)',
      [req.userId, finalName, JSON.stringify(req.body), JSON.stringify(plan)]
    );
    res.json({ plan, planId: result.insertId, planName: finalName });
  } catch (err) {
    console.error(err);
    if (err.message === 'ANTHROPIC_API_KEY not set')
      return res.status(503).json({ error: 'AI meal planning not configured yet.' });
    res.status(500).json({ error: 'Failed to generate: ' + err.message });
  }
}

module.exports = {
  listPlans, getPlan, renamePlan, toggleFavorite, deletePlan, generate, regenerate, swap,
  getRecipe, getTemplates, getTemplateById, useTemplate, sharePlan, createCustom,
  generateSingleMeal, generateDayPlan,
};
