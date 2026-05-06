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

  const { classId, title, scheduledAt } = req.body;

  if (!classId || !title) {
    return res.status(400).json({ message: 'classId and title are required.' });
  }

  try {
    const session = await sessionService.createSession(classId, req.user.id, { title, scheduledAt });
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

    return res.status(200).json({
      token,
      livekit_url: process.env.LIVEKIT_URL,
      room_name: session.livekit_room_id,
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
      `SELECT id, session_id, sender_id, content, "timestamp"
       FROM messages
       WHERE session_id = $1
       ORDER BY "timestamp" ASC
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
  startSession,
  endSession,
  joinSession,
  getMessages,
  sendMessage,
};
