const pool = require('../config/db');
const { deleteLiveKitRoom } = require('./livekit.service');

async function createSession(classId, teacherId, { title, scheduledAt }) {
  const classResult = await pool.query(
    'SELECT id FROM classes WHERE id = $1 AND teacher_id = $2',
    [classId, teacherId]
  );

  if (classResult.rows.length === 0) {
    const error = new Error('You do not have permission to create a session for this class.');
    error.status = 403;
    throw error;
  }

  const result = await pool.query(
    `INSERT INTO sessions (class_id, title, start_time, status)
     VALUES ($1, $2, $3, 'scheduled')
     RETURNING id, class_id, livekit_room_id, title, start_time, end_time, status`,
    [classId, title, scheduledAt || null]
  );

  return result.rows[0];
}

async function getSessionsByClass(classId) {
  const result = await pool.query(
    `SELECT id, class_id, livekit_room_id, title, start_time, end_time, status
     FROM sessions
     WHERE class_id = $1
     ORDER BY start_time DESC NULLS LAST, id DESC`,
    [classId]
  );

  return result.rows;
}

async function getSessionById(sessionId) {
  const result = await pool.query(
    `SELECT id, class_id, livekit_room_id, title, start_time, end_time, status
     FROM sessions
     WHERE id = $1`,
    [sessionId]
  );

  if (result.rows.length === 0) {
    const error = new Error('Session not found.');
    error.status = 404;
    throw error;
  }

  return result.rows[0];
}

async function startSession(sessionId, teacherId) {
  const result = await pool.query(
    `UPDATE sessions
     SET status = 'ongoing',
         start_time = NOW(),
         livekit_room_id = id::text
     WHERE id = $1
       AND class_id IN (SELECT id FROM classes WHERE teacher_id = $2)
       AND status = 'scheduled'
     RETURNING id, class_id, livekit_room_id, title, start_time, end_time, status`,
    [sessionId, teacherId]
  );

  if (result.rows.length === 0) {
    const error = new Error('Unable to start session.');
    error.status = 400;
    throw error;
  }

  return result.rows[0];
}

async function endSession(sessionId, teacherId) {
  const result = await pool.query(
    `UPDATE sessions
     SET status = 'completed',
         end_time = NOW()
     WHERE id = $1
       AND class_id IN (SELECT id FROM classes WHERE teacher_id = $2)
       AND status = 'ongoing'
     RETURNING id, class_id, livekit_room_id, title, start_time, end_time, status`,
    [sessionId, teacherId]
  );

  if (result.rows.length === 0) {
    const error = new Error('Unable to end session.');
    error.status = 400;
    throw error;
  }

  const session = result.rows[0];
  if (session.livekit_room_id) {
    await deleteLiveKitRoom(session.livekit_room_id);
  }

  return session;
}

async function verifyUserCanJoin(userId, sessionId) {
  const sessionResult = await pool.query(
    `SELECT s.id, s.class_id, s.status, s.livekit_room_id, c.teacher_id
     FROM sessions s
     JOIN classes c ON c.id = s.class_id
     WHERE s.id = $1`,
    [sessionId]
  );

  if (sessionResult.rows.length === 0) {
    const error = new Error('Session not found.');
    error.status = 404;
    throw error;
  }

  const session = sessionResult.rows[0];

  if (session.status === 'completed') {
    const error = new Error('Session has already ended.');
    error.status = 400;
    throw error;
  }

  if (session.teacher_id === userId) {
    return { session, role: 'teacher' };
  }

  const memberResult = await pool.query(
    `SELECT permission
     FROM class_members
     WHERE class_id = $1 AND student_id = $2`,
    [session.class_id, userId]
  );

  if (memberResult.rows.length === 0) {
    const error = new Error('You are not a member of this class.');
    error.status = 403;
    throw error;
  }

  return {
    session,
    role: 'student',
    permission: memberResult.rows[0].permission,
  };
}

module.exports = {
  createSession,
  getSessionsByClass,
  getSessionById,
  startSession,
  endSession,
  verifyUserCanJoin,
};
