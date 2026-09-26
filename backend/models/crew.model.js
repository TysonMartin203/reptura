const pool = require('../config/db');
const { areFriends } = require('./friend.model');
const { createNotification } = require('./notification.model');
const { sendPushToUser } = require('./push.model');
const { findById } = require('./user.model');

async function createCrew(userId, name) {
  const [result] = await pool.query('INSERT INTO Crews (name, created_by) VALUES (?, ?)', [name, userId]);
  await pool.query('INSERT INTO CrewMembers (crew_id, user_id) VALUES (?, ?)', [result.insertId, userId]);
  return result.insertId;
}

async function getMyCrews(userId) {
  const [rows] = await pool.query(
    `SELECT c.id, c.name, c.created_by, c.created_at, COUNT(cm2.user_id) AS member_count
     FROM Crews c
     JOIN CrewMembers cm ON cm.crew_id = c.id AND cm.user_id = ?
     JOIN CrewMembers cm2 ON cm2.crew_id = c.id
     GROUP BY c.id
     ORDER BY c.created_at DESC`,
    [userId]
  );
  return rows;
}

async function isCrewMember(crewId, userId) {
  const [rows] = await pool.query('SELECT 1 FROM CrewMembers WHERE crew_id = ? AND user_id = ?', [crewId, userId]);
  return rows.length > 0;
}

async function getCrew(crewId, userId) {
  if (!(await isCrewMember(crewId, userId))) return null;
  const [[crew]] = await pool.query('SELECT * FROM Crews WHERE id = ?', [crewId]);
  if (!crew) return null;
  const [members] = await pool.query(
    `SELECT u.id, u.username FROM CrewMembers cm JOIN Users u ON u.id = cm.user_id WHERE cm.crew_id = ?`,
    [crewId]
  );
  return { ...crew, members };
}

// Sends an invite instead of adding directly — the friend must accept it.
async function inviteMember(crewId, requesterId, friendId) {
  if (!(await isCrewMember(crewId, requesterId))) throw Object.assign(new Error('Not a member'), { status: 403 });
  const friends = await areFriends(requesterId, friendId);
  if (!friends) throw Object.assign(new Error('Can only invite friends to a crew'), { status: 400 });
  if (await isCrewMember(crewId, friendId)) throw Object.assign(new Error('Already a member'), { status: 400 });

  const [[existing]] = await pool.query(
    `SELECT id FROM CrewInvites WHERE crew_id = ? AND invitee_id = ? AND status = 'pending'`,
    [crewId, friendId]
  );
  if (existing) return existing.id;

  const [result] = await pool.query(
    'INSERT INTO CrewInvites (crew_id, inviter_id, invitee_id) VALUES (?, ?, ?)',
    [crewId, requesterId, friendId]
  );
  const [[crew]] = await pool.query('SELECT name FROM Crews WHERE id = ?', [crewId]);
  const inviter = await findById(requesterId);
  await createNotification({
    userId: friendId, type: 'crew_invite',
    title: `${inviter?.username || 'A friend'} invited you to a crew`,
    body: crew?.name || 'Join their crew',
    data: { inviteId: result.insertId, crewId },
  });
  sendPushToUser(friendId, {
    title: 'Crew invite',
    body: `${inviter?.username || 'A friend'} invited you to join "${crew?.name}"`,
    data: { type: 'crew_invite', inviteId: result.insertId },
  }).catch(err => console.error('Push failed:', err));

  return result.insertId;
}

async function getCrewInvites(userId) {
  const [rows] = await pool.query(
    `SELECT ci.*, c.name AS crew_name, u.username AS inviter_username
     FROM CrewInvites ci
     JOIN Crews c ON c.id = ci.crew_id
     JOIN Users u ON u.id = ci.inviter_id
     WHERE ci.invitee_id = ? AND ci.status = 'pending'
     ORDER BY ci.created_at DESC`,
    [userId]
  );
  return rows;
}

async function respondCrewInvite(inviteId, userId, accept) {
  const [[invite]] = await pool.query(
    `SELECT * FROM CrewInvites WHERE id = ? AND invitee_id = ? AND status = 'pending'`,
    [inviteId, userId]
  );
  if (!invite) throw Object.assign(new Error('Not found'), { status: 404 });

  await pool.query('UPDATE CrewInvites SET status = ? WHERE id = ?', [accept ? 'accepted' : 'declined', inviteId]);
  if (accept) {
    await pool.query('INSERT IGNORE INTO CrewMembers (crew_id, user_id) VALUES (?, ?)', [invite.crew_id, userId]);
  }
  return invite.crew_id;
}

async function getMessages(crewId, userId) {
  if (!(await isCrewMember(crewId, userId))) throw Object.assign(new Error('Not a member'), { status: 403 });
  const [rows] = await pool.query(
    `SELECT cm.*, u.username FROM CrewMessages cm JOIN Users u ON u.id = cm.user_id
     WHERE cm.crew_id = ? ORDER BY cm.created_at ASC LIMIT 200`,
    [crewId]
  );
  return rows;
}

async function sendMessage(crewId, userId, message) {
  if (!(await isCrewMember(crewId, userId))) throw Object.assign(new Error('Not a member'), { status: 403 });
  const [result] = await pool.query(
    'INSERT INTO CrewMessages (crew_id, user_id, message) VALUES (?, ?, ?)',
    [crewId, userId, message]
  );
  return result.insertId;
}

// Only the creator can delete. Members, messages and invites all cascade off
// the crew_id foreign key, so removing the Crews row clears the rest.
async function deleteCrew(crewId, userId) {
  const [[crew]] = await pool.query('SELECT created_by FROM Crews WHERE id = ?', [crewId]);
  if (!crew) throw Object.assign(new Error('Not found'), { status: 404 });
  if (crew.created_by !== userId)
    throw Object.assign(new Error('Only the person who created this crew can delete it'), { status: 403 });
  await pool.query('DELETE FROM Crews WHERE id = ?', [crewId]);
}

// Crews flagged auto_join take every new account automatically — that's how the
// Alpha Testers crew keeps up as people sign up. Best-effort by design: the
// caller must not let a failure here block a registration.
async function addToAutoJoinCrews(userId) {
  await pool.query(
    'INSERT IGNORE INTO CrewMembers (crew_id, user_id) SELECT id, ? FROM Crews WHERE auto_join = 1',
    [userId]
  );
}

module.exports = {
  createCrew, getMyCrews, getCrew, inviteMember, getCrewInvites, respondCrewInvite,
  getMessages, sendMessage, deleteCrew, addToAutoJoinCrews,
};
