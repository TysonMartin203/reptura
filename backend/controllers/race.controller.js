const Anthropic = require('@anthropic-ai/sdk');
const { createRacePlan, listRacePlans, getRacePlan, deleteRacePlan } = require('../models/race.model');
const { getProfile, saveProfile } = require('../models/profile.model');
const { buildStatsBlock } = require('../data/prompt-helpers');

// Single source of truth for supported races — the frontend reads this list
// from GET /options rather than keeping its own copy.
const RACES = {
  '5K':                     { disciplines: ['run'],                typicalWeeks: 8,  taperWeeks: 1 },
  '10K':                    { disciplines: ['run'],                typicalWeeks: 10, taperWeeks: 1 },
  'Half Marathon':          { disciplines: ['run'],                typicalWeeks: 12, taperWeeks: 1 },
  'Marathon':               { disciplines: ['run'],                typicalWeeks: 18, taperWeeks: 2 },
  'Sprint Triathlon':       { disciplines: ['swim', 'bike', 'run'], typicalWeeks: 10, taperWeeks: 1 },
  'Olympic Triathlon':      { disciplines: ['swim', 'bike', 'run'], typicalWeeks: 12, taperWeeks: 1 },
  'Half Ironman (70.3)':    { disciplines: ['swim', 'bike', 'run'], typicalWeeks: 20, taperWeeks: 2 },
  'Ironman':                { disciplines: ['swim', 'bike', 'run'], typicalWeeks: 26, taperWeeks: 3 },
  'Metric Century (62 mi)': { disciplines: ['bike'],               typicalWeeks: 8,  taperWeeks: 1 },
  'Century Ride (100 mi)':  { disciplines: ['bike'],               typicalWeeks: 12, taperWeeks: 1 },
  '1 Mile Open Water Swim': { disciplines: ['swim'],               typicalWeeks: 8,  taperWeeks: 1 },
};
const MAX_WEEKS = 30;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  // Long timeout on purpose: a 30-week Ironman plan is a large generation.
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 300_000 });
}

// Dates are handled as plain UTC calendar days so a server timezone can never
// shift a race onto the wrong weekday.
function parseDay(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return null;
  const d = new Date(s + 'T00:00:00Z');
  return isNaN(d) ? null : d;
}
function fmt(d) { return d.toISOString().slice(0, 10); }
function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }
function mondayOf(d) { return addDays(d, -((d.getUTCDay() + 6) % 7)); }

function options(req, res) {
  res.json({
    races: Object.entries(RACES).map(([name, r]) => ({ name, disciplines: r.disciplines, typicalWeeks: r.typicalWeeks })),
    maxWeeks: MAX_WEEKS,
  });
}

