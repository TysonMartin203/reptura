const router = require('express').Router();
const multer = require('multer');
const path   = require('path');
const auth = require('../middleware/auth');
const aiQuota = require('../middleware/aiQuota');
const UPLOADS_DIR = require('../config/uploadsDir');
const { create, update, list, getOne, getView, removePhoto, remove, parseVoice , duplicate } = require('../controllers/workout.controller');
const draft = require('../controllers/workoutDraft.controller');

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const uploader = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.mimetype);
    cb(ok ? null : new Error('Invalid file type — please use a JPEG, PNG, WebP, or HEIC photo'), ok);
  },
});

router.use(auth);
router.post('/',      uploader.single('photo'), create);
router.get('/',       list);
// Unfinished-workout draft. Registered before '/:id' so "draft" isn't read as an id.
router.get('/draft',    draft.get);
router.put('/draft',    draft.put);
router.delete('/draft', draft.remove);
router.get('/:id',    getOne);
router.get('/:id/view', getView);
router.delete('/:id/photo', removePhoto);
// Speech → AI → exercises. The notes mic is browser-only and never hits this.
router.post('/parse-voice', aiQuota('voice_log'), parseVoice);
router.put('/:id',    uploader.single('photo'), update);
router.delete('/:id', remove);
router.post('/:id/duplicate', duplicate);

module.exports = router;
