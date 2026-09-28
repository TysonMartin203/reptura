const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../config/db');
const { createUser, findByEmail, findByUsername } = require('../models/user.model');
const { grantPremium, revokePremium } = require('../models/premium.model');

async function listUsers(req, res) {
  try {
    let rows;
    try {
      // Premium columns — see MIGRATION_minor_v26.
      [rows] = await pool.query(
        `SELECT u.id, u.username, u.email, u.is_admin, u.google_id IS NOT NULL AS has_google,
                u.password_hash IS NULL AS needs_password, u.created_at,
                (u.premium_until IS NOT NULL AND u.premium_until > UTC_TIMESTAMP()) AS premium_granted,
                u.premium_until,
                (SELECT c.name FROM CrewMembers m JOIN Crews c ON c.id = m.crew_id
                  WHERE m.user_id = u.id AND c.grants_premium = 1 ORDER BY c.id LIMIT 1) AS premium_crew
         FROM Users u ORDER BY u.created_at DESC`
      );
    } catch {
      // Migration not run yet — still show the list, just without premium info.
      [rows] = await pool.query(
        `SELECT id, username, email, is_admin, google_id IS NOT NULL AS has_google,
                password_hash IS NULL AS needs_password, created_at
         FROM Users ORDER BY created_at DESC`
      );
    }
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function createAccount(req, res) {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: 'username, email, and password required' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (await findByEmail(email)) return res.status(409).json({ error: 'Email already in use' });
    if (await findByUsername(username)) return res.status(409).json({ error: 'Username already in use' });
    const id = await createUser({ username, email, password });
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function deleteAccount(req, res) {
  try {
    const targetId = Number(req.params.id);
    if (targetId === req.userId) return res.status(400).json({ error: "You can't delete your own account from here." });
    const [result] = await pool.query('DELETE FROM Users WHERE id = ?', [targetId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// Clears the password so the account holder is prompted to set a new one next
// time they try to log in (see auth.controller's login for that flow).
// Characters chosen to avoid visual ambiguity (no 0/O, 1/l/I) since this gets
// read aloud or typed by hand from wherever the admin relays it.
const TEMP_PW_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
function generateTempPassword(length = 10) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, b => TEMP_PW_CHARS[b % TEMP_PW_CHARS.length]).join('');
}

async function resetUserPassword(req, res) {
  try {
    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, 12);
    const [result] = await pool.query(
      'UPDATE Users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      [hash, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    // This is the only moment the plaintext password exists — it's never stored
    // or retrievable again, so the admin needs to relay it to the person now.
    res.json({ success: true, tempPassword });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function listCrews(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, u.username AS creator_username,
              (SELECT COUNT(*) FROM CrewMembers cm WHERE cm.crew_id = c.id) AS member_count
       FROM Crews c LEFT JOIN Users u ON u.id = c.created_by
       ORDER BY c.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// A user's workouts for support purposes — deliberately excludes progress
// photos, which stay private even to admins.
async function userWorkouts(req, res) {
  try {
    const [workouts] = await pool.query(
      'SELECT id, date, name, notes_before, notes_after FROM Workouts WHERE user_id = ? ORDER BY date DESC LIMIT 100',
      [req.params.id]
    );
    if (workouts.length) {
      const ids = workouts.map(w => w.id);
      const [exercises] = await pool.query(
        `SELECT * FROM WorkoutExercises WHERE workout_id IN (${ids.map(() => '?').join(',')}) ORDER BY order_index ASC`,
        ids
      );
      workouts.forEach(w => { w.exercises = exercises.filter(e => e.workout_id === w.id); });
    }
    res.json(workouts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// body: { days } for a limited grant, or nothing for no end date.
async function setUserPremium(req, res) {
  try {
    const days = req.body?.days ? Number(req.body.days) : null;
    if (days != null && (!Number.isFinite(days) || days <= 0 || days > 3650))
      return res.status(400).json({ error: 'Days must be between 1 and 3650' });
    await grantPremium(req.params.id, { days });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

// Clears a direct grant only. Premium that comes from a crew stays until the
// person leaves that crew (or the crew stops granting it).
async function clearUserPremium(req, res) {
  try {
    await revokePremium(req.params.id);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

// The two crew switches: auto_join (new signups join automatically) and
// grants_premium (members are premium). Turning auto_join off on Alpha Testers
// is how new signups start landing on the free plan.
async function updateCrewFlags(req, res) {
  try {
    const sets = [], vals = [];
    for (const key of ['auto_join', 'grants_premium']) {
      if (typeof req.body?.[key] === 'boolean') { sets.push(`${key} = ?`); vals.push(req.body[key] ? 1 : 0); }
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    const [r] = await pool.query(`UPDATE Crews SET ${sets.join(', ')} WHERE id = ?`, [...vals, req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Crew not found' });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

module.exports = { listUsers, createAccount, deleteAccount, resetUserPassword, listCrews, userWorkouts, setUserPremium, clearUserPremium, updateCrewFlags };
