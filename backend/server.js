require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const UPLOADS_DIR = require('./config/uploadsDir');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();

// CLIENT_URL accepts a comma-separated list so the app can be reached from
// more than one origin at once — e.g. the custom domain, its www variant,
// and the original netlify.app URL (handy as a fallback if DNS ever breaks).
// A browser treats each of those as a distinct origin, so every one the app
// is actually served from has to be listed or its API calls get blocked.
const { clientOrigins, frontendUrl, malformedOrigins } = require('./config/urls');

const allowedOrigins = clientOrigins();

// A mistyped entry (a missing colon, say) would otherwise just never match,
// and the only symptom would be one domain failing every API call. Say so out
// loud at boot instead.
const badOrigins = malformedOrigins();
if (badOrigins.length) {
  console.warn('Ignoring malformed URL(s) in CLIENT_URL/FRONTEND_URL:', badOrigins.join(', '));
}
console.log('Allowed origins:', allowedOrigins.join(', '));
console.log('Redirects and email links point to:', frontendUrl());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    // Log the rejected origin — otherwise a CORS block just shows up in the
    // browser as an opaque "Load failed" with nothing server-side to go on.
    console.warn('Blocked by CORS:', origin, '— allowed:', allowedOrigins.join(', '));
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());
app.use('/api/uploads', require('./routes/uploads.routes'));

app.use('/api/auth',         require('./routes/auth.routes'));
app.use('/api/workouts',     require('./routes/workout.routes'));
app.use('/api/prs',          require('./routes/pr.routes'));
app.use('/api/photos',       require('./routes/photo.routes'));
app.use('/api/friends',      require('./routes/friend.routes'));
app.use('/api/messages',     require('./routes/message.routes'));
app.use('/api/meals',        require('./routes/meal.routes'));
app.use('/api/meal-logs',    require('./routes/meallog.routes'));
app.use('/api/admin',        require('./routes/admin.routes'));
app.use('/api/achievements', require('./routes/achievement.routes'));
app.use('/api/push',         require('./routes/push.routes'));
app.use('/api/feed',         require('./routes/feed.routes'));
app.use('/api/social',       require('./routes/social.routes'));
app.use('/api/crews',        require('./routes/crew.routes'));
app.use('/api/challenges',   require('./routes/challenge.routes'));
app.use('/api/invites',      require('./routes/invite.routes'));
app.use('/api/profile',      require('./routes/profile.routes'));
app.use('/api/workout-plans', require('./routes/workoutplan.routes'));
app.use('/api/instacart',    require('./routes/instacart.routes'));
app.use('/api/family-members', require('./routes/family.routes'));
app.use('/api/kroger',       require('./routes/kroger.routes'));
app.use('/api/race-plans',   require('./routes/race.routes'));
app.use('/api/users',        require('./routes/user.routes'));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Catch-all error handler — without this, errors thrown outside a route's own
// try/catch (e.g. a multer file-filter rejection) fall through to Express's
// default handler, which returns an HTML page instead of JSON the frontend expects.
app.use((err, req, res, next) => {
  if (err?.name === 'MulterError') {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Photo is too large (max 10MB)' : err.message;
    return res.status(400).json({ error: msg });
  }
  if (err) {
    console.error(err);
    return res.status(400).json({ error: err.message || 'Something went wrong' });
  }
  next();
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Reptura API on port ${PORT}`));
