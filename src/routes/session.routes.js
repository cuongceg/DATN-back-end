const express = require('express');
const { authenticateToken } = require('../middleware/auth.middleware');
const {
	validateCreateSession,
	validateSessionIdParam,
	validateSendMessage,
} = require('../middleware/validate.middleware');
const sessionController = require('../controllers/session.controller');

const router = express.Router();

router.use(authenticateToken);

router.post('/', validateCreateSession, sessionController.createSession);
router.get('/my', sessionController.getMySessions);
router.get('/class/:classId', sessionController.getSessionsByClass);
router.patch('/:sessionId', validateSessionIdParam, sessionController.updateSession);
router.delete('/:sessionId', validateSessionIdParam, sessionController.deleteSession);
router.get('/:sessionId', validateSessionIdParam, sessionController.getSessionById);
router.patch('/:sessionId/start', validateSessionIdParam, sessionController.startSession);
router.patch('/:sessionId/end', validateSessionIdParam, sessionController.endSession);
router.post('/:sessionId/token', validateSessionIdParam, sessionController.joinSession);
router.get('/:sessionId/messages', validateSessionIdParam, sessionController.getMessages);
router.post(
	'/:sessionId/messages',
	validateSessionIdParam,
	validateSendMessage,
	sessionController.sendMessage
);

module.exports = router;
