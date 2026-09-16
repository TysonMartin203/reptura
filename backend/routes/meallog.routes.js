const router = require('express').Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const { create, update, listForDate, history, remove, recognize, recognizeLabel, parseVoice } = require('../controllers/meallog.controller');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

router.use(auth);
router.post('/',        create);
router.put('/:id',      update);
router.post('/recognize', upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'photo2', maxCount: 1 }]), recognize);
router.post('/recognize-label', upload.fields([{ name: 'photo', maxCount: 1 }]), recognizeLabel);
router.post('/parse-voice', parseVoice);
router.get('/',          listForDate);
router.get('/history',   history);
router.delete('/:id',    remove);

module.exports = router;
