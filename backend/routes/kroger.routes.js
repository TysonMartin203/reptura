const router = require('express').Router();
const auth = require('../middleware/auth');
const { connect, callback, status, disconnect, searchStores, setLocation, addToCart } = require('../controllers/kroger.controller');

// Public — Kroger's browser redirect lands here directly, with no auth header.
// The signed `state` param (not a session) is what identifies the user.
router.get('/callback', callback);

router.use(auth);
router.get('/connect',       connect);
router.get('/status',        status);
router.delete('/disconnect', disconnect);
router.get('/stores',        searchStores);
router.post('/location',     setLocation);
router.post('/add-to-cart',  addToCart);

module.exports = router;
