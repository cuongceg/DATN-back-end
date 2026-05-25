const reactionService = require('../services/reaction.service');

const ALLOWED_REACTION_TYPES = new Set([
  'raise_hand',
  'agree',
  'repeat',
  'pause',
  'confused',
]);

function handleServiceError(res, error, next) {
  if (error && error.status) {
    return res.status(error.status).json({ message: error.message });
  }

  return next(error);
}

async function setReaction(req, res, next) {
  const { sessionId } = req.params;
  const { type } = req.body;

  if (typeof type !== 'string' || !ALLOWED_REACTION_TYPES.has(type)) {
    return res.status(400).json({
      message: "type must be one of: raise_hand, agree, repeat, pause, confused.",
    });
  }

  try {
    const reaction = await reactionService.setReaction(sessionId, req.user.id, type);
    return res.status(201).json({
      reaction,
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function clearReaction(req, res, next) {
  const { sessionId } = req.params;

  try {
    await reactionService.clearReaction(sessionId, req.user.id);
    return res.status(200).json({ message: 'Reaction cleared.' });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function listReactions(req, res, next) {
  const { sessionId } = req.params;

  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Only teachers can list reactions.' });
  }

  try {
    const reactions = await reactionService.listReactions(sessionId, req.user.id);
    const raise_hand_count = reactions.filter((item) => item.type === 'raise_hand').length;

    return res.status(200).json({
      reactions,
      raise_hand_count,
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

module.exports = {
  setReaction,
  clearReaction,
  listReactions,
};
