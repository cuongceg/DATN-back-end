const pool = require('../config/db');
const sessionService = require('../services/session.service');
const transcriptService = require('../services/transcript.service');

function handleServiceError(res, error, next) {
  if (error && error.status) {
    return res.status(error.status).json({ message: error.message });
  }

  return next(error);
}

async function saveTranscript(req, res, next) {
  const { sessionId, egressId } = req.params;
  const { text, client_timestamp_ms: clientTimestampMs } = req.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ message: 'text is required.' });
  }

  if (typeof clientTimestampMs !== 'number' || !Number.isFinite(clientTimestampMs) || clientTimestampMs <= 0) {
    return res.status(400).json({ message: 'client_timestamp_ms must be a number greater than 0.' });
  }

  if (!egressId || typeof egressId !== 'string' || !egressId.trim()) {
    return res.status(400).json({ message: 'egressId is required.' });
  }

  try {
    const { role } = await sessionService.verifyUserCanAccessSession(req.user, sessionId);
    if (role !== 'teacher') {
      return res.status(403).json({ message: 'Forbidden: insufficient permissions.' });
    }

    const result = await transcriptService.saveTranscript(egressId.trim(), text, clientTimestampMs);

    return res.status(200).json({
      message: 'Transcript saved.',
      result,
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function getTranscript(req, res, next) {
  const { sessionId, egressId } = req.params;

  if (!egressId || typeof egressId !== 'string' || !egressId.trim()) {
    return res.status(400).json({ message: 'egressId is required.' });
  }

  try {
    const { role } = await sessionService.verifyUserCanAccessSession(req.user, sessionId);
    if (role !== 'teacher' && role !== 'student') {
      return res.status(403).json({ message: 'Forbidden: insufficient permissions.' });
    }

    const recordingExists = await pool.query(
      `SELECT 1
       FROM session_recordings
       WHERE session_id = $1 AND egress_id = $2
       LIMIT 1`,
      [sessionId, egressId.trim()]
    );

    if (recordingExists.rows.length === 0) {
      return res.status(404).json({ message: 'Recording not found.' });
    }

    const transcript = await transcriptService.getTranscript(egressId.trim());
    return res.status(200).json({ transcript });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

module.exports = {
  saveTranscript,
  getTranscript,
};
