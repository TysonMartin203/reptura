const jwt    = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool   = require('../config/db');
const { OAuth2Client } = require('google-auth-library');
const { sendPasswordResetEmail } = require('../config/email');
const {
  createUser, findByEmail, findByUsername, findByGoogleId, linkGoogleId, createGoogleUser,
} = require('../models/user.model');

const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

function issueSession(res, user, extra = {}) {
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({
    token, userId: user.id, username: user.username, email: user.email,
    avatarUrl: user.avatar_url || null, theme: user.theme || 'light',
    bio: user.bio || null,
    notifyBuzz: user.notify_buzz == null ? true : !!user.notify_buzz,
    notifyMessages: user.notify_messages == null ? true : !!user.notify_messages,
    notifyReactions: user.notify_reactions == null ? true : !!user.notify_reactions,
    notifyFriendRequests: user.notify_friend_requests == null ? true : !!user.notify_friend_requests,
    notifyInvites: user.notify_invites == null ? true : !!user.notify_invites,
    weightUnit: user.weight_unit || 'lbs',
    distanceUnit: user.distance_unit || 'mi',
    tutorialDone: !!user.tutorial_done,
    isAdmin: !!user.is_admin,
    ...extra,
  });
}

async function googleAuth(req, res) {
  try {
    if (!googleClient) return res.status(503).json({ error: 'Google sign-in is not configured yet.' });
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing Google credential' });

    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name } = payload;
    if (!email) return res.status(400).json({ error: 'Google account has no email' });

    let user = await findByGoogleId(googleId);
    let isNew = false;

    if (!user) {
      // Not linked yet — if an account with this email already exists (signed up the normal
      // way), link Google to it instead of creating a duplicate account.
      const existing = await findByEmail(email);
      if (existing) {
        await linkGoogleId(existing.id, googleId);
        user = existing;
      } else {
        const created = await createGoogleUser({ email, googleId, name });
        const [[row]] = await pool.query('SELECT * FROM Users WHERE id = ?', [created.id]);
        user = row;
        isNew = true;
      }
    }

    issueSession(res, user, { isNewUser: isNew });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: 'Could not verify Google sign-in' });
  }
}

