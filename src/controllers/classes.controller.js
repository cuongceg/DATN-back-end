const classesService = require('../services/classes.service');

const ALLOWED_CLASS_MEMBER_PERMISSIONS = ['Member', 'Owner'];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function handleServiceError(res, error, next) {
  if (error && error.status) {
    const body = { message: error.message };
    if (error.details) body.details = error.details;
    return res.status(error.status).json(body);
  }
  return next(error);
}

async function createClass(req, res, next) {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Class name is required.' });
  }

  try {
    const createdClass = await classesService.createClass(req.user.id, name, description);
    return res.status(201).json({ message: 'Class created successfully.', class: createdClass });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function listTeacherClasses(req, res, next) {
  try {
    const classes = await classesService.listClasses(req.user);
    return res.status(200).json({ classes });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function fetchClassDetails(req, res, next) {
  const { id: classId } = req.params;

  try {
    const { classData, members } = await classesService.fetchClassDetails(req.user, classId);
    return res.status(200).json({
      class: classData,
      members,
      total_members: members.length,
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function updateClass(req, res, next) {
  const { id } = req.params;
  const { name, description } = req.body;

  if (name === undefined && description === undefined) {
    return res.status(400).json({ message: 'At least one field (name, description) is required.' });
  }

  try {
    const updated = await classesService.updateClass(req.user, id, name, description);
    return res.status(200).json({ message: 'Class updated successfully.', class: updated });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function deleteClass(req, res, next) {
  const { id } = req.params;

  try {
    const deleted = await classesService.deleteClass(req.user, id);
    return res.status(200).json({ message: 'Class deleted successfully.', class: deleted });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function archiveClass(req, res, next) {
  const { id: classId } = req.params;

  if (!isUuid(classId)) {
    return res.status(400).json({ message: 'id must be a valid UUID.' });
  }

  try {
    const updated = await classesService.archiveClass(req.user, classId);
    return res.status(200).json({ message: 'Class archived successfully.', class: updated });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function activeClass(req, res, next) {
  const { id: classId } = req.params;

  if (!isUuid(classId)) {
    return res.status(400).json({ message: 'id must be a valid UUID.' });
  }

  try {
    const updated = await classesService.activeClass(req.user, classId);
    return res.status(200).json({ message: 'Class activated successfully.', class: updated });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function joinClass(req, res, next) {
  const { class_code: classCodeRaw } = req.body;

  if (!classCodeRaw || typeof classCodeRaw !== 'string') {
    return res.status(400).json({ message: 'class_code is required.' });
  }

  const classCode = classCodeRaw.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(classCode)) {
    return res.status(400).json({ message: 'class_code must be 6 uppercase letters/numbers.' });
  }

  try {
    const { classData, membership } = await classesService.joinClass(req.user.id, classCode);
    return res.status(201).json({
      message: 'Joined class successfully.',
      class: classData,
      membership,
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function addStudentToClass(req, res, next) {
  const { id: classId } = req.params;
  const { student_id: studentId, permission = 'Member' } = req.body;

  if (!studentId) {
    return res.status(400).json({ message: 'student_id is required.' });
  }

  if (!ALLOWED_CLASS_MEMBER_PERMISSIONS.includes(permission)) {
    return res.status(400).json({ message: 'Invalid permission. Allowed values: Member, Owner.' });
  }

  try {
    const membership = await classesService.addStudentToClass(req.user, classId, studentId, permission);
    return res.status(201).json({ message: 'Student added to class successfully.', membership });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function addStudentsToClassBulk(req, res, next) {
  const { id: classId } = req.params;
  const { members } = req.body;

  if (!Array.isArray(members) || members.length === 0) {
    return res.status(400).json({ message: 'members must be a non-empty array.' });
  }

  const normalizedMembers = members.map((member) => ({
    student_id: member.student_id,
    permission: member.permission || 'Member',
  }));

  if (normalizedMembers.some((member) => !member.student_id)) {
    return res.status(400).json({ message: 'Each member must include student_id.' });
  }

  if (normalizedMembers.some((member) => !ALLOWED_CLASS_MEMBER_PERMISSIONS.includes(member.permission))) {
    return res.status(400).json({ message: 'Invalid permission. Allowed values: Member, Owner.' });
  }

  const studentIds = normalizedMembers.map((member) => member.student_id);
  const uniqueStudentIds = [...new Set(studentIds)];
  if (uniqueStudentIds.length !== studentIds.length) {
    return res.status(400).json({ message: 'members contains duplicate student_id values.' });
  }

  try {
    const insertedMembers = await classesService.addStudentsToClassBulk(req.user, classId, normalizedMembers);
    return res.status(201).json({ message: 'Members added successfully.', members: insertedMembers });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function updateMemberRole(req, res, next) {
  const { id: classId, userId } = req.params;
  const { role } = req.body;

  if (!role) {
    return res.status(400).json({ message: 'role is required.' });
  }

  if (!ALLOWED_CLASS_MEMBER_PERMISSIONS.includes(role)) {
    return res.status(400).json({ message: 'Invalid role. Allowed values: Member, Owner.' });
  }

  try {
    const membership = await classesService.updateMemberRole(req.user, classId, userId, role);
    return res.status(200).json({ message: 'Member role updated successfully.', membership });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function removeMember(req, res, next) {
  const { id: classId, userId } = req.params;

  try {
    const membership = await classesService.removeMember(req.user, classId, userId);
    return res.status(200).json({ message: 'Member removed successfully.', membership });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

module.exports = {
  createClass,
  listTeacherClasses,
  fetchClassDetails,
  updateClass,
  deleteClass,
  archiveClass,
  activeClass,
  joinClass,
  addStudentToClass,
  addStudentsToClassBulk,
  updateMemberRole,
  removeMember,
};
