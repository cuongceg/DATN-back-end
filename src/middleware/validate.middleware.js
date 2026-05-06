const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function validateCreateSession(req, res, next) {
  const { classId, title, scheduledAt, scheduledEndAt } = req.body;

  if (!classId || !isUuid(classId)) {
    return res.status(400).json({ message: 'classId must be a valid UUID.' });
  }

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ message: 'title is required.' });
  }

  if (scheduledAt !== undefined && scheduledAt !== null) {
    const parsed = Date.parse(scheduledAt);
    if (Number.isNaN(parsed)) {
      return res.status(400).json({ message: 'scheduledAt must be a valid ISO date.' });
    }
  }

  if (scheduledEndAt !== undefined && scheduledEndAt !== null) {
    const parsed = Date.parse(scheduledEndAt);
    if (Number.isNaN(parsed)) {
      return res.status(400).json({ message: 'scheduledEndAt must be a valid ISO date.' });
    }
  }

  if (scheduledAt !== undefined && scheduledAt !== null
      && scheduledEndAt !== undefined && scheduledEndAt !== null) {
    const startMs = Date.parse(scheduledAt);
    const endMs = Date.parse(scheduledEndAt);
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs <= startMs) {
      return res.status(400).json({ message: 'scheduledEndAt must be after scheduledAt.' });
    }
  }

  return next();
}

function validateSessionIdParam(req, res, next) {
  const { sessionId } = req.params;

  if (!isUuid(sessionId)) {
    return res.status(400).json({ message: 'sessionId must be a valid UUID.' });
  }

  return next();
}

function validateSendMessage(req, res, next) {
  const { content } = req.body;

  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ message: 'content is required.' });
  }

  return next();
}

module.exports = {
  validateCreateSession,
  validateSessionIdParam,
  validateSendMessage,
};
