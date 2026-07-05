const sessionsModel = require('../models/sessions.model');
const recordingsModel = require('../models/recordings.model');

function toDurationSeconds(durationNs) {
  if (durationNs === undefined || durationNs === null) return null;
  const value = typeof durationNs === 'string' ? Number(durationNs) : durationNs;
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value / 1e9);
}

async function handleRoomFinished(roomName) {
  await sessionsModel.completeByLivekitRoom(roomName);
}

async function handleEgressEnded(egressInfo) {
  const info = egressInfo || {};
  const egressId = info.egressId || info.egress_id;
  if (!egressId) return;

  if (info.error) {
    await recordingsModel.updateFailed(egressId);
  } else {
    const file = Array.isArray(info.fileResults) ? info.fileResults[0] : null;
    const s3Key = file?.filename || null;
    const durationSeconds = toDurationSeconds(file?.duration);
    await recordingsModel.updateCompleted(egressId, s3Key, durationSeconds);
  }
}

module.exports = { handleRoomFinished, handleEgressEnded };
