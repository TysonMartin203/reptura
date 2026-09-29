const pool = require('../config/db');

// The "major" AI features — the expensive generators. Free accounts get a few
// of each per calendar month (UTC); premium accounts are unlimited. Everything
// else that uses AI (voice logging, swaps, edits, recipe steps, exercise info)
// isn't gated at all. Change the numbers here and nowhere else.
const FEATURES = {
  meal_plan:    { label: 'AI meal plans',             free: 3 },
  workout_plan: { label: 'AI workout plans',          free: 3 },
  race_plan:    { label: 'race training plans',       free: 3 },
  food_scan:    { label: 'food photo & label scans',  free: 3 },
  voice_log:    { label: 'voice exercise entries',    free: 3 },
};

// Premium comes from either place:
//  • membership of a crew flagged grants_premium (Alpha Testers) — lasts as
//    long as the membership does, so joining gives it and leaving removes it
//  • premium_until in the future — admin grant now, a subscription later
async function getPremiumStatus(userId) {
  const [[row]] = await pool.query(
    `SELECT u.premium_until,
            (u.premium_until IS NOT NULL AND u.premium_until > UTC_TIMESTAMP()) AS granted,
            (SELECT c.name FROM CrewMembers m JOIN Crews c ON c.id = m.crew_id
              WHERE m.user_id = u.id AND c.grants_premium = 1
              ORDER BY c.id LIMIT 1) AS via_crew
     FROM Users u WHERE u.id = ?`,
    [userId]
  );
  if (!row) return { premium: false, source: null, crewName: null, premiumUntil: null };
  const granted = !!Number(row.granted);
  return {
    premium: granted || !!row.via_crew,
    // Crew wins for display — it's the reason that doesn't expire on a date.
    source: row.via_crew ? 'crew' : granted ? 'grant' : null,
    crewName: row.via_crew || null,
    premiumUntil: granted ? row.premium_until : null,
  };
}

function monthStartSql() {
  return "DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01 00:00:00')";
}

async function countUsageThisMonth(userId, feature) {
  const [[r]] = await pool.query(
    `SELECT COUNT(*) AS n FROM AiUsage WHERE user_id = ? AND feature = ? AND used_at >= ${monthStartSql()}`,
    [userId, feature]
  );
  return Number(r.n);
}

async function usageByFeatureThisMonth(userId) {
  const [rows] = await pool.query(
    `SELECT feature, COUNT(*) AS n FROM AiUsage WHERE user_id = ? AND used_at >= ${monthStartSql()} GROUP BY feature`,
    [userId]
  );
  const out = {};
  rows.forEach(r => { out[r.feature] = Number(r.n); });
  return out;
}

async function recordUsage(userId, feature) {
  await pool.query('INSERT INTO AiUsage (user_id, feature, used_at) VALUES (?, ?, UTC_TIMESTAMP())', [userId, feature]);
}

// forever: premium_until far in the future. days: that many days from now.
async function grantPremium(userId, { days } = {}) {
  if (days) {
    await pool.query('UPDATE Users SET premium_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY) WHERE id = ?', [Number(days), userId]);
  } else {
    await pool.query("UPDATE Users SET premium_until = '9999-12-31 00:00:00' WHERE id = ?", [userId]);
  }
}

// Only clears a direct grant. Crew-based premium ends when they leave the crew.
async function revokePremium(userId) {
  await pool.query('UPDATE Users SET premium_until = NULL WHERE id = ?', [userId]);
}

module.exports = {
  FEATURES, getPremiumStatus, countUsageThisMonth, usageByFeatureThisMonth,
  recordUsage, grantPremium, revokePremium,
};
