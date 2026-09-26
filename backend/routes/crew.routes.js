const router = require('express').Router();
const auth = require('../middleware/auth');
const { create, list, getOne, invite, listInvites, acceptInvite, declineInvite, messages, send, remove } = require('../controllers/crew.controller');

router.use(auth);
router.post('/',               create);
router.get('/',                list);
router.get('/invites',         listInvites);
router.put('/invites/:id/accept',  acceptInvite);
router.put('/invites/:id/decline', declineInvite);
router.get('/:id',             getOne);
router.post('/:id/members',    invite);
router.get('/:id/messages',    messages);
router.post('/:id/messages',   send);
router.delete('/:id',          remove);

module.exports = router;
