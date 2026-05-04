const pool = require('../config/db');

const ALLOWED_CLASS_MEMBER_PERMISSIONS = ['Member', 'Owner'];

function generateClassCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * chars.length);
    code += chars[idx];
  }
  return code;
}

async function createClass(req, res, next) {
  const { name, description } = req.body;
  const teacherId = req.user.id;

  if (!name) {
    return res.status(400).json({ message: 'Class name is required.' });
  }

  try {
    const query = `
      INSERT INTO classes (teacher_id, class_code, name, description)
      VALUES ($1, $2, $3, $4)
      RETURNING id, teacher_id, class_code, name, description, created_at
    `;

    let createdClass = null;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        const classCode = generateClassCode();
        const { rows } = await pool.query(query, [teacherId, classCode, name, description || null]);
        createdClass = rows[0];
        break;
      } catch (error) {
        if (error.code === '23505') {
          continue;
        }
        throw error;
      }
    }

    if (!createdClass) {
      return res.status(500).json({ message: 'Could not generate unique class code. Please try again.' });
    }

    return res.status(201).json({
      message: 'Class created successfully.',
      class: createdClass,
    });
  } catch (error) {
    return next(error);
  }
}

async function listTeacherClasses(req, res, next) {
  try {
    let rows;

    if (req.user.role === 'teacher') {
      const result = await pool.query(
        `SELECT id, teacher_id, class_code, name, description, created_at
         FROM classes
         WHERE teacher_id = $1
         ORDER BY created_at DESC`,
        [req.user.id]
      );
      rows = result.rows;
    } else if (req.user.role === 'student') {
      const result = await pool.query(
        `SELECT c.id, c.teacher_id, c.class_code, c.name, c.description, c.created_at, cm.permission, cm.joined_at
         FROM class_members cm
         INNER JOIN classes c ON c.id = cm.class_id
         WHERE cm.student_id = $1
         ORDER BY c.created_at DESC`,
        [req.user.id]
      );
      rows = result.rows;
    } else {
      const result = await pool.query(
        `SELECT id, teacher_id, class_code, name, description, created_at
         FROM classes
         ORDER BY created_at DESC`
      );
      rows = result.rows;
    }

    return res.status(200).json({ classes: rows });
  } catch (error) {
    return next(error);
  }
}

