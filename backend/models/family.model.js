const pool = require('../config/db');

async function listMembers(userId) {
  const [rows] = await pool.query(
    'SELECT id, name, age, weight, goal FROM FamilyMembers WHERE user_id = ? ORDER BY id ASC',
    [userId]
  );
  return rows;
}

async function addMember(userId, { name, age, weight, goal }) {
  const [result] = await pool.query(
    'INSERT INTO FamilyMembers (user_id, name, age, weight, goal) VALUES (?, ?, ?, ?, ?)',
    [userId, name, age || null, weight || null, goal || null]
  );
  return result.insertId;
}

async function updateMember(id, userId, { name, age, weight, goal }) {
  const [result] = await pool.query(
    'UPDATE FamilyMembers SET name = ?, age = ?, weight = ?, goal = ? WHERE id = ? AND user_id = ?',
    [name, age || null, weight || null, goal || null, id, userId]
  );
  return result.affectedRows > 0;
}

async function deleteMember(id, userId) {
  const [result] = await pool.query('DELETE FROM FamilyMembers WHERE id = ? AND user_id = ?', [id, userId]);
  return result.affectedRows > 0;
}

module.exports = { listMembers, addMember, updateMember, deleteMember };
