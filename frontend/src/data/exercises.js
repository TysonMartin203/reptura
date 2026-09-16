export const LIFTING_EXERCISES = [
  // Chest
  'Bench Press','Incline Bench Press','Decline Bench Press',
  'Dumbbell Fly','Cable Fly','Push-Up','Chest Press Machine','Pec Deck',
  // Back
  'Deadlift','Pull-Up','Chin-Up','Lat Pulldown','Barbell Row','Dumbbell Row',
  'Seated Cable Row','T-Bar Row','Face Pull','Hyperextension','Chest Supported Row',
  'Reverse Pec Deck','Rack Pull','Straight Arm Pulldown','Inverted Row','Good Morning',
  // Shoulders
  'Overhead Press','Dumbbell Shoulder Press','Arnold Press',
  'Lateral Raise','Cable Lateral Raise','Front Raise','Rear Delt Fly','Shrug','Upright Row',
  'Landmine Press',
  // Legs
  'Squat','Front Squat','Hack Squat','Leg Press','Vertical Leg Press','Lunge','Bulgarian Split Squat',
  'Romanian Deadlift','Leg Curl','Seated Leg Curl Machine','Leg Extension','Hip Thrust','Calf Raise',
  'Standing Calf Raise Machine','Seated Calf Raise Machine',
  'Sumo Deadlift','Step Up','Glute Bridge','Glute Kickback Machine',
  'Hip Abductor (Outer Thigh)','Hip Adductor (Inner Thigh)','Goblet Squat','Box Squat','Nordic Curl',
  // Arms - Biceps
  'Barbell Curl','Dumbbell Curl','Hammer Curl','Preacher Curl','Preacher Curl Machine',
  'Concentration Curl','Cable Curl','Incline Dumbbell Curl','Zottman Curl','Spider Curl',
  // Arms - Triceps
  'Tricep Pushdown','Skull Crusher','Close Grip Bench Press',
  'Overhead Tricep Extension','Dip','Assisted Dip Machine','Kickback','Diamond Push-Up','Bench Dip',
  // Core
  'Plank','Crunch','Sit-Up','Leg Raise','Russian Twist',
  'Cable Crunch','Ab Wheel','Mountain Climber','Hanging Leg Raise','Torso Rotation Machine',
  'Bicycle Crunch','Side Plank','V-Up','Flutter Kicks','Dead Bug','Pallof Press',
  // Olympic / Power
  'Clean and Jerk','Snatch','Power Clean','Power Snatch','Box Jump',
  // Bodyweight
  'Burpee','Bodyweight Squat','Jump Squat','Pistol Squat','Walking Lunge','Superman Hold',
  // Machines
  'Smith Machine Squat','Smith Machine Bench','Cable Crossover',
  'Assisted Pull-Up','Leg Press Machine','Hack Squat Machine',
].sort();

// Cardio activity definitions. Each entry describes how its "amount" is
// measured, which drives which fields show in the logging form:
//   'distance' — duration + distance + unit, pace auto-calculated
//   'laps'     — duration + lap count, pace auto-calculated (time/lap)
//   'flights'  — duration + flights of stairs climbed, no pace
//   'holes'    — duration + holes played, no pace
//   'none'     — duration only, no natural pace/quantity metric
//
// calorieMode determines how calories are auto-calculated:
//   'pace'      — MET derived from actual speed (distance/duration), most
//                 precise since it uses real data already being entered.
//                 Only meaningful for activities with a genuine, roughly
//                 linear speed-to-effort relationship.
//   'intensity' — MET picked from a Casual/Moderate/Competitive selector,
//                 same pattern as sports, used wherever pace doesn't reliably
//                 predict effort (or there's no distance measure at all).
export const CARDIO_TYPES = {
  Running:         { metric: 'distance', calorieMode: 'pace' },
  Walking:         { metric: 'distance', calorieMode: 'pace' },
  Biking:          { metric: 'distance', calorieMode: 'pace' },
  Hiking:          { metric: 'distance', calorieMode: 'intensity' },
  Rowing:          { metric: 'distance', calorieMode: 'intensity' },
  Swimming:        { metric: 'laps',     calorieMode: 'intensity' },
  'Stair Climber': { metric: 'flights',  calorieMode: 'intensity' },
  'Disc Golf':     { metric: 'holes',    calorieMode: 'intensity' },
  Elliptical:      { metric: 'none',     calorieMode: 'intensity' },
  'Jump Rope':     { metric: 'none',     calorieMode: 'intensity' },
  HIIT:            { metric: 'none',     calorieMode: 'intensity' },
  Other:           { metric: 'distance', calorieMode: 'intensity' },
};
export const CARDIO_ACTIVITIES = Object.keys(CARDIO_TYPES);

