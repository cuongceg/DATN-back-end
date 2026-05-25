const express = require('express');
const { authenticateToken } = require('../middleware/auth.middleware');
const { validateSessionIdParam } = require('../middleware/validate.middleware');
const reactionController = require('../controllers/reaction.controller');

const router = express.Router();

router.use(authenticateToken);

router.post('/sessions/:sessionId/reactions', validateSessionIdParam, reactionController.setReaction);
router.delete('/sessions/:sessionId/reactions', validateSessionIdParam, reactionController.clearReaction);
router.get('/sessions/:sessionId/reactions', validateSessionIdParam, reactionController.listReactions);

module.exports = router;
