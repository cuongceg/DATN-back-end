const pool = require('../config/db');
const { deleteLiveKitRoom } = require('./livekit.service');

async function createSession(classId, teacherId, { title, scheduledAt, scheduledEndAt }) {
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
    `INSERT INTO sessions (class_id, title, scheduled_at, scheduled_end_at, start_time, status)
     VALUES ($1, $2, $3, $4, NULL, 'scheduled')
     RETURNING id, class_id, livekit_room_id, title, scheduled_at, scheduled_end_at, start_time, end_time, status`,
    [classId, title, scheduledAt || null, scheduledEndAt || null]
  );

  const newSession = result.rows[0];

  await pool.query(
    `INSERT INTO posts (class_id, author_id, type, session_id)
     VALUES ($1, $2, 'session', $3)`,
    [classId, teacherId, newSession.id]
  );

  return newSession;
}

async function getSessionsByClass(classId) {
  const result = await pool.query(
    `SELECT id, class_id, livekit_room_id, title, scheduled_at, scheduled_end_at, start_time, end_time, status
     FROM sessions
     WHERE class_id = $1
     ORDER BY scheduled_at DESC NULLS LAST, start_time DESC NULLS LAST, id DESC`,
    [classId]
  );

  return result.rows;
}

async function getSessionById(sessionId) {
  const result = await pool.query(
    `SELECT id, class_id, livekit_room_id, title, scheduled_at, scheduled_end_at, start_time, end_time, status
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
     RETURNING id, class_id, livekit_room_id, title, scheduled_at, scheduled_end_at, start_time, end_time, status`,
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
     RETURNING id, class_id, livekit_room_id, title, scheduled_at, scheduled_end_at, start_time, end_time, status`,
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

async function verifyUserCanAccessSession(user, sessionId) {
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

  if (user.role === 'admin') {
    return { session, role: 'admin' };
  }

  if (session.teacher_id === user.id) {
    return { session, role: 'teacher' };
  }

  const memberResult = await pool.query(
    `SELECT 1
     FROM class_members
     WHERE class_id = $1 AND student_id = $2`,
    [session.class_id, user.id]
  );

  if (memberResult.rows.length === 0) {
    const error = new Error('You are not a member of this class.');
    error.status = 403;
    throw error;
  }

  return { session, role: 'student' };
}

async function updateSession(sessionId, teacherId, { title, scheduledAt, scheduledEndAt }) {
  const sessionResult = await pool.query(
    `SELECT s.id, s.status, c.teacher_id
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
  if (session.teacher_id !== teacherId) {
    const error = new Error('You do not have permission to update this session.');
    error.status = 403;
    throw error;
  }

  if ((scheduledAt !== undefined && scheduledAt !== null)
      || (scheduledEndAt !== undefined && scheduledEndAt !== null)) {
    if (session.status === 'ongoing' || session.status === 'completed') {
      const error = new Error('Cannot reschedule a session that is already ongoing or completed.');
      error.status = 400;
      throw error;
    }
  }

  const result = await pool.query(
    `UPDATE sessions
     SET title = COALESCE($2, title),
         scheduled_at = COALESCE($3, scheduled_at),
         scheduled_end_at = COALESCE($4, scheduled_end_at)
     WHERE id = $1
     RETURNING id, class_id, livekit_room_id, title, scheduled_at, scheduled_end_at, start_time, end_time, status`,
    [sessionId, title ?? null, scheduledAt ?? null, scheduledEndAt ?? null]
  );

  return result.rows[0];
}

async function deleteSession(sessionId, teacherId) {
  const sessionResult = await pool.query(
    `SELECT s.id, s.title, s.status, c.teacher_id
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
  if (session.teacher_id !== teacherId) {
    const error = new Error('You do not have permission to delete this session.');
    error.status = 403;
    throw error;
  }

  if (session.status !== 'scheduled') {
    const error = new Error('Only scheduled sessions can be deleted.');
    error.status = 400;
    throw error;
  }

  const result = await pool.query(
    'DELETE FROM sessions WHERE id = $1 RETURNING id, title',
    [sessionId]
  );

  return result.rows[0];
}

async function getMySessions(user, { from, to }) {
  const baseSelect =
    `SELECT s.id,
            s.class_id,
            c.name AS class_name,
            s.title,
            s.scheduled_at,
            s.scheduled_end_at,
            s.start_time,
            s.end_time,
            s.status
     FROM sessions s
     JOIN classes c ON c.id = s.class_id`;

  const rangeCondition =
    'COALESCE(s.scheduled_at, s.start_time) BETWEEN $2 AND $3';

  let query;
  let params;

  if (user.role === 'teacher') {
    query =
      `${baseSelect}
       WHERE c.teacher_id = $1
         AND ${rangeCondition}
       ORDER BY COALESCE(s.scheduled_at, s.start_time) ASC NULLS LAST, s.id ASC`;
    params = [user.id, from, to];
  } else if (user.role === 'student') {
    query =
      `${baseSelect}
       JOIN class_members cm ON cm.class_id = s.class_id
       WHERE cm.student_id = $1
         AND ${rangeCondition}
       ORDER BY COALESCE(s.scheduled_at, s.start_time) ASC NULLS LAST, s.id ASC`;
    params = [user.id, from, to];
  } else {
    const adminRangeCondition =
      'COALESCE(s.scheduled_at, s.start_time) BETWEEN $1 AND $2';
    query =
      `${baseSelect}
       WHERE ${adminRangeCondition}
       ORDER BY COALESCE(s.scheduled_at, s.start_time) ASC NULLS LAST, s.id ASC`;
    params = [from, to];
  }

  const result = await pool.query(query, params);
  return result.rows;
}

module.exports = {
  createSession,
  getSessionsByClass,
  getSessionById,
  startSession,
  endSession,
  verifyUserCanJoin,
  verifyUserCanAccessSession,
  updateSession,
  deleteSession,
  getMySessions,
};
