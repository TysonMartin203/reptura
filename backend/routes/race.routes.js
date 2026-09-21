const router = require('express').Router();
const auth = require('../middleware/auth');
const { options, list, get, remove, generate } = require('../controllers/race.controller');

router.use(auth);
router.get('/options', options);
router.get('/',        list);
router.post('/',       generate);
router.get('/:id',     get);
router.delete('/:id',  remove);

module.exports = router;
