const pool = require('../config/db');
const sessionService = require('../services/session.service');
const { generateLiveKitToken } = require('../services/livekit.service');

function handleServiceError(res, error, next) {
  if (error && error.status) {
    return res.status(error.status).json({ message: error.message });
  }

  return next(error);
}

async function createSession(req, res, next) {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Only teachers can create sessions.' });
  }

  const { classId, title, scheduledAt, scheduledEndAt } = req.body;

  if (!classId || !title) {
    return res.status(400).json({ message: 'classId and title are required.' });
  }

  try {
    const session = await sessionService.createSession(classId, req.user.id, {
      title,
      scheduledAt,
      scheduledEndAt,
    });
    return res.status(201).json({
      message: 'Session created successfully.',
      session,
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function getSessionsByClass(req, res, next) {
  const { classId } = req.params;

  try {
    const sessions = await sessionService.getSessionsByClass(classId);
    return res.status(200).json({ sessions });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function getSessionById(req, res, next) {
  const { sessionId } = req.params;

  try {
    const session = await sessionService.getSessionById(sessionId);
    return res.status(200).json({ session });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function getMySessions(req, res, next) {
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ message: 'from and to are required.' });
  }

  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);

  if (Number.isNaN(fromMs)) {
    return res.status(400).json({ message: 'from must be a valid ISO date.' });
  }

  if (Number.isNaN(toMs)) {
    return res.status(400).json({ message: 'to must be a valid ISO date.' });
  }

  try {
    const sessions = await sessionService.getMySessions(req.user, {
      from: new Date(fromMs),
      to: new Date(toMs),
    });

    return res.status(200).json({ sessions });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function updateSession(req, res, next) {
  const { sessionId } = req.params;

  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Only teachers can update sessions.' });
  }

  const { title, scheduledAt, scheduledEndAt } = req.body;

  const hasTitle = title !== undefined;
  const hasScheduledAt = scheduledAt !== undefined;
  const hasScheduledEndAt = scheduledEndAt !== undefined;

  if (!hasTitle && !hasScheduledAt && !hasScheduledEndAt) {
    return res.status(400).json({
      message: 'At least one field (title, scheduledAt, scheduledEndAt) is required.',
    });
  }

  if (hasTitle) {
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ message: 'title must be a non-empty string.' });
    }
  }

  if (hasScheduledAt && scheduledAt !== null) {
    const parsed = Date.parse(scheduledAt);
    if (Number.isNaN(parsed)) {
      return res.status(400).json({ message: 'scheduledAt must be a valid ISO date.' });
    }
  }

  if (hasScheduledEndAt && scheduledEndAt !== null) {
    const parsed = Date.parse(scheduledEndAt);
    if (Number.isNaN(parsed)) {
      return res.status(400).json({ message: 'scheduledEndAt must be a valid ISO date.' });
    }
  }

  if (hasScheduledAt && scheduledAt !== null && hasScheduledEndAt && scheduledEndAt !== null) {
    const startMs = Date.parse(scheduledAt);
    const endMs = Date.parse(scheduledEndAt);
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs <= startMs) {
      return res.status(400).json({ message: 'scheduledEndAt must be after scheduledAt.' });
    }
  }

  try {
    const session = await sessionService.updateSession(sessionId, req.user.id, {
      title: hasTitle ? title.trim() : undefined,
      scheduledAt,
      scheduledEndAt,
    });

    return res.status(200).json({ session });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function deleteSession(req, res, next) {
  const { sessionId } = req.params;

  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Only teachers can delete sessions.' });
  }

  try {
    const deleted = await sessionService.deleteSession(sessionId, req.user.id);
    return res.status(200).json({
      message: 'Session deleted successfully.',
      session: deleted,
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function startSession(req, res, next) {
  const { sessionId } = req.params;

  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Only teachers can start sessions.' });
  }

  try {
    const session = await sessionService.startSession(sessionId, req.user.id);
    return res.status(200).json({
      message: 'Session started successfully.',
      session,
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function endSession(req, res, next) {
  const { sessionId } = req.params;

  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Only teachers can end sessions.' });
  }

  try {
    const session = await sessionService.endSession(sessionId, req.user.id);
    return res.status(200).json({
      message: 'Session ended successfully.',
      session,
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function joinSession(req, res, next) {
  const { sessionId } = req.params;

  try {
    const { session, role } = await sessionService.verifyUserCanJoin(req.user.id, sessionId);

    if (session.status !== 'ongoing' || !session.livekit_room_id) {
      return res.status(400).json({ message: 'Session has not started yet.' });
    }

    const userResult = await pool.query(
      'SELECT full_name FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const grants = {
      roomAdmin: role === 'teacher',
      user: { full_name: userResult.rows[0].full_name, role },
      role,
    };

    const token = await generateLiveKitToken(session.livekit_room_id, req.user.id, grants);

    await pool.query(
      `INSERT INTO session_participants (session_id, user_id, joined_at, left_at)
       VALUES ($1, $2, NOW(), NULL)
       ON CONFLICT (session_id, user_id)
       DO UPDATE SET
         joined_at = CASE
           WHEN session_participants.left_at IS NULL THEN session_participants.joined_at
           ELSE NOW()
         END,
         left_at = NULL`,
      [sessionId, req.user.id]
    );

    return res.status(200).json({
      token,
      livekit_url: process.env.LIVEKIT_URL,
      room_name: session.livekit_room_id,
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function getParticipants(req, res, next) {
  const { sessionId } = req.params;

  try {
    await sessionService.verifyUserCanAccessSession(req.user, sessionId);

    const { rows } = await pool.query(
      `SELECT
          u.id           AS user_id,
          u.full_name,
          u.role,
          sp.joined_at,
          sp.left_at,
          (sp.left_at IS NULL) AS is_online
       FROM session_participants sp
       JOIN users u ON u.id = sp.user_id
       WHERE sp.session_id = $1
       ORDER BY sp.joined_at ASC`,
      [sessionId]
    );

    return res.status(200).json({
      session_id: sessionId,
      total_count: rows.length,
      participants: rows,
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function leaveSession(req, res, next) {
  const { sessionId } = req.params;

  try {
    await sessionService.verifyUserCanAccessSession(req.user, sessionId);

    const participantResult = await pool.query(
      `SELECT session_id, user_id, joined_at, left_at
       FROM session_participants
       WHERE session_id = $1 AND user_id = $2`,
      [sessionId, req.user.id]
    );

    if (participantResult.rows.length === 0) {
      return res.status(400).json({ message: 'You have not joined this session.' });
    }

    const participant = participantResult.rows[0];

    if (participant.left_at) {
      return res.status(400).json({ message: 'You have already left this session.' });
    }

    const updateResult = await pool.query(
      `UPDATE session_participants
       SET left_at = NOW()
       WHERE session_id = $1 AND user_id = $2
       RETURNING session_id, user_id, joined_at, left_at`,
      [sessionId, req.user.id]
    );

    return res.status(200).json({
      message: 'Left session successfully.',
      participant: updateResult.rows[0],
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function getMessages(req, res, next) {
  const { sessionId } = req.params;
  const limit = Number.parseInt(req.query.limit, 10) || 20;
  const offset = Number.parseInt(req.query.offset, 10) || 0;

  try {
    await sessionService.verifyUserCanJoin(req.user.id, sessionId);

    const { rows } = await pool.query(
      `SELECT m.id, u.full_name AS sender_name, m.content, m."timestamp", m.sender_id
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.session_id = $1
       ORDER BY m."timestamp" ASC
       LIMIT $2 OFFSET $3`,
      [sessionId, limit, offset]
    );

    return res.status(200).json({ messages: rows });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function sendMessage(req, res, next) {
  const { sessionId } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ message: 'content is required.' });
  }

  try {
    const { session } = await sessionService.verifyUserCanJoin(req.user.id, sessionId);

    if (session.status !== 'ongoing') {
      return res.status(400).json({ message: 'Session is not ongoing.' });
    }

    const result = await pool.query(
      `INSERT INTO messages (session_id, sender_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, session_id, sender_id, content, "timestamp"`,
      [sessionId, req.user.id, content.trim()]
    );

    return res.status(201).json({
      message: 'Message sent successfully.',
      message_data: result.rows[0],
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

module.exports = {
  createSession,
  getSessionsByClass,
  getSessionById,
  getMySessions,
  updateSession,
  deleteSession,
  startSession,
  endSession,
  joinSession,
  getParticipants,
  leaveSession,
  getMessages,
  sendMessage,
};
