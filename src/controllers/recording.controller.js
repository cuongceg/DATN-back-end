const sessionService = require('../services/session.service');
const recordingService = require('../services/recording.service');

function handleServiceError(res, error, next) {
  if (error && error.status) {
    return res.status(error.status).json({ message: error.message });
  }

  return next(error);
}

async function startRecording(req, res, next) {
  const { sessionId } = req.params;

  try {
    const { role } = await sessionService.verifyUserCanAccessSession(req.user, sessionId);
    if (role !== 'teacher') {
      return res.status(403).json({ message: 'Forbidden: insufficient permissions.' });
    }

    const recording = await recordingService.startRecording(sessionId, req.user.id);
    return res.status(201).json({
      message: 'Recording started successfully.',
      recording,
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function stopRecording(req, res, next) {
  const { sessionId } = req.params;
  const { egress_id: egressId } = req.body || {};

  if (!egressId || typeof egressId !== 'string' || !egressId.trim()) {
    return res.status(400).json({ message: 'egress_id is required.' });
  }

  try {
    const { role } = await sessionService.verifyUserCanAccessSession(req.user, sessionId);
    if (role !== 'teacher') {
      return res.status(403).json({ message: 'Forbidden: insufficient permissions.' });
    }

    const recording = await recordingService.stopRecording(sessionId, egressId.trim());
    return res.status(200).json({
      message: 'Recording stopped.',
      recording,
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function listRecordings(req, res, next) {
  const { classId } = req.params;

  try {
    await sessionService.verifyUserCanAccessClass(req.user, classId);
    const recordings = await recordingService.listRecordings(classId);
    return res.status(200).json({ recordings });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

module.exports = {
  startRecording,
  stopRecording,
  listRecordings,
};
