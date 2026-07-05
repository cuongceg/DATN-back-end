const pool = require('../config/db');

async function findRecordingByEgressId(egressId) {
  const { rows } = await pool.query(
    `SELECT started_at FROM session_recordings WHERE egress_id = $1 AND status = 'recording'`,
    [egressId]
  );
  return rows[0] || null;
}

async function create(egressId, offsetMs, text) {
  await pool.query(
    'INSERT INTO session_transcripts (egress_id, offset_ms, text) VALUES ($1, $2, $3)',
    [egressId, offsetMs, text]
  );
}

async function findByEgressId(egressId) {
  const { rows } = await pool.query(
    `SELECT id, offset_ms, text, speaker, created_at
     FROM session_transcripts
     WHERE egress_id = $1
     ORDER BY offset_ms ASC`,
    [egressId]
  );
  return rows;
}

module.exports = { findRecordingByEgressId, create, findByEgressId };
