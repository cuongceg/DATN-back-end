const pool = require('../config/db');

async function upsertReaction(sessionId, userId, type) {
  const result = await pool.query(
    `INSERT INTO session_reactions (session_id, user_id, type)
     VALUES ($1, $2, $3)
     ON CONFLICT (session_id, user_id)
     DO UPDATE SET type = $3, raised_at = NOW()
     RETURNING session_id, user_id, type, raised_at`,
    [sessionId, userId, type]
  );

  return result.rows[0];
}

async function deleteReaction(sessionId, userId) {
  const result = await pool.query(
    `DELETE FROM session_reactions
     WHERE session_id = $1 AND user_id = $2
     RETURNING session_id, user_id, type, raised_at`,
    [sessionId, userId]
  );

  return result.rows[0] || null;
}

async function getReactionsBySession(sessionId) {
  const result = await pool.query(
    `SELECT sr.session_id, sr.user_id, sr.type, sr.raised_at, u.full_name
     FROM session_reactions sr
     JOIN users u ON u.id = sr.user_id
     WHERE sr.session_id = $1
     ORDER BY sr.raised_at ASC`,
    [sessionId]
  );

  return result.rows;
}

module.exports = {
  upsertReaction,
  deleteReaction,
  getReactionsBySession,
};
