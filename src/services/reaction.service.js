const pool = require('../config/db');
const reactionModel = require('../models/reaction.model');

async function getSessionForReaction(sessionId) {
  const result = await pool.query(
    `SELECT s.id, s.status, c.teacher_id
     FROM sessions s
     JOIN classes c ON c.id = s.class_id
     WHERE s.id = $1`,
    [sessionId]
  );

  if (result.rows.length === 0) {
    const error = new Error('Session not found.');
    error.status = 404;
    throw error;
  }

  return result.rows[0];
}

async function verifyRequesterCanAccessSession(sessionId, requesterId) {
  const session = await getSessionForReaction(sessionId);

  if (session.teacher_id === requesterId) {
    return { session, role: 'teacher' };
  }

  const participantResult = await pool.query(
    `SELECT 1
     FROM session_participants
     WHERE session_id = $1 AND user_id = $2`,
    [sessionId, requesterId]
  );

  if (participantResult.rows.length === 0) {
    const error = new Error('You do not have permission to access this session.');
    error.status = 403;
    throw error;
  }

  return { session, role: 'participant' };
}

async function setReaction(sessionId, userId, type) {
  const { session } = await verifyRequesterCanAccessSession(sessionId, userId);

  if (session.status !== 'ongoing') {
    const error = new Error('Session is not ongoing.');
    error.status = 400;
    throw error;
  }

  return reactionModel.upsertReaction(sessionId, userId, type);
}

async function clearReaction(sessionId, userId) {
  await verifyRequesterCanAccessSession(sessionId, userId);
  return reactionModel.deleteReaction(sessionId, userId);
}

async function listReactions(sessionId, requesterId) {
  await verifyRequesterCanAccessSession(sessionId, requesterId);
  return reactionModel.getReactionsBySession(sessionId);
}

module.exports = {
  setReaction,
  clearReaction,
  listReactions,
};
