const router = require('express').Router();
const auth = require('../middleware/auth');
const { add, accept, list, recommended } = require('../controllers/friend.controller');
router.use(auth);
router.post('/',                       add);
router.put('/:requesterId/accept',     accept);
router.get('/',                        list);
router.get('/recommended',             recommended);
module.exports = router;
