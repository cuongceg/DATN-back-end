const pool = require('../config/db');

async function findRunningBySession(sessionId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM session_recordings WHERE session_id = $1 AND status = 'recording' LIMIT 1`,
    [sessionId]
  );
  return rows.length > 0;
}

async function findBySessionAndEgress(sessionId, egressId) {
  const { rows } = await pool.query(
    `SELECT id, session_id, egress_id
     FROM session_recordings
     WHERE session_id = $1 AND egress_id = $2`,
    [sessionId, egressId]
  );
  return rows[0] || null;
}

async function create(sessionId, classId, egressId, startedByUserId) {
  const { rows } = await pool.query(
    `INSERT INTO session_recordings (session_id, class_id, egress_id, status, started_by)
     VALUES ($1, $2, $3, 'recording', $4)
     RETURNING id, egress_id, started_at`,
    [sessionId, classId, egressId, startedByUserId]
  );
  return rows[0];
}

async function updateStopping(sessionId, egressId) {
  await pool.query(
    `UPDATE session_recordings SET status = 'stopping' WHERE session_id = $1 AND egress_id = $2`,
    [sessionId, egressId]
  );
}

async function listCompleted(classId) {
  const { rows } = await pool.query(
    `SELECT id, session_id, egress_id, s3_key, duration_seconds, started_at, ended_at
     FROM session_recordings
     WHERE class_id = $1 AND status = 'completed'
     ORDER BY started_at DESC, id DESC`,
    [classId]
  );
  return rows;
}

async function updateCompleted(egressId, s3Key, durationSeconds) {
  await pool.query(
    `UPDATE session_recordings
     SET status = 'completed',
         s3_key = COALESCE($1, s3_key),
         duration_seconds = COALESCE($2, duration_seconds),
         ended_at = NOW()
     WHERE egress_id = $3`,
    [s3Key, durationSeconds, egressId]
  );
}

async function updateFailed(egressId) {
  await pool.query(
    `UPDATE session_recordings SET status = 'failed', ended_at = NOW() WHERE egress_id = $1`,
    [egressId]
  );
}

async function checkExists(sessionId, egressId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM session_recordings WHERE session_id = $1 AND egress_id = $2 LIMIT 1`,
    [sessionId, egressId]
  );
  return rows.length > 0;
}

module.exports = {
  findRunningBySession,
  findBySessionAndEgress,
  create,
  updateStopping,
  listCompleted,
  updateCompleted,
  updateFailed,
  checkExists,
};
