const router = require('express').Router();
const multer = require('multer');
const path   = require('path');
const auth = require('../middleware/auth');
const UPLOADS_DIR = require('../config/uploadsDir');
const { create, update, list, getOne, getView, removePhoto, remove, parseVoice , duplicate } = require('../controllers/workout.controller');

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
router.get('/:id',    getOne);
router.get('/:id/view', getView);
router.delete('/:id/photo', removePhoto);
router.post('/parse-voice', parseVoice);
router.put('/:id',    uploader.single('photo'), update);
router.delete('/:id', remove);
router.post('/:id/duplicate', duplicate);

module.exports = router;