async function register(req, res) {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: 'All fields required' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    const id = await createUser({ username, email, password });
    const token = jwt.sign({ userId: id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, userId: id, username, email, theme: 'light', bio: null, notifyBuzz: true, notifyMessages: true, notifyReactions: true, notifyFriendRequests: true, notifyInvites: true, weightUnit: 'lbs', distanceUnit: 'mi', tutorialDone: false, isNewUser: true, isAdmin: false });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'Username or email already taken' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email/username and password required' });
    const identifier = String(email).trim();
    const user = identifier.includes('@')
      ? await findByEmail(identifier)
      : (await findByUsername(identifier)) || (await findByEmail(identifier));
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.password_hash) {
      if (user.google_id) return res.status(401).json({ error: 'This account uses Google sign-in — use the Google button instead.' });
      // Password was cleared (e.g. by an admin) — automatically start the reset flow
      // rather than leaving them stuck with no way back in.
      try {
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 60 * 60 * 1000);
        await pool.query('UPDATE Users SET reset_token = ?, reset_token_expires = ? WHERE id = ?', [token, expires, user.id]);
        const base = process.env.FRONTEND_URL || 'http://localhost:5173';
        await sendPasswordResetEmail(user.email, `${base}/reset-password?token=${token}`);
        return res.status(401).json({ error: 'Your password needs to be reset — check your email for a link to set a new one.' });
      } catch (emailErr) {
        console.error('Auto reset-email failed:', emailErr.message);
        return res.status(401).json({ error: 'Your password was reset by an admin. Use "Forgot password?" to set a new one.' });
      }
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    issueSession(res, user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function updateTheme(req, res) {
  try {
    const { theme } = req.body;
    if (!['light', 'dark'].includes(theme)) return res.status(400).json({ error: 'Invalid theme' });
    await pool.query('UPDATE Users SET theme = ? WHERE id = ?', [theme, req.userId]);
    res.json({ theme });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function uploadAvatar(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const avatarUrl = `/uploads/${req.file.filename}`;
    await pool.query('UPDATE Users SET avatar_url = ? WHERE id = ?', [avatarUrl, req.userId]);
    res.json({ avatarUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function updateSettings(req, res) {
  try {
    const { bio, notifyBuzz, notifyMessages, notifyReactions, notifyFriendRequests, notifyInvites, weightUnit, distanceUnit } = req.body;
    const sets = []; const vals = [];
    if (bio !== undefined) { sets.push('bio = ?'); vals.push(bio ? String(bio).slice(0, 280) : null); }
    if (notifyBuzz !== undefined) { sets.push('notify_buzz = ?'); vals.push(notifyBuzz ? 1 : 0); }
    if (notifyMessages !== undefined) { sets.push('notify_messages = ?'); vals.push(notifyMessages ? 1 : 0); }
    if (notifyReactions !== undefined) { sets.push('notify_reactions = ?'); vals.push(notifyReactions ? 1 : 0); }
    if (notifyFriendRequests !== undefined) { sets.push('notify_friend_requests = ?'); vals.push(notifyFriendRequests ? 1 : 0); }
    if (notifyInvites !== undefined) { sets.push('notify_invites = ?'); vals.push(notifyInvites ? 1 : 0); }
    if (weightUnit !== undefined) { sets.push('weight_unit = ?'); vals.push(weightUnit === 'kg' ? 'kg' : 'lbs'); }
    if (distanceUnit !== undefined) { sets.push('distance_unit = ?'); vals.push(distanceUnit === 'km' ? 'km' : 'mi'); }
    if (sets.length === 0) return res.json({ success: true });
    vals.push(req.userId);
    await pool.query(`UPDATE Users SET ${sets.join(', ')} WHERE id = ?`, vals);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const user = await findByEmail(email);
    // Always respond the same way whether or not the account exists, so this
    // endpoint can't be used to check which emails have accounts.
    if (user && user.password_hash) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await pool.query('UPDATE Users SET reset_token = ?, reset_token_expires = ? WHERE id = ?', [token, expires, user.id]);
      const base = process.env.FRONTEND_URL || 'http://localhost:5173';
      const resetUrl = `${base}/reset-password?token=${token}`;
      try {
        await sendPasswordResetEmail(user.email, resetUrl);
      } catch (emailErr) {
        console.error('Password reset email failed:', emailErr.message);
        if (emailErr.message === 'Email sending is not configured yet.')
          return res.status(503).json({ error: 'Password reset emails are not configured yet.' });
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function resetPassword(req, res) {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and new password required' });
    const [[user]] = await pool.query(
      'SELECT * FROM Users WHERE reset_token = ? AND reset_token_expires > NOW()', [token]
    );
    if (!user) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
    const hash = await bcrypt.hash(password, 12);
    await pool.query('UPDATE Users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?', [hash, user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function completeTutorial(req, res) {
  try {
    await pool.query('UPDATE Users SET tutorial_done = 1 WHERE id = ?', [req.userId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    const [[user]] = await pool.query('SELECT * FROM Users WHERE id = ?', [req.userId]);
    if (user.password_hash) {
      if (!currentPassword) return res.status(400).json({ error: 'Current password required.' });
      const match = await bcrypt.compare(currentPassword, user.password_hash);
      if (!match) return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE Users SET password_hash = ? WHERE id = ?', [hash, req.userId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function changeEmail(req, res) {
  try {
    const { newEmail, currentPassword } = req.body;
    if (!newEmail) return res.status(400).json({ error: 'New email required.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return res.status(400).json({ error: 'That email address doesn\'t look valid.' });
    const [[user]] = await pool.query('SELECT * FROM Users WHERE id = ?', [req.userId]);
    if (user.password_hash) {
      if (!currentPassword) return res.status(400).json({ error: 'Current password required.' });
      const match = await bcrypt.compare(currentPassword, user.password_hash);
      if (!match) return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    const existing = await findByEmail(newEmail);
    if (existing && existing.id !== req.userId) return res.status(409).json({ error: 'That email is already in use.' });
    await pool.query('UPDATE Users SET email = ? WHERE id = ?', [newEmail, req.userId]);
    res.json({ success: true, email: newEmail });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function changeUsername(req, res) {
  try {
    const { newUsername } = req.body;
    if (!newUsername || newUsername.trim().length < 2) return res.status(400).json({ error: 'Username must be at least 2 characters.' });
    const clean = newUsername.trim();
    const existing = await findByUsername(clean);
    if (existing && existing.id !== req.userId) return res.status(409).json({ error: 'That username is already taken.' });
    await pool.query('UPDATE Users SET username = ? WHERE id = ?', [clean, req.userId]);
    res.json({ success: true, username: clean });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { register, login, googleAuth, uploadAvatar, updateTheme, updateSettings, forgotPassword, resetPassword, completeTutorial, changePassword, changeEmail, changeUsername };
