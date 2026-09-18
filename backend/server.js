require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const UPLOADS_DIR = require('./config/uploadsDir');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();

const allowedOrigins = ['http://localhost:5173', process.env.CLIENT_URL].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
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
