const transcriptModel = require('../models/transcript.model');

async function saveTranscript(egressId, text, clientTimestampMs) {
  const rec = await transcriptModel.findRecordingByEgressId(egressId);
  if (!rec) {
    return { saved: false };
  }

  const startedAtMs = new Date(rec.started_at).getTime();
  const biasMs = Number(process.env.TRANSCRIPT_OFFSET_BIAS_MS || 0);
  const offsetMs = Math.max(0, clientTimestampMs - startedAtMs - biasMs);

  await transcriptModel.create(egressId, offsetMs, text.trim());
  return { saved: true, offset_ms: offsetMs };
}

async function getTranscript(egressId) {
  return transcriptModel.findByEgressId(egressId);
}

module.exports = { saveTranscript, getTranscript };
