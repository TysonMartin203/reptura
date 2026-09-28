const router = require('express').Router();
const auth = require('../middleware/auth');
const aiQuota = require('../middleware/aiQuota');
const { options, list, get, remove, generate } = require('../controllers/race.controller');

router.use(auth);
router.get('/options', options);
router.get('/',        list);
router.post('/',       aiQuota('race_plan'), generate);
router.get('/:id',     get);
router.delete('/:id',  remove);

module.exports = router;
