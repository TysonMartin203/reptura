const webpush = require('web-push');
const pool = require('../config/db');

const configured = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (configured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@reptura.fit',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

async function saveSubscription(userId, subscription) {
  const { endpoint, keys } = subscription;
  await pool.query(
    `INSERT INTO PushSubscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth)`,
    [userId, endpoint, keys.p256dh, keys.auth]
  );
}

async function removeSubscription(endpoint) {
  await pool.query('DELETE FROM PushSubscriptions WHERE endpoint = ?', [endpoint]);
}

async function sendPushToUser(userId, payload) {
  if (!configured) return; // push not set up yet (missing VAPID env vars) — fail silently
  const [subs] = await pool.query('SELECT * FROM PushSubscriptions WHERE user_id = ?', [userId]);
  await Promise.all(subs.map(async (sub) => {
    const pushSub = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
    try {
      await webpush.sendNotification(pushSub, JSON.stringify(payload));
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await pool.query('DELETE FROM PushSubscriptions WHERE id = ?', [sub.id]);
      } else {
        console.error('Push send failed:', err.message);
      }
    }
  }));
}

module.exports = { saveSubscription, removeSubscription, sendPushToUser, configured };
