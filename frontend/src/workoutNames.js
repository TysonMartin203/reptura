// Turns a plan day's focus ("Push", "Legs", "Upper") into the name most people
// would type for that session ("Push Day", "Leg Day", "Upper Body"), so logging
// from a plan starts with the name already filled in. Still fully editable.
const SPECIAL = {
  legs: 'Leg Day',
  arms: 'Arm Day',
  shoulders: 'Shoulder Day',
  glutes: 'Glute Day',
  upper: 'Upper Body',
  lower: 'Lower Body',
  core: 'Core Day',
  abs: 'Ab Day',
  rest: '',
};

export function workoutNameFromFocus(focus) {
  const f = String(focus || '').trim();
  if (!f) return '';
  const key = f.toLowerCase();
  if (key in SPECIAL) return SPECIAL[key];
  if (/\bday\b/i.test(f)) return f;                  // already "Push Day"
  if (/full body|body|&|\+|\//i.test(f)) return f;   // "Full Body A", "Back & Biceps"
  if (!/\s/.test(f)) return `${f} Day`;              // one word: "Push" -> "Push Day"
  return f;                                          // "Easy Run", "Chest and Triceps" as-is
}
