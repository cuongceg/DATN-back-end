const pool = require('../config/db');

const SESSION_COLS =
  'id, class_id, livekit_room_id, title, scheduled_at, scheduled_end_at, start_time, end_time, status';

async function create(classId, title, scheduledAt, scheduledEndAt) {
  const { rows } = await pool.query(
    `INSERT INTO sessions (class_id, title, scheduled_at, scheduled_end_at, start_time, status)
     VALUES ($1, $2, $3, $4, NULL, 'scheduled')
     RETURNING ${SESSION_COLS}`,
    [classId, title, scheduledAt || null, scheduledEndAt || null]
  );
  return rows[0];
}

async function createSessionPost(classId, authorId, sessionId) {
  await pool.query(
    `INSERT INTO posts (class_id, author_id, type, session_id) VALUES ($1, $2, 'session', $3)`,
    [classId, authorId, sessionId]
  );
}

async function findById(sessionId) {
  const { rows } = await pool.query(
    `SELECT ${SESSION_COLS} FROM sessions WHERE id = $1`,
    [sessionId]
  );
  return rows[0] || null;
}

async function findByClass(classId) {
  const { rows } = await pool.query(
    `SELECT ${SESSION_COLS}
     FROM sessions
     WHERE class_id = $1
     ORDER BY scheduled_at DESC NULLS LAST, start_time DESC NULLS LAST, id DESC`,
    [classId]
  );
  return rows;
}

async function findWithClass(sessionId) {
  const { rows } = await pool.query(
    `SELECT s.id, s.class_id, s.status, s.livekit_room_id, c.teacher_id
     FROM sessions s
     JOIN classes c ON c.id = s.class_id
     WHERE s.id = $1`,
    [sessionId]
  );
  return rows[0] || null;
}

async function findWithTeacher(sessionId) {
  const { rows } = await pool.query(
    `SELECT s.id, s.status, c.teacher_id
     FROM sessions s
     JOIN classes c ON c.id = s.class_id
     WHERE s.id = $1`,
    [sessionId]
  );
  return rows[0] || null;
}

async function startSession(sessionId, teacherId) {
  const { rows } = await pool.query(
    `UPDATE sessions
     SET status = 'ongoing',
         start_time = NOW(),
         livekit_room_id = id::text
     WHERE id = $1
       AND class_id IN (SELECT id FROM classes WHERE teacher_id = $2)
       AND status = 'scheduled'
     RETURNING ${SESSION_COLS}`,
    [sessionId, teacherId]
  );
  return rows[0] || null;
}

async function endSession(sessionId, teacherId) {
  const { rows } = await pool.query(
    `UPDATE sessions
     SET status = 'completed',
         end_time = NOW()
     WHERE id = $1
       AND class_id IN (SELECT id FROM classes WHERE teacher_id = $2)
       AND status = 'ongoing'
     RETURNING ${SESSION_COLS}`,
    [sessionId, teacherId]
  );
  return rows[0] || null;
}

async function update(sessionId, title, scheduledAt, scheduledEndAt) {
  const { rows } = await pool.query(
    `UPDATE sessions
     SET title = COALESCE($2, title),
         scheduled_at = COALESCE($3, scheduled_at),
         scheduled_end_at = COALESCE($4, scheduled_end_at)
     WHERE id = $1
     RETURNING ${SESSION_COLS}`,
    [sessionId, title ?? null, scheduledAt ?? null, scheduledEndAt ?? null]
  );
  return rows[0] || null;
}

async function deleteById(sessionId) {
  const { rows } = await pool.query(
    'DELETE FROM sessions WHERE id = $1 RETURNING id, title',
    [sessionId]
  );
  return rows[0] || null;
}

