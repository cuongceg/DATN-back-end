const sessionsModel = require('../models/sessions.model');
const classesModel = require('../models/classes.model');
const { deleteLiveKitRoom } = require('./livekit.service');

async function createSession(classId, teacherId, { title, scheduledAt, scheduledEndAt }) {
  const classResult = await classesModel.findByIdAndTeacher(classId, teacherId);
  if (!classResult) {
    const error = new Error('You do not have permission to create a session for this class.');
    error.status = 403;
    throw error;
  }

  const newSession = await sessionsModel.create(classId, title, scheduledAt, scheduledEndAt);
  await sessionsModel.createSessionPost(classId, teacherId, newSession.id);
  return newSession;
}

async function getSessionsByClass(classId) {
  return sessionsModel.findByClass(classId);
}

async function getSessionById(sessionId) {
  const session = await sessionsModel.findById(sessionId);
  if (!session) {
    const error = new Error('Session not found.');
    error.status = 404;
    throw error;
  }
  return session;
}

async function startSession(sessionId, teacherId) {
  const session = await sessionsModel.startSession(sessionId, teacherId);
  if (!session) {
    const error = new Error('Unable to start session.');
    error.status = 400;
    throw error;
  }
  return session;
}

async function endSession(sessionId, teacherId) {
  const session = await sessionsModel.endSession(sessionId, teacherId);
  if (!session) {
    const error = new Error('Unable to end session.');
    error.status = 400;
    throw error;
  }
  if (session.livekit_room_id) {
    await deleteLiveKitRoom(session.livekit_room_id);
  }
  return session;
}

async function verifyUserCanJoin(userId, sessionId) {
  const session = await sessionsModel.findWithClass(sessionId);
  if (!session) {
    const error = new Error('Session not found.');
    error.status = 404;
    throw error;
  }

  if (session.status === 'completed') {
    const error = new Error('Session has already ended.');
    error.status = 400;
    throw error;
  }

  if (session.teacher_id === userId) {
    return { session, role: 'teacher' };
  }

  const member = await sessionsModel.findClassMember(session.class_id, userId);
  if (!member) {
    const error = new Error('You are not a member of this class.');
    error.status = 403;
    throw error;
  }

  return { session, role: 'student', permission: member.permission };
}

async function verifyUserCanAccessSession(user, sessionId) {
  const session = await sessionsModel.findWithClass(sessionId);
  if (!session) {
    const error = new Error('Session not found.');
    error.status = 404;
    throw error;
  }

  if (user.role === 'admin') {
    return { session, role: 'admin' };
  }

  if (session.teacher_id === user.id) {
    return { session, role: 'teacher' };
  }

  const member = await sessionsModel.findClassMember(session.class_id, user.id);
  if (!member) {
    const error = new Error('You are not a member of this class.');
    error.status = 403;
    throw error;
  }

  return { session, role: 'student' };
}

async function verifyUserCanAccessClass(user, classId) {
  const classResult = await classesModel.findById(classId);
  if (!classResult) {
    const error = new Error('Class not found.');
    error.status = 404;
    throw error;
  }

  if (user.role === 'admin') return { role: 'admin' };
  if (classResult.teacher_id === user.id) return { role: 'teacher' };

  const isMember = await classesModel.checkMembership(classId, user.id);
  if (!isMember) {
    const error = new Error('You are not a member of this class.');
    error.status = 403;
    throw error;
  }

  return { role: 'student' };
}

async function updateSession(sessionId, teacherId, { title, scheduledAt, scheduledEndAt }) {
  const session = await sessionsModel.findWithTeacher(sessionId);
  if (!session) {
    const error = new Error('Session not found.');
    error.status = 404;
    throw error;
  }

  if (session.teacher_id !== teacherId) {
    const error = new Error('You do not have permission to update this session.');
    error.status = 403;
    throw error;
  }

  if (
    (scheduledAt !== undefined && scheduledAt !== null) ||
    (scheduledEndAt !== undefined && scheduledEndAt !== null)
  ) {
    if (session.status === 'ongoing' || session.status === 'completed') {
      const error = new Error('Cannot reschedule a session that is already ongoing or completed.');
      error.status = 400;
      throw error;
    }
  }

  return sessionsModel.update(sessionId, title ?? null, scheduledAt ?? null, scheduledEndAt ?? null);
}

async function deleteSession(sessionId, teacherId) {
  const session = await sessionsModel.findWithTeacher(sessionId);
  if (!session) {
    const error = new Error('Session not found.');
    error.status = 404;
    throw error;
  }

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

  return sessionsModel.deleteById(sessionId);
}

async function getMySessions(user, { from, to }) {
  return sessionsModel.getMySessions(user.role, user.id, from, to);
}

async function recordParticipantJoin(sessionId, userId) {
  await sessionsModel.upsertParticipant(sessionId, userId);
}

async function findParticipant(sessionId, userId) {
  return sessionsModel.findParticipant(sessionId, userId);
}

async function leaveSession(sessionId, userId) {
  return sessionsModel.leaveSession(sessionId, userId);
}

async function getParticipants(sessionId) {
  return sessionsModel.getParticipants(sessionId);
}

async function getMessages(sessionId, limit, offset) {
  return sessionsModel.getMessages(sessionId, limit, offset);
}

async function createMessage(sessionId, senderId, content) {
  return sessionsModel.createMessage(sessionId, senderId, content);
}

module.exports = {
  createSession,
  getSessionsByClass,
  getSessionById,
  startSession,
  endSession,
  verifyUserCanJoin,
  verifyUserCanAccessClass,
  verifyUserCanAccessSession,
  updateSession,
  deleteSession,
  getMySessions,
  recordParticipantJoin,
  findParticipant,
  leaveSession,
  getParticipants,
  getMessages,
  createMessage,
};