async function list(req, res) {
  try { res.json({ plans: await listRacePlans(req.userId) }); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

async function get(req, res) {
  try {
    const plan = await getRacePlan(req.params.id, req.userId);
    if (!plan) return res.status(404).json({ error: 'Not found' });
    res.json({ plan });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

async function remove(req, res) {
  try {
    if (!(await deleteRacePlan(req.params.id, req.userId))) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

async function generate(req, res) {
  try {
    const { raceType, raceName, raceDate, startDate, distanceUnit = 'mi', fitness = {} } = req.body;
    const race = RACES[raceType];
    if (!race) return res.status(400).json({ error: 'Pick a race type' });

    const raceDay = parseDay(raceDate);
    let startDay = parseDay(startDate);
    if (!raceDay || !startDay) return res.status(400).json({ error: 'Enter a valid start date and race date' });
    if (raceDay <= startDay) return res.status(400).json({ error: 'Race date must be after your start date' });

    // Weeks are calendar weeks (Mon–Sun) so every session maps to one real date.
    let totalWeeks = Math.round((mondayOf(raceDay) - mondayOf(startDay)) / (7 * 86400000)) + 1;
    let cappedNote = '';
    if (totalWeeks > MAX_WEEKS) {
      startDay = addDays(mondayOf(raceDay), -(MAX_WEEKS - 1) * 7);
      totalWeeks = MAX_WEEKS;
      cappedNote = `The race is over ${MAX_WEEKS} weeks out, so this plan covers the final ${MAX_WEEKS} weeks starting ${fmt(startDay)}. Until then, keep up easy base training.`;
    }
    const compressed = totalWeeks < Math.ceil(race.typicalWeeks * 0.6);

    // Save their starting-fitness answers to their profile so the form is
    // prefilled next time and other AI features can use them.
    const profile = (await getProfile(req.userId)) || {};
    await saveProfile(req.userId, { ...profile, raceFitness: fitness });

    const isTri = race.disciplines.length > 1;
    const unit = distanceUnit === 'km' ? 'km' : 'mi';
    const f = fitness;

    // Days/week accepts 0–7, where 0 (or anything out of range) means the athlete
    // hasn't picked a number and the coach sets the frequency. Training 1–2 days
    // for a long race is legitimate but tight, so the plan is told to protect the
    // sessions that matter instead of thinning everything out evenly.
    const days = Number(f.daysPerWeek);
    const setDays = Number.isInteger(days) && days >= 1 && days <= 7;
    const frequencyRule = setDays
      ? `Train exactly ${days} day${days === 1 ? '' : 's'}/week`
      : 'Choose the weekly training frequency yourself — start from their current fitness and build gradually';
    const lowVolumeNote = setDays && days <= 2
      ? `\n- Only ${days} session${days === 1 ? '' : 's'} a week is a low volume for a ${raceType}: make every session count (keep the long session and one quality session), and be honest in the summary about what this frequency can realistically deliver.`
      : '';
    const fitnessLines = [
      f.experience && `Experience: ${f.experience}`,
      f.goalType === 'Time goal' && f.goalTime ? `Goal: finish in ${f.goalTime}` : 'Goal: finish strong and healthy',
      f.recentRace && `Recent race result: ${f.recentRace}`,
      race.disciplines.includes('run')  && f.runWeekly    && `Current running: ${f.runWeekly} ${unit}/wk`,
      race.disciplines.includes('run')  && f.runLongest   && `Longest recent run: ${f.runLongest} ${unit}`,
      race.disciplines.includes('bike') && f.bikeWeekly   && `Current riding: ${f.bikeWeekly} ${unit}/wk`,
      race.disciplines.includes('bike') && f.bikeLongest  && `Longest recent ride: ${f.bikeLongest} ${unit}`,
      race.disciplines.includes('swim') && f.swimComfort  && `Swimming: ${f.swimComfort}`,
      race.disciplines.includes('swim') && f.swimLongest  && `Longest continuous swim: ${f.swimLongest} ${unit === 'km' ? 'm' : 'yd'}`,
      f.notes && `Injuries/notes: ${f.notes}`,
    ].filter(Boolean).map(l => `- ${l}`).join('\n');

    const prompt = `You are an expert endurance coach. Build a ${raceType} training plan as JSON.

Race: ${raceType}${raceName ? ` (${raceName})` : ''} on ${DAY_NAMES[raceDay.getUTCDay()]} ${fmt(raceDay)}.
Plan: ${totalWeeks} calendar weeks (Mon-Sun). Week 1 starts ${DAY_NAMES[startDay.getUTCDay()]} ${fmt(startDay)} — no sessions before that day. The final week ends with the race on ${DAY_NAMES[raceDay.getUTCDay()]}; nothing after it.${compressed ? `\nThis is a short timeline for a ${raceType} (typical is ${race.typicalWeeks} weeks) — prioritize finishing safely over speed, and progress conservatively.` : ''}

Athlete:
${buildStatsBlock(profile)}
${fitnessLines}

Rules:
- ${frequencyRule}; long session on ${f.longDay || 'Sat'}. Omit rest days.${lowVolumeNote}
- Build volume gradually (max ~10%/wk) with a lighter recovery week every 3-4 weeks, then a ${race.taperWeeks}-week taper.
- Phases: Base, Build, Peak, Taper (fewer if the plan is short).
- Run/bike distances in ${unit}; swims in ${unit === 'km' ? 'meters' : 'yards'}.${isTri ? '\n- Include brick sessions (bike straight into a short run) in Build and Peak.' : ''}
- Work around any injuries listed.
- "detail" under 60 chars: distance/time + intensity, e.g. "5 mi easy, conversational" or "6x800m @ 10K pace, 2 min jog".

Return ONLY JSON, no markdown:
{"summary":"2-3 sentences","weeks":[{"w":1,"phase":"Base","focus":"under 40 chars","s":[["Mon","run","Easy Run","3 mi easy",30]]}]}
Session = [day, sport, title, detail, minutes]. day: Mon-Sun. sport: run|bike|swim|brick|strength|race. The last session of the last week is the race itself, sport "race".`;

    const message = await getClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }],
    });
    if (message.stop_reason === 'max_tokens') {
      return res.status(502).json({ error: 'That plan came out too long to finish — try a later start date or fewer training days.' });
    }

    const text = message.content[0].text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
    const plan = JSON.parse(text);
    if (!Array.isArray(plan.weeks) || !plan.weeks.length) throw new Error('Plan came back empty');
    plan.cappedNote = cappedNote || undefined;

    const id = await createRacePlan(req.userId, {
      raceType, raceName, raceDate: fmt(raceDay), startDate: fmt(startDay), inputs: { ...fitness, distanceUnit: unit }, plan,
    });
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    if (err.message === 'ANTHROPIC_API_KEY not set') return res.status(503).json({ error: 'AI planning not configured yet.' });
    if (err?.status === 429) return res.status(429).json({ error: "We're getting a lot of requests right now — please try again in a moment." });
    res.status(500).json({ error: 'Could not build that plan — please try again.' });
  }
}

module.exports = { options, list, get, remove, generate };
