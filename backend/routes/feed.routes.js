const router = require('express').Router();
const auth = require('../middleware/auth');
const { list, react, unreact, getPrefs, updateTypes, mute, unmute } = require('../controllers/feed.controller');

router.use(auth);
router.get('/',            list);
router.get('/prefs',       getPrefs);
router.put('/prefs',       updateTypes);
router.post('/mute/:friendId',   mute);
router.delete('/mute/:friendId', unmute);
router.post('/:id/react',  react);
router.delete('/:id/react',unreact);

module.exports = router;