async function fetchClassDetails(req, res, next) {
  const { id: classId } = req.params;

  try {
    const classResult = await pool.query(
      `SELECT id, teacher_id, class_code, name, description, created_at
       FROM classes
       WHERE id = $1`,
      [classId]
    );

    if (classResult.rows.length === 0) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    const classData = classResult.rows[0];

    if (req.user.role === 'teacher' && classData.teacher_id !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: you cannot view this class.' });
    }

    if (req.user.role === 'student') {
      const membershipCheck = await pool.query(
        'SELECT 1 FROM class_members WHERE class_id = $1 AND student_id = $2',
        [classId, req.user.id]
      );

      if (membershipCheck.rows.length === 0) {
        return res.status(403).json({ message: 'Forbidden: you are not a member of this class.' });
      }
    }

    const membersResult = await pool.query(
      `SELECT cm.student_id AS user_id, u.full_name, u.email, u.role, cm.permission, cm.joined_at
       FROM class_members cm
       INNER JOIN users u ON u.id = cm.student_id
       WHERE cm.class_id = $1
       ORDER BY u.full_name ASC`,
      [classId]
    );

    return res.status(200).json({
      class: classData,
      members: membersResult.rows,
      total_members: membersResult.rows.length,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateClass(req, res, next) {
  const { id } = req.params;
  const { name, description } = req.body;

  if (name === undefined && description === undefined) {
    return res.status(400).json({ message: 'At least one field (name, description) is required.' });
  }

  try {
    const query = `
      UPDATE classes
      SET
        name = COALESCE($1, name),
        description = COALESCE($2, description)
      WHERE id = $3 AND teacher_id = $4
      RETURNING id, teacher_id, class_code, name, description, created_at
    `;

    const values = [name ?? null, description ?? null, id, req.user.id];
    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Class not found or you do not own this class.' });
    }

    return res.status(200).json({
      message: 'Class updated successfully.',
      class: rows[0],
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteClass(req, res, next) {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `DELETE FROM classes
       WHERE id = $1 AND teacher_id = $2
       RETURNING id, class_code, name`,
      [id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Class not found or you do not own this class.' });
    }

    return res.status(200).json({
      message: 'Class deleted successfully.',
      class: rows[0],
    });
  } catch (error) {
    return next(error);
  }
}

async function joinClass(req, res, next) {
  const { class_code: classCodeRaw } = req.body;
  const studentId = req.user.id;

  if (!classCodeRaw || typeof classCodeRaw !== 'string') {
    return res.status(400).json({ message: 'class_code is required.' });
  }

  const classCode = classCodeRaw.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(classCode)) {
    return res.status(400).json({ message: 'class_code must be 6 uppercase letters/numbers.' });
  }

  try {
    const classCheck = await pool.query(
      'SELECT id, teacher_id, class_code, name, description, created_at FROM classes WHERE class_code = $1',
      [classCode]
    );

    if (classCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    const classData = classCheck.rows[0];

    const membership = await pool.query(
      `INSERT INTO class_members (class_id, student_id, permission)
       VALUES ($1, $2, $3)
       ON CONFLICT (class_id, student_id) DO NOTHING
       RETURNING class_id, student_id, permission, joined_at`,
      [classData.id, studentId, 'Member']
    );

    if (membership.rows.length === 0) {
      return res.status(409).json({ message: 'Student already joined this class.' });
    }

    return res.status(201).json({
      message: 'Joined class successfully.',
      class: classData,
      membership: membership.rows[0],
    });
  } catch (error) {
    return next(error);
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
    const classResult = await pool.query(
      'SELECT id FROM classes WHERE id = $1 AND teacher_id = $2',
      [classId, req.user.id]
    );

    if (classResult.rows.length === 0) {
      return res.status(404).json({ message: 'Class not found or you do not own this class.' });
    }

    const studentResult = await pool.query(
      'SELECT id, role FROM users WHERE id = $1',
      [studentId]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    if (studentResult.rows[0].role !== 'student') {
      return res.status(400).json({ message: 'Provided user is not a student.' });
    }

    const membership = await pool.query(
      `INSERT INTO class_members (class_id, student_id, permission)
       VALUES ($1, $2, $3)
       ON CONFLICT (class_id, student_id) DO NOTHING
       RETURNING class_id, student_id, permission, joined_at`,
      [classId, studentId, permission]
    );

    if (membership.rows.length === 0) {
      return res.status(409).json({ message: 'Student is already a member of this class.' });
    }

    return res.status(201).json({
      message: 'Student added to class successfully.',
      membership: membership.rows[0],
    });
  } catch (error) {
    return next(error);
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

  const missingStudentIds = normalizedMembers.some((member) => !member.student_id);
  if (missingStudentIds) {
    return res.status(400).json({ message: 'Each member must include student_id.' });
  }

  const invalidPermission = normalizedMembers.some(
    (member) => !ALLOWED_CLASS_MEMBER_PERMISSIONS.includes(member.permission)
  );
  if (invalidPermission) {
    return res.status(400).json({ message: 'Invalid permission. Allowed values: Member, Owner.' });
  }

  const studentIds = normalizedMembers.map((member) => member.student_id);
  const uniqueStudentIds = [...new Set(studentIds)];

  if (uniqueStudentIds.length !== studentIds.length) {
    return res.status(400).json({ message: 'members contains duplicate student_id values.' });
  }

  const client = await pool.connect();
  try {
    const classResult = await client.query(
      'SELECT id FROM classes WHERE id = $1 AND teacher_id = $2',
      [classId, req.user.id]
    );

    if (classResult.rows.length === 0) {
      return res.status(404).json({ message: 'Class not found or you do not own this class.' });
    }

    const studentsResult = await client.query(
      'SELECT id, role FROM users WHERE id = ANY($1::uuid[])',
      [uniqueStudentIds]
    );

    const foundStudents = new Map(studentsResult.rows.map((row) => [row.id, row.role]));
    const notFoundStudents = uniqueStudentIds.filter((id) => !foundStudents.has(id));
    const nonStudentUsers = uniqueStudentIds.filter((id) => foundStudents.has(id) && foundStudents.get(id) !== 'student');

    if (notFoundStudents.length > 0 || nonStudentUsers.length > 0) {
      return res.status(400).json({
        message: 'Some members are invalid.',
        details: {
          not_found_student_ids: notFoundStudents,
          non_student_user_ids: nonStudentUsers,
        },
      });
    }

    await client.query('BEGIN');

    const insertedMembers = [];
    for (const member of normalizedMembers) {
      const result = await client.query(
        `INSERT INTO class_members (class_id, student_id, permission)
         VALUES ($1, $2, $3)
         ON CONFLICT (class_id, student_id)
         DO UPDATE SET permission = EXCLUDED.permission
         RETURNING class_id, student_id, permission, joined_at`,
        [classId, member.student_id, member.permission]
      );
      insertedMembers.push(result.rows[0]);
    }

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Members added successfully.',
      members: insertedMembers,
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // Ignore rollback errors and surface the original failure.
    }
    return next(error);
  } finally {
    client.release();
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
    const classResult = await pool.query(
      'SELECT id FROM classes WHERE id = $1 AND teacher_id = $2',
      [classId, req.user.id]
    );

    if (classResult.rows.length === 0) {
      return res.status(404).json({ message: 'Class not found or you do not own this class.' });
    }

    const membershipResult = await pool.query(
      `UPDATE class_members
       SET permission = $1
       WHERE class_id = $2 AND student_id = $3
       RETURNING class_id, student_id, permission, joined_at`,
      [role, classId, userId]
    );

    if (membershipResult.rows.length === 0) {
      return res.status(404).json({ message: 'Member not found in this class.' });
    }

    return res.status(200).json({
      message: 'Member role updated successfully.',
      membership: membershipResult.rows[0],
    });
  } catch (error) {
    return next(error);
  }
}

async function removeMember(req, res, next) {
  const { id: classId, userId } = req.params;

  try {
    const classResult = await pool.query(
      'SELECT id FROM classes WHERE id = $1 AND teacher_id = $2',
      [classId, req.user.id]
    );

    if (classResult.rows.length === 0) {
      return res.status(404).json({ message: 'Class not found or you do not own this class.' });
    }

    const membershipResult = await pool.query(
      `DELETE FROM class_members
       WHERE class_id = $1 AND student_id = $2
       RETURNING class_id, student_id, permission`,
      [classId, userId]
    );

    if (membershipResult.rows.length === 0) {
      return res.status(404).json({ message: 'Member not found in this class.' });
    }

    return res.status(200).json({
      message: 'Member removed successfully.',
      membership: membershipResult.rows[0],
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createClass,
  listTeacherClasses,
  fetchClassDetails,
  updateClass,
  deleteClass,
  joinClass,
  addStudentToClass,
  addStudentsToClassBulk,
  updateMemberRole,
  removeMember,
};