async function getMySessions(role, userId, from, to) {
  const baseSelect = `
    SELECT s.id, s.class_id, c.name AS class_name, s.title,
           s.scheduled_at, s.scheduled_end_at, s.start_time, s.end_time, s.status
    FROM sessions s
    JOIN classes c ON c.id = s.class_id`;

  const rangeCondition = 'COALESCE(s.scheduled_at, s.start_time) BETWEEN $2 AND $3';

  if (role === 'teacher') {
    const { rows } = await pool.query(
      `${baseSelect}
       WHERE c.teacher_id = $1 AND ${rangeCondition}
       ORDER BY COALESCE(s.scheduled_at, s.start_time) ASC NULLS LAST, s.id ASC`,
      [userId, from, to]
    );
    return rows;
  }

  if (role === 'student') {
    const { rows } = await pool.query(
      `${baseSelect}
       JOIN class_members cm ON cm.class_id = s.class_id
       WHERE cm.student_id = $1 AND ${rangeCondition}
       ORDER BY COALESCE(s.scheduled_at, s.start_time) ASC NULLS LAST, s.id ASC`,
      [userId, from, to]
    );
    return rows;
  }

  const { rows } = await pool.query(
    `${baseSelect}
     WHERE COALESCE(s.scheduled_at, s.start_time) BETWEEN $1 AND $2
     ORDER BY COALESCE(s.scheduled_at, s.start_time) ASC NULLS LAST, s.id ASC`,
    [from, to]
  );
  return rows;
}

async function findClassMember(classId, studentId) {
  const { rows } = await pool.query(
    'SELECT permission FROM class_members WHERE class_id = $1 AND student_id = $2',
    [classId, studentId]
  );
  return rows[0] || null;
}

async function findParticipant(sessionId, userId) {
  const { rows } = await pool.query(
    `SELECT session_id, user_id, joined_at, left_at
     FROM session_participants
     WHERE session_id = $1 AND user_id = $2`,
    [sessionId, userId]
  );
  return rows[0] || null;
}

async function upsertParticipant(sessionId, userId) {
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
    [sessionId, userId]
  );
}

async function leaveSession(sessionId, userId) {
  const { rows } = await pool.query(
    `UPDATE session_participants
     SET left_at = NOW()
     WHERE session_id = $1 AND user_id = $2
     RETURNING session_id, user_id, joined_at, left_at`,
    [sessionId, userId]
  );
  return rows[0] || null;
}

async function getParticipants(sessionId) {
  const { rows } = await pool.query(
    `SELECT u.id AS user_id, u.full_name, u.role, sp.joined_at, sp.left_at,
            (sp.left_at IS NULL) AS is_online
     FROM session_participants sp
     JOIN users u ON u.id = sp.user_id
     WHERE sp.session_id = $1
     ORDER BY sp.joined_at ASC`,
    [sessionId]
  );
  return rows;
}

async function getMessages(sessionId, limit, offset) {
  const { rows } = await pool.query(
    `SELECT m.id, u.full_name AS sender_name, m.content, m."timestamp", m.sender_id
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.session_id = $1
     ORDER BY m."timestamp" ASC
     LIMIT $2 OFFSET $3`,
    [sessionId, limit, offset]
  );
  return rows;
}

async function createMessage(sessionId, senderId, content) {
  const { rows } = await pool.query(
    `INSERT INTO messages (session_id, sender_id, content)
     VALUES ($1, $2, $3)
     RETURNING id, session_id, sender_id, content, "timestamp"`,
    [sessionId, senderId, content]
  );
  return rows[0];
}

async function completeByLivekitRoom(roomName) {
  await pool.query(
    `UPDATE sessions
     SET status = 'completed',
         end_time = COALESCE(end_time, NOW())
     WHERE livekit_room_id = $1 AND status <> 'completed'`,
    [roomName]
  );
}

module.exports = {
  create,
  createSessionPost,
  findById,
  findByClass,
  findWithClass,
  findWithTeacher,
  startSession,
  endSession,
  update,
  deleteById,
  getMySessions,
  findClassMember,
  findParticipant,
  upsertParticipant,
  leaveSession,
  getParticipants,
  getMessages,
  createMessage,
  completeByLivekitRoom,
};
