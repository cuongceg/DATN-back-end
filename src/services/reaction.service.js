const sessionsModel = require('../models/sessions.model');
const reactionModel = require('../models/reaction.model');

async function getSessionForReaction(sessionId) {
  const session = await sessionsModel.findWithClass(sessionId);
  if (!session) {
    const error = new Error('Session not found.');
    error.status = 404;
    throw error;
  }
  return session;
}

async function verifyRequesterCanAccessSession(sessionId, requesterId) {
  const session = await getSessionForReaction(sessionId);

  if (session.teacher_id === requesterId) {
    return { session, role: 'teacher' };
  }

  const participant = await sessionsModel.findParticipant(sessionId, requesterId);
  if (!participant) {
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

module.exports = { setReaction, clearReaction, listReactions };
