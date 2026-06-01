const pool = require('../config/db');

async function saveTranscript(egressId, text, clientTimestampMs) {
  const rec = await pool.query(
    `SELECT started_at
     FROM session_recordings
     WHERE egress_id = $1 AND status = 'recording'`,
    [egressId]
  );

  if (rec.rows.length === 0) {
    return { saved: false };
  }

  const startedAtMs = new Date(rec.rows[0].started_at).getTime();
  const biasMs = Number(process.env.TRANSCRIPT_OFFSET_BIAS_MS || 0);
  const offsetMs = Math.max(0, clientTimestampMs - startedAtMs - biasMs);

  await pool.query(
    `INSERT INTO session_transcripts (egress_id, offset_ms, text)
     VALUES ($1, $2, $3)`,
    [egressId, offsetMs, text.trim()]
  );

  return { saved: true, offset_ms: offsetMs };
}

async function getTranscript(egressId) {
  const result = await pool.query(
    `SELECT id, offset_ms, text, speaker, created_at
     FROM session_transcripts
     WHERE egress_id = $1
     ORDER BY offset_ms ASC`,
    [egressId]
  );

  return result.rows;
}

module.exports = {
  saveTranscript,
  getTranscript,
};
