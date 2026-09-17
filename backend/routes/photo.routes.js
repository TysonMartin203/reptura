const router  = require('express').Router();
const multer  = require('multer');
const path    = require('path');
const auth    = require('../middleware/auth');
const UPLOADS_DIR = require('../config/uploadsDir');
const { upload, list, listForWorkout, remove, updateTagsHandler } = require('../controllers/photo.controller');

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.originalname}`),
});
const uploader = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(file.mimetype);
    cb(ok ? null : new Error('Invalid file type — please use a JPEG, PNG, WebP, or HEIC photo'), ok);
  },
});

router.use(auth);
router.post('/',      uploader.array('photos', 10), upload);
router.get('/',       list);
router.get('/workout/:workoutId', listForWorkout);
router.put('/:id/tags', updateTagsHandler);
router.delete('/:id', remove);
module.exports = router;
