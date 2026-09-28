const router = require('express').Router();
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { listUsers, createAccount, deleteAccount, resetUserPassword, listCrews, userWorkouts, setUserPremium, clearUserPremium, updateCrewFlags } = require('../controllers/admin.controller');

router.use(auth);
router.use(requireAdmin);
router.get('/users',                    listUsers);
router.post('/users',                   createAccount);
router.delete('/users/:id',             deleteAccount);
router.post('/users/:id/reset-password', resetUserPassword);
router.get('/users/:id/workouts',       userWorkouts);
router.get('/crews',                    listCrews);
router.put('/crews/:id/flags',          updateCrewFlags);
router.post('/users/:id/premium',       setUserPremium);
router.delete('/users/:id/premium',     clearUserPremium);

module.exports = router;
