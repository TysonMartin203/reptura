const { logMeal, updateMeal, getMealsForDate, getMealHistory, deleteMeal, getDailyTotals, getCaloriesBurned, deleteIngredient, moveIngredient } = require('../models/meallog.model');
const { getProfile } = require('../models/profile.model');
const Anthropic = require('@anthropic-ai/sdk');

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

function cleanIngredientsList(ingredients) {
  return Array.isArray(ingredients)
    ? ingredients.filter(i => i && i.name && i.name.trim()).map(i => ({
        name: i.name.trim().slice(0, 200),
        calories: i.calories ?? null, protein: i.protein ?? null, carbs: i.carbs ?? null, fat: i.fat ?? null,
      }))
    : null;
}

async function create(req, res) {
  try {
    const { date, mealType, name, calories, protein, carbs, fat, notes, ingredients } = req.body;
    if (!date || !mealType || !name?.trim()) return res.status(400).json({ error: 'date, mealType, and name are required' });
    if (!MEAL_TYPES.includes(mealType)) return res.status(400).json({ error: 'Invalid meal type' });
    const cleanIngredients = cleanIngredientsList(ingredients);
    // Matches the LoggedMeals.name column width — a scanned meal with several
    // ingredients can otherwise exceed it and fail the insert entirely.
    const safeName = name.trim().slice(0, 500);
    const id = await logMeal({ userId: req.userId, date, mealType, name: safeName, calories, protein, carbs, fat, notes, ingredients: cleanIngredients?.length ? cleanIngredients : null });
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function update(req, res) {
  try {
    const { date, mealType, name, calories, protein, carbs, fat, notes, ingredients } = req.body;
    if (!date || !mealType || !name?.trim()) return res.status(400).json({ error: 'date, mealType, and name are required' });
    if (!MEAL_TYPES.includes(mealType)) return res.status(400).json({ error: 'Invalid meal type' });
    const cleanIngredients = cleanIngredientsList(ingredients);
    const safeName = name.trim().slice(0, 500);
    const id = await updateMeal(req.params.id, req.userId, { date, mealType, name: safeName, calories, protein, carbs, fat, notes, ingredients: cleanIngredients?.length ? cleanIngredients : null });
    if (!id) return res.status(404).json({ error: 'Not found' });
    res.json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function listForDate(req, res) {
  try {
    const date = req.query.date;
    if (!date) return res.status(400).json({ error: 'date query param required' });
    const [meals, totals, caloriesBurned] = await Promise.all([
      getMealsForDate(req.userId, date),
      getDailyTotals(req.userId, date),
      getCaloriesBurned(req.userId, date),
    ]);
    res.json({ meals, totals: { ...totals, caloriesBurned } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function history(req, res) {
  try {
    res.json(await getMealHistory(req.userId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function remove(req, res) {
  try {
    const ok = await deleteMeal(req.params.id, req.userId);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// Identify a food photo and estimate calories/macros. The photo itself is never
// saved — only used for this one-time recognition — so no upload/storage plumbing needed.
async function recognize(req, res) {
  try {
    const photo = req.files?.photo?.[0];
    const photo2 = req.files?.photo2?.[0];
    if (!photo) return res.status(400).json({ error: 'No photo provided' });
    const client = getClient();

    const restaurant = (req.body?.restaurant || '').trim().slice(0, 100);

    const profile = await getProfile(req.userId).catch(() => null);
    const palmWidth = profile?.palmWidth || null;

    const scaleNote = palmWidth
      ? `The user's palm width (straight across, not including thumb) is ${palmWidth} inches. If a hand is visible in a photo, use it as a precise scale reference.`
      : `The user hasn't recorded their palm width. If a hand is visible, assume an average adult palm width of about 3.5 inches as a rough scale reference.`;

    const restaurantNote = restaurant
      ? `The user says this is from ${restaurant}. Treat this as reliable — draw directly on your knowledge of ${restaurant}'s actual published nutrition information for the specific menu item(s) shown, matching size/style as closely as you can tell from the photo (e.g. small/medium/large, regular vs. double, which sides or sauces), rather than estimating from portion appearance alone. Chain nutrition data is exact, and this is far more accurate than a visual guess — use it as your primary source and only fall back to visual estimation for anything not on their published menu (e.g. a modified order, an item they clearly customized, or a side you can't identify).`
      : `Look for visual cues that this might be fast food or a chain restaurant item — distinctive packaging, wrappers, boxes, cups, trays, or branding visible in the photo. If you recognize a specific chain and menu item with reasonable confidence, use your knowledge of that chain's actual published nutrition data for that item (matching size as closely as you can tell) instead of estimating from portion size — this is significantly more accurate than a visual guess for standardized fast-food items. Only fall back to portion-based estimation for homemade or non-chain food, or if you can't identify the specific chain/item with real confidence.`;

    const angleNote = photo2
      ? `You've been given TWO photos of the same meal from different angles (e.g. one from above, one from the side). Use both together — a single photo can't show how tall or deep a pile of food is, so cross-reference the two to judge portion volume much more accurately than either photo alone would allow. If the photos disagree on something, trust whichever view shows that specific detail more clearly rather than averaging blindly.`
      : `Only one photo was provided. Note that a single 2D photo can't fully show portion depth/height — lean more on stable references (plate/bowl size, hand if visible) than on pile height or shading, which are the least reliable cues from a single angle and vary a lot with camera angle.`;

    const prompt = `You are an experienced dietitian estimating a meal's nutrition from ${photo2 ? 'photos' : 'a photo'}. Work through this carefully — accuracy matters more than speed.

${scaleNote} Other useful size references if visible: a standard dinner plate is ~10-11 inches across, a standard bowl holds ~16-20oz, a fist is roughly 1 cup, a deck-of-cards-sized portion of meat is ~3-4oz, a thumb is roughly 1oz of cheese or fat.

${restaurantNote}

${angleNote}

Steps:
1. Identify each distinct food/ingredient visible separately — don't lump them into one guess.
2. First check: is this a recognizable fast-food or chain-restaurant item (per the note above)? If so, prioritize that chain's real published nutrition numbers for the closest-matching menu item and size over visual portion estimation — this step comes before any visual size guessing, since it's far more accurate when it applies.
3. For anything not covered by known chain data (homemade food, non-chain restaurants, or items you can't confidently identify), estimate portion size using the visual scale references above, prioritizing stable references (plate/bowl diameter, hand) over depth-dependent cues (pile height, shading) that shift with camera angle.
4. Consider preparation method from visual cues (fried vs. baked vs. steamed, visible oil sheen, breading, cheese, sauce, dressing) — these are a major source of underestimated calories in photo-based tracking, since oil and dressing are often invisible or hard to judge but calorically dense. If the food looks like it was cooked with oil/butter or has a sauce/dressing, factor that in even though you can't see the exact amount.
5. Estimate calories and macros for each item individually, then sum them for the totals.
6. Note any meaningful assumptions or uncertainty (e.g. "assumed steamed, not roasted with oil", "used [Chain]'s published values for a medium order", or "sauce could add 100-200 cal if creamy rather than vinegar-based") so the user can adjust if you guessed wrong.

Return ONLY valid JSON, no markdown, in this exact structure:
{
  "name": "short combined description for display, e.g. 'Grilled chicken breast with rice and broccoli'",
  "items": [
    { "item": "e.g. Grilled chicken breast", "portion": "e.g. ~6oz, estimated from plate size", "calories": number, "protein": number, "carbs": number, "fat": number }
  ],
  "calories": number (sum of items),
  "protein": number (grams, sum of items),
  "carbs": number (grams, sum of items),
  "fat": number (grams, sum of items),
  "confidence": "high" | "medium" | "low",
  "notes": "1-2 sentences on key assumptions or what could shift the estimate, or empty string if nothing notable"
}

Give your best reasonable estimate rather than refusing, even when uncertain — that's the whole point of this tool. Use "low" confidence honestly when the dish is complex, mixed, or heavily sauced rather than defaulting to "medium". A confidently-identified chain/fast-food item matched to real published nutrition data should get "high" confidence, since that's an exact figure rather than a visual guess.`;

    const imageContent = [
      { type: 'image', source: { type: 'base64', media_type: photo.mimetype, data: photo.buffer.toString('base64') } },
    ];
    if (photo2) {
      imageContent.push({ type: 'image', source: { type: 'base64', media_type: photo2.mimetype, data: photo2.buffer.toString('base64') } });
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      // Low temperature so scanning the same photo(s) twice gives the same
      // estimate — this is a numeric estimation task, not creative writing,
      // so we want the model's most consistent reasoning, not varied ones.
      temperature: 0,
      messages: [{
        role: 'user',
        content: [...imageContent, { type: 'text', text: prompt }],
      }],
    });

    let text = message.content[0].text.trim();
    text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    const result = JSON.parse(text);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not read that photo: ' + err.message });
  }
}

// Reading a printed Nutrition Facts label gives exact per-serving numbers
// rather than a visual estimate — far more precise than photographing the
// food itself when a label is available. The person then picks how many
// servings they actually had (or "the whole thing") and the frontend scales
// the per-serving numbers accordingly, so the AI only has to do the one
// exact-transcription job it's good at, not a fresh estimate every time.
async function recognizeLabel(req, res) {
  try {
    const photo = req.files?.photo?.[0];
    if (!photo) return res.status(400).json({ error: 'No photo provided' });
    const client = getClient();

    const prompt = `You are reading a printed Nutrition Facts label from a photo. Transcribe the exact values printed on the label — this is a transcription task, not an estimate, so read the numbers precisely rather than rounding or guessing.

Return ONLY valid JSON, no markdown, in this exact structure:
{
  "name": "product name if visible on the label or packaging, else \\"Scanned Item\\"",
  "servingSize": "the serving size exactly as printed, e.g. '1 cup (240ml)' or '2 cookies (30g)'",
  "servingsPerContainer": number or null if not stated on the label,
  "caloriesPerServing": number,
  "proteinPerServing": number (grams),
  "carbsPerServing": number (grams),
  "fatPerServing": number (grams)
}

If any value isn't legible or isn't on the label, use your best judgment for a similar product rather than leaving it blank, but note the name should still reflect it's from a label. If this doesn't look like a nutrition label at all, still return your best-effort reading of whatever nutrition information is visible.`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      temperature: 0,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: photo.mimetype, data: photo.buffer.toString('base64') } },
          { type: 'text', text: prompt },
        ],
      }],
    });

    let text = message.content[0].text.trim();
    text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    const result = JSON.parse(text);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not read that label: ' + err.message });
  }
}

// Parse a spoken description of a meal into structured fields — reuses the
// same "estimate, don't refuse" approach as the photo recognizer, just from text.
async function parseVoice(req, res) {
  try {
    const { transcript } = req.body;
    if (!transcript?.trim()) return res.status(400).json({ error: 'No transcript provided' });
    const client = getClient();

    const prompt = `The user spoke this description of a meal they ate: "${transcript.trim()}"

Turn it into structured nutrition data. If they described multiple distinct foods, break them into separate items rather than one lump estimate. Return ONLY valid JSON, no markdown, in this exact structure:
{
  "name": "short combined description of the food",
  "mealType": "Breakfast" | "Lunch" | "Dinner" | "Snack" (guess based on context, default "Snack" if unclear),
  "items": [
    { "item": "e.g. Grilled chicken breast", "calories": number, "protein": number, "carbs": number, "fat": number }
  ],
  "calories": number (sum of items),
  "protein": number (grams, sum of items),
  "carbs": number (grams, sum of items),
  "fat": number (grams, sum of items)
}

Give your best reasonable estimate rather than refusing, even if the description is vague or casual.`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });

    let text = message.content[0].text.trim();
    text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    res.json(JSON.parse(text));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not parse that: ' + err.message });
  }
}

async function removeIngredient(req, res) {
  try {
    const result = await deleteIngredient(req.params.id, req.userId, Number(req.params.index));
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function relocateIngredient(req, res) {
  try {
    const { date, mealType } = req.body;
    const MEAL_TYPES_LOCAL = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    if (!date || !mealType || !MEAL_TYPES_LOCAL.includes(mealType)) return res.status(400).json({ error: 'date and a valid mealType are required' });
    const result = await moveIngredient(req.params.id, req.userId, Number(req.params.index), date, mealType);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { create, update, listForDate, history, remove, recognize, recognizeLabel, parseVoice, removeIngredient, relocateIngredient };
