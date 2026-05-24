const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');
const { validateClassIdParam, validateSessionIdParam } = require('../middleware/validate.middleware');
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
  '/classes/:classId/recordings',
  authorizeRoles('teacher', 'student'),
  validateClassIdParam,
  recordingController.listRecordings
);

module.exports = router;
