const router = require('express').Router();
const auth = require('../middleware/auth');
const { send, conversation, unread } = require('../controllers/message.controller');
router.use(auth);
router.post('/',                    send);
router.get('/unread',                unread);
router.get('/:friendId',            conversation);
module.exports = router;
