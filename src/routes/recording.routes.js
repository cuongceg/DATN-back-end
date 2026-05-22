const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');
const { validateSessionIdParam } = require('../middleware/validate.middleware');
const recordingController = require('../controllers/recording.controller');

const router = express.Router();

router.use(authenticateToken);

router.post(
  '/sessions/:sessionId/recordings/start',
  authorizeRoles('teacher'),
  validateSessionIdParam,
  recordingController.startRecording
);

router.post(
  '/sessions/:sessionId/recordings/stop',
  authorizeRoles('teacher'),
  validateSessionIdParam,
  recordingController.stopRecording
);

router.get(
  '/sessions/:sessionId/recordings',
  authorizeRoles('teacher', 'student'),
  validateSessionIdParam,
  recordingController.listRecordings
);

module.exports = router;
