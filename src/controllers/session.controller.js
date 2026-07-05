const sessionService = require('../services/session.service');
const usersService = require('../services/users.service');
const classesService = require('../services/classes.service');
const emailService = require('../services/email.service');
const { generateLiveKitToken } = require('../services/livekit.service');

function handleServiceError(res, error, next) {
  if (error && error.status) {
    return res.status(error.status).json({ message: error.message });
  }
  return next(error);
}

function validateScheduleFields(scheduledAt, scheduledEndAt) {
  const hasStart = scheduledAt !== undefined && scheduledAt !== null;
  const hasEnd = scheduledEndAt !== undefined && scheduledEndAt !== null;

  if (hasStart !== hasEnd) {
    return {
      valid: false,
      message: 'scheduledAt and scheduledEndAt must both be provided or both omitted.',
    };
  }

  if (hasStart && hasEnd) {
    const startMs = Date.parse(scheduledAt);
    const endMs = Date.parse(scheduledEndAt);

    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      return { valid: false, message: 'scheduledAt and scheduledEndAt must be valid ISO dates.' };
    }

    if (startMs >= endMs) {
      return { valid: false, message: 'scheduledAt must be earlier than scheduledEndAt.' };
    }
  }

  return { valid: true };
}

async function createSession(req, res, next) {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Only teachers can create sessions.' });
  }

  const { classId, title, scheduledAt, scheduledEndAt } = req.body;

  if (!classId || !title) {
    return res.status(400).json({ message: 'classId and title are required.' });
  }

  const scheduleValidation = validateScheduleFields(scheduledAt, scheduledEndAt);
  if (!scheduleValidation.valid) {
    return res.status(400).json({ message: scheduleValidation.message });
  }

  try {
    const session = await sessionService.createSession(classId, req.user.id, {
      title,
      scheduledAt,
      scheduledEndAt,
    });

    let emailNotification;
    const isScheduled = scheduledAt !== undefined && scheduledAt !== null;
    if (isScheduled) {
      try {
        const [classData, members, teacher] = await Promise.all([
          classesService.getClassById(classId),
          classesService.getMembersForClass(classId),
          usersService.findById(req.user.id),
        ]);

        const toList = members
          .filter((m) => m.email && typeof m.email === 'string')
          .map((m) => ({ email: m.email, name: m.full_name }));

        emailNotification = await emailService.sendSessionScheduledEmail({
          toList,
          session,
          className: classData?.name || '',
          teacherName: teacher?.full_name || '',
        });
      } catch (emailError) {
        console.error('[session.controller] Email notification error:', emailError?.message || emailError);
        emailNotification = { sent: 0, failed: -1 };
      }
    }

    const response = { message: 'Session created successfully.', session };
    if (emailNotification !== undefined) {
      response.emailNotification = emailNotification;
    }

    return res.status(201).json(response);
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

  if (hasTitle && (typeof title !== 'string' || !title.trim())) {
    return res.status(400).json({ message: 'title must be a non-empty string.' });
  }

  if (hasScheduledAt && scheduledAt !== null && Number.isNaN(Date.parse(scheduledAt))) {
    return res.status(400).json({ message: 'scheduledAt must be a valid ISO date.' });
  }

  if (hasScheduledEndAt && scheduledEndAt !== null && Number.isNaN(Date.parse(scheduledEndAt))) {
    return res.status(400).json({ message: 'scheduledEndAt must be a valid ISO date.' });
  }

  if (hasScheduledAt && scheduledAt !== null && hasScheduledEndAt && scheduledEndAt !== null) {
    if (!Number.isNaN(Date.parse(scheduledAt)) && !Number.isNaN(Date.parse(scheduledEndAt))) {
      if (Date.parse(scheduledEndAt) <= Date.parse(scheduledAt)) {
        return res.status(400).json({ message: 'scheduledEndAt must be after scheduledAt.' });
      }
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
    return res.status(200).json({ message: 'Session deleted successfully.', session: deleted });
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
    return res.status(200).json({ message: 'Session started successfully.', session });
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
    return res.status(200).json({ message: 'Session ended successfully.', session });
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

    const user = await usersService.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const grants = {
      roomAdmin: role === 'teacher',
      user: { full_name: user.full_name, role },
      role,
    };

    const token = await generateLiveKitToken(session.livekit_room_id, req.user.id, grants);
    await sessionService.recordParticipantJoin(sessionId, req.user.id);

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
    const participants = await sessionService.getParticipants(sessionId);
    return res.status(200).json({
      session_id: sessionId,
      total_count: participants.length,
      participants,
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function leaveSession(req, res, next) {
  const { sessionId } = req.params;

  try {
    await sessionService.verifyUserCanAccessSession(req.user, sessionId);

    const participant = await sessionService.findParticipant(sessionId, req.user.id);
    if (!participant) {
      return res.status(400).json({ message: 'You have not joined this session.' });
    }
    if (participant.left_at) {
      return res.status(400).json({ message: 'You have already left this session.' });
    }

    const updated = await sessionService.leaveSession(sessionId, req.user.id);
    return res.status(200).json({ message: 'Left session successfully.', participant: updated });
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
    const messages = await sessionService.getMessages(sessionId, limit, offset);
    return res.status(200).json({ messages });
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

    const message_data = await sessionService.createMessage(sessionId, req.user.id, content.trim());
    return res.status(201).json({ message: 'Message sent successfully.', message_data });
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
