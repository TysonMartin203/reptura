const router = require('express').Router();
const auth = require('../middleware/auth');
const { createShoppingList } = require('../controllers/instacart.controller');

router.use(auth);
router.post('/shopping-list', createShoppingList);

module.exports = router;
