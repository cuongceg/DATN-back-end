const pool = require('../config/db');
const classesModel = require('../models/classes.model');

function generateClassCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * chars.length);
    code += chars[idx];
  }
  return code;
}

async function createClass(teacherId, name, description) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      const classCode = generateClassCode();
      return await classesModel.create(teacherId, classCode, name, description || null);
    } catch (error) {
      if (error.code === '23505') {
        continue;
      }
      throw error;
    }
  }
  const error = new Error('Could not generate unique class code. Please try again.');
  error.status = 500;
  throw error;
}

async function listClasses(user) {
  if (user.role === 'teacher') return classesModel.listByTeacher(user.id);
  if (user.role === 'student') return classesModel.listByStudent(user.id);
  return classesModel.listAll();
}

async function fetchClassDetails(user, classId) {
  const classData = await classesModel.findById(classId);
  if (!classData) {
    const error = new Error('Class not found.');
    error.status = 404;
    throw error;
  }

  if (user.role === 'teacher' && classData.teacher_id !== user.id) {
    const error = new Error('Forbidden: you cannot view this class.');
    error.status = 403;
    throw error;
  }

  if (user.role === 'student') {
    const isMember = await classesModel.checkMembership(classId, user.id);
    if (!isMember) {
      const error = new Error('Forbidden: you are not a member of this class.');
      error.status = 403;
      throw error;
    }
  }

  const members = await classesModel.getMembers(classId);
  return { classData, members };
}

async function updateClass(user, classId, name, description) {
  const updated = await classesModel.update(classId, user.id, name, description);
  if (!updated) {
    const error = new Error('Class not found or you do not own this class.');
    error.status = 404;
    throw error;
  }
  return updated;
}

async function deleteClass(user, classId) {
  const deleted = await classesModel.deleteById(classId, user.id);
  if (!deleted) {
    const error = new Error('Class not found or you do not own this class.');
    error.status = 404;
    throw error;
  }
  return deleted;
}

async function archiveClass(user, classId) {
  const classData = await classesModel.findByIdAndTeacher(classId, user.id);
  if (!classData) {
    const error = new Error('Class not found or you do not own this class.');
    error.status = 404;
    throw error;
  }

  const updated = await classesModel.setStatus(classId, user.id, 'active', 'archived');
  if (!updated) {
    const error = new Error('Only active classes can be archived.');
    error.status = 409;
    throw error;
  }
  return updated;
}

async function activeClass(user, classId) {
  const classData = await classesModel.findByIdAndTeacher(classId, user.id);
  if (!classData) {
    const error = new Error('Class not found or you do not own this class.');
    error.status = 404;
    throw error;
  }

  const updated = await classesModel.setStatus(classId, user.id, 'archived', 'active');
  if (!updated) {
    const error = new Error('Only archived classes can be activated.');
    error.status = 409;
    throw error;
  }
  return updated;
}

async function joinClass(studentId, classCode) {
  const classData = await classesModel.findByCode(classCode);
  if (!classData) {
    const error = new Error('Class not found.');
    error.status = 404;
    throw error;
  }

  const membership = await classesModel.addMember(classData.id, studentId, 'Member');
  if (!membership) {
    const error = new Error('Student already joined this class.');
    error.status = 409;
    throw error;
  }

  return { classData, membership };
}

async function addStudentToClass(user, classId, studentId, permission) {
  const classResult = await classesModel.findByIdAndTeacher(classId, user.id);
  if (!classResult) {
    const error = new Error('Class not found or you do not own this class.');
    error.status = 404;
    throw error;
  }

  const student = await classesModel.findStudent(studentId);
  if (!student) {
    const error = new Error('Student not found.');
    error.status = 404;
    throw error;
  }
  if (student.role !== 'student') {
    const error = new Error('Provided user is not a student.');
    error.status = 400;
    throw error;
  }

  const membership = await classesModel.addMember(classId, studentId, permission);
  if (!membership) {
    const error = new Error('Student is already a member of this class.');
    error.status = 409;
    throw error;
  }
  return membership;
}

async function addStudentsToClassBulk(user, classId, normalizedMembers) {
  const classResult = await classesModel.findByIdAndTeacher(classId, user.id);
  if (!classResult) {
    const error = new Error('Class not found or you do not own this class.');
    error.status = 404;
    throw error;
  }

  const uniqueStudentIds = [...new Set(normalizedMembers.map((m) => m.student_id))];
  const students = await classesModel.findStudentsByIds(uniqueStudentIds);
  const foundStudents = new Map(students.map((row) => [row.id, row.role]));
  const notFoundStudents = uniqueStudentIds.filter((id) => !foundStudents.has(id));
  const nonStudentUsers = uniqueStudentIds.filter(
    (id) => foundStudents.has(id) && foundStudents.get(id) !== 'student'
  );

  if (notFoundStudents.length > 0 || nonStudentUsers.length > 0) {
    const error = new Error('Some members are invalid.');
    error.status = 400;
    error.details = { not_found_student_ids: notFoundStudents, non_student_user_ids: nonStudentUsers };
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const insertedMembers = [];
    for (const member of normalizedMembers) {
      const row = await classesModel.upsertMember(client, classId, member.student_id, member.permission);
      insertedMembers.push(row);
    }
    await client.query('COMMIT');
    return insertedMembers;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw error;
  } finally {
    client.release();
  }
}

async function updateMemberRole(user, classId, userId, role) {
  const classResult = await classesModel.findByIdAndTeacher(classId, user.id);
  if (!classResult) {
    const error = new Error('Class not found or you do not own this class.');
    error.status = 404;
    throw error;
  }

  const membership = await classesModel.updateMemberPermission(classId, userId, role);
  if (!membership) {
    const error = new Error('Member not found in this class.');
    error.status = 404;
    throw error;
  }
  return membership;
}

async function removeMember(user, classId, userId) {
  const classResult = await classesModel.findByIdAndTeacher(classId, user.id);
  if (!classResult) {
    const error = new Error('Class not found or you do not own this class.');
    error.status = 404;
    throw error;
  }

  const membership = await classesModel.removeMember(classId, userId);
  if (!membership) {
    const error = new Error('Member not found in this class.');
    error.status = 404;
    throw error;
  }
  return membership;
}

async function getClassById(classId) {
  return classesModel.findById(classId);
}

async function getMembersForClass(classId) {
  return classesModel.getMembers(classId);
}

module.exports = {
  createClass,
  listClasses,
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
  getClassById,
  getMembersForClass,
};
