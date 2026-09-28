const router = require('express').Router();
const auth = require('../middleware/auth');
const { status } = require('../controllers/premium.controller');

router.use(auth);
router.get('/status', status);

module.exports = router;