// Speed-tiered MET values for pace-based activities, sourced from the 2024
// Adult Compendium of Physical Activities. Each entry is the MET for speeds
// up to and including maxMph; speeds faster than the last tier use its MET.
const PACE_MET_TABLES = {
  Running: [
    { maxMph: 4.5, met: 6.5 }, { maxMph: 5.2, met: 8.3 }, { maxMph: 6.0, met: 9.0 },
    { maxMph: 6.7, met: 9.8 }, { maxMph: 7.5, met: 11.0 }, { maxMph: 8.6, met: 11.8 },
    { maxMph: 10.0, met: 12.8 }, { maxMph: Infinity, met: 14.5 },
  ],
  Walking: [
    { maxMph: 2.0, met: 2.0 }, { maxMph: 2.9, met: 2.8 }, { maxMph: 3.4, met: 3.5 },
    { maxMph: 3.9, met: 4.3 }, { maxMph: 4.5, met: 5.0 }, { maxMph: Infinity, met: 7.0 },
  ],
  Biking: [
    { maxMph: 10.0, met: 4.0 }, { maxMph: 11.9, met: 6.8 }, { maxMph: 13.9, met: 8.0 },
    { maxMph: 15.9, met: 10.0 }, { maxMph: 19.9, met: 12.0 }, { maxMph: Infinity, met: 15.8 },
  ],
};

// MET values for activities where pace doesn't reliably predict effort (or
// there's no distance measure at all) — same Casual/Moderate/Competitive
// pattern as sports. Sourced from the Compendium where documented; estimated
// by interpolation between its nearest documented tiers otherwise.
const CARDIO_INTENSITY_MET = {
  Hiking:          { Casual: 5.3, Moderate: 6.0, Competitive: 7.8 },
  Rowing:          { Casual: 3.5, Moderate: 7.0, Competitive: 8.5 },
  Swimming:        { Casual: 6.0, Moderate: 7.0, Competitive: 10.0 },
  'Stair Climber': { Casual: 4.0, Moderate: 8.0, Competitive: 9.7 },
  // Disc golf's exertion is really just walking between throws with pauses to
  // play each hole, so this reuses walking-pace METs rather than inventing a
  // sport-specific value: Casual = leisurely round with breaks, Moderate =
  // steady walking pace, Competitive = fast-paced tournament round with
  // little standing around.
  'Disc Golf':     { Casual: 2.8, Moderate: 3.5, Competitive: 4.3 },
  Elliptical:      { Casual: 4.6, Moderate: 5.0, Competitive: 7.0 },
  'Jump Rope':     { Casual: 8.8, Moderate: 10.0, Competitive: 12.3 },
  HIIT:            { Casual: 5.5, Moderate: 7.3, Competitive: 8.8 },
  Other:           { Casual: 4.0, Moderate: 6.0, Competitive: 8.0 },
};

function toMiles(distance, unit) {
  const n = Number(distance);
  if (!n) return null;
  if (unit === 'mi') return n;
  if (unit === 'km') return n * 0.621371;
  if (unit === 'm') return n * 0.000621371;
  if (unit === 'yd') return n * 0.000568182;
  return null;
}

function metFromSpeed(activityName, mph) {
  const table = PACE_MET_TABLES[activityName];
  if (!table || !mph) return null;
  const tier = table.find(t => mph <= t.maxMph);
  return tier ? tier.met : null;
}

