const router = require('express').Router();
const auth = require('../middleware/auth');
const { create, list, join, remove, progress } = require('../controllers/challenge.controller');

router.use(auth);
router.post('/',            create);
router.get('/',              list);
router.post('/:id/join',    join);
router.get('/:id/progress', progress);
router.delete('/:id',       remove);

module.exports = router;
