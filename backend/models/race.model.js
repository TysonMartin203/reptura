const pool = require('../config/db');

async function createRacePlan(userId, { raceType, raceName, raceDate, startDate, inputs, plan }) {
  const [r] = await pool.query(
    `INSERT INTO RaceTrainingPlans (user_id, race_type, race_name, race_date, start_date, inputs, plan)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, raceType, raceName || null, raceDate, startDate, JSON.stringify(inputs || {}), JSON.stringify(plan)]
  );
  return r.insertId;
}

async function listRacePlans(userId) {
  const [rows] = await pool.query(
    `SELECT id, race_type, race_name, race_date, start_date, created_at
     FROM RaceTrainingPlans WHERE user_id = ? ORDER BY race_date ASC`,
    [userId]
  );
  return rows;
}

async function getRacePlan(id, userId) {
  const [[row]] = await pool.query('SELECT * FROM RaceTrainingPlans WHERE id = ? AND user_id = ?', [id, userId]);
  if (!row) return null;
  const parse = v => (typeof v === 'string' ? JSON.parse(v) : v);
  return { ...row, inputs: parse(row.inputs), plan: parse(row.plan) };
}

async function deleteRacePlan(id, userId) {
  const [r] = await pool.query('DELETE FROM RaceTrainingPlans WHERE id = ? AND user_id = ?', [id, userId]);
  return r.affectedRows > 0;
}

module.exports = { createRacePlan, listRacePlans, getRacePlan, deleteRacePlan };