// Unified calorie calculation for any cardio activity or sport. Returns
// whole-number calories, or null if there isn't enough info yet.
export function calculateCardioCalories(exerciseName, { durationMinutes, distance, distanceUnit, intensity }, weightLbs) {
  if (!durationMinutes || !weightLbs) return null;
  const weightKg = Number(weightLbs) * 0.453592;
  const hours = Number(durationMinutes) / 60;

  if (SPORT_NAMES.includes(exerciseName)) {
    const met = SPORTS[exerciseName]?.[intensity];
    return met ? Math.round(met * weightKg * hours) : null;
  }

  const type = CARDIO_TYPES[exerciseName];
  if (!type) return null;

  if (type.calorieMode === 'pace') {
    const miles = toMiles(distance, distanceUnit);
    const mph = miles ? miles / hours : null;
    const met = metFromSpeed(exerciseName, mph);
    return met ? Math.round(met * weightKg * hours) : null;
  }

  const met = CARDIO_INTENSITY_MET[exerciseName]?.[intensity];
  return met ? Math.round(met * weightKg * hours) : null;
}

// Sports get an intensity selector (Casual/Moderate/Competitive) instead of a
// distance metric, and calories are calculated from a formula rather than
// entered manually or guessed by AI — see calculateCardioCalories below.
//
// MET (Metabolic Equivalent of Task) values sourced from the Compendium of
// Physical Activities (Ainsworth et al.), the standard academic reference
// used across exercise science and most fitness apps. Where the Compendium
// doesn't document exactly three tiers for an activity, values are reasonably
// interpolated between its documented casual/recreational and competitive/
// game-play entries.
const SPORTS = {
  Basketball:         { Casual: 5.0, Moderate: 6.5, Competitive: 8.0 },
  Soccer:             { Casual: 7.0, Moderate: 8.5, Competitive: 10.0 },
  Tennis:             { Casual: 5.0, Moderate: 7.0, Competitive: 8.0 },
  Volleyball:         { Casual: 3.0, Moderate: 4.0, Competitive: 8.0 },
  Badminton:          { Casual: 4.5, Moderate: 5.5, Competitive: 7.0 },
  Golf:               { Casual: 3.5, Moderate: 4.3, Competitive: 5.0 },
  Hockey:             { Casual: 6.0, Moderate: 8.0, Competitive: 10.0 },
  'Martial Arts':     { Casual: 6.0, Moderate: 8.0, Competitive: 10.3 },
  'Table Tennis':     { Casual: 3.0, Moderate: 4.0, Competitive: 6.0 },
  Squash:             { Casual: 6.0, Moderate: 7.3, Competitive: 12.0 },
  Football:           { Casual: 6.0, Moderate: 8.0, Competitive: 9.0 },
  Baseball:           { Casual: 4.0, Moderate: 5.0, Competitive: 6.0 },
  Boxing:             { Casual: 6.0, Moderate: 9.0, Competitive: 12.3 },
  'Ultimate Frisbee':  { Casual: 3.0, Moderate: 5.0, Competitive: 8.0 },
  'Rock Climbing':    { Casual: 5.8, Moderate: 7.5, Competitive: 11.0 },
  Pickleball:         { Casual: 4.5, Moderate: 5.5, Competitive: 7.0 },
  Rugby:              { Casual: 8.0, Moderate: 9.0, Competitive: 10.0 },
  Cricket:            { Casual: 4.8, Moderate: 5.5, Competitive: 7.0 },
};
export const SPORT_NAMES = Object.keys(SPORTS);
export const INTENSITY_LEVELS = ['Casual', 'Moderate', 'Competitive'];

// Every name the cardio activity picker can recognize, for matching saved
// exercise names back to the right dropdown option (e.g. when editing).
export const ALL_CARDIO_NAMES = [...CARDIO_ACTIVITIES, ...SPORT_NAMES];

// Formats seconds-per-unit as M:SS, e.g. 512 -> "8:32"
export function formatPace(secondsPerUnit) {
  if (!secondsPerUnit || !isFinite(secondsPerUnit) || secondsPerUnit <= 0) return null;
  const m = Math.floor(secondsPerUnit / 60);
  const s = Math.round(secondsPerUnit % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const DISTANCE_UNITS = ['mi', 'km', 'm', 'yd'];
