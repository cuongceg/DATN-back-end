const pool = require('../config/db');

async function create(teacherId, classCode, name, description) {
  const { rows } = await pool.query(
    `INSERT INTO classes (teacher_id, class_code, name, description)
     VALUES ($1, $2, $3, $4)
     RETURNING id, teacher_id, class_code, name, description, status, created_at`,
    [teacherId, classCode, name, description]
  );
  return rows[0];
}

async function findById(classId) {
  const { rows } = await pool.query(
    `SELECT id, teacher_id, class_code, name, description, status, created_at
     FROM classes
     WHERE id = $1`,
    [classId]
  );
  return rows[0] || null;
}

async function findByIdAndTeacher(classId, teacherId) {
  const { rows } = await pool.query(
    'SELECT id FROM classes WHERE id = $1 AND teacher_id = $2',
    [classId, teacherId]
  );
  return rows[0] || null;
}

async function findByCode(classCode) {
  const { rows } = await pool.query(
    'SELECT id, teacher_id, class_code, name, description, created_at FROM classes WHERE class_code = $1',
    [classCode]
  );
  return rows[0] || null;
}

async function listByTeacher(teacherId) {
  const { rows } = await pool.query(
    `SELECT c.id, c.teacher_id, c.class_code, c.name, c.description, c.status, c.created_at,
            COUNT(cm.student_id) AS student_count
     FROM classes c
     LEFT JOIN class_members cm ON cm.class_id = c.id
     WHERE c.teacher_id = $1
     GROUP BY c.id, c.teacher_id, c.class_code, c.name, c.description, c.status, c.created_at
     ORDER BY c.created_at DESC`,
    [teacherId]
  );
  return rows;
}

async function listByStudent(studentId) {
  const { rows } = await pool.query(
    `SELECT c.id, c.teacher_id, c.class_code, c.name, c.description, c.status, c.created_at,
            cm.permission, cm.joined_at,
            COALESCE(member_counts.student_count, 0) AS student_count
     FROM class_members cm
     INNER JOIN classes c ON c.id = cm.class_id
     LEFT JOIN (
       SELECT class_id, COUNT(*) AS student_count
       FROM class_members
       GROUP BY class_id
     ) AS member_counts ON member_counts.class_id = c.id
     WHERE cm.student_id = $1
     ORDER BY c.created_at DESC`,
    [studentId]
  );
  return rows;
}

async function listAll() {
  const { rows } = await pool.query(
    `SELECT c.id, c.teacher_id, c.class_code, c.name, c.description, c.status, c.created_at,
            COUNT(cm.student_id) AS student_count
     FROM classes c
     LEFT JOIN class_members cm ON cm.class_id = c.id
     GROUP BY c.id, c.teacher_id, c.class_code, c.name, c.description, c.status, c.created_at
     ORDER BY c.created_at DESC`
  );
  return rows;
}

async function update(classId, teacherId, name, description) {
  const { rows } = await pool.query(
    `UPDATE classes
     SET name = COALESCE($1, name),
         description = COALESCE($2, description)
     WHERE id = $3 AND teacher_id = $4
     RETURNING id, teacher_id, class_code, name, description, status, created_at`,
    [name ?? null, description ?? null, classId, teacherId]
  );
  return rows[0] || null;
}

async function deleteById(classId, teacherId) {
  const { rows } = await pool.query(
    `DELETE FROM classes WHERE id = $1 AND teacher_id = $2 RETURNING id, class_code, name`,
    [classId, teacherId]
  );
  return rows[0] || null;
}

async function setStatus(classId, teacherId, fromStatus, toStatus) {
  const { rows } = await pool.query(
    `UPDATE classes
     SET status = $1
     WHERE id = $2 AND teacher_id = $3 AND status = $4
     RETURNING id, teacher_id, class_code, name, description, status, created_at`,
    [toStatus, classId, teacherId, fromStatus]
  );
  return rows[0] || null;
}

async function getMembers(classId) {
  const { rows } = await pool.query(
    `SELECT cm.student_id AS user_id, u.full_name, u.email, u.role, cm.permission, cm.joined_at
     FROM class_members cm
     INNER JOIN users u ON u.id = cm.student_id
     WHERE cm.class_id = $1
     ORDER BY u.full_name ASC`,
    [classId]
  );
  return rows;
}

async function addMember(classId, studentId, permission) {
  const { rows } = await pool.query(
    `INSERT INTO class_members (class_id, student_id, permission)
     VALUES ($1, $2, $3)
     ON CONFLICT (class_id, student_id) DO NOTHING
     RETURNING class_id, student_id, permission, joined_at`,
    [classId, studentId, permission]
  );
  return rows[0] || null;
}

async function upsertMember(client, classId, studentId, permission) {
  const { rows } = await client.query(
    `INSERT INTO class_members (class_id, student_id, permission)
     VALUES ($1, $2, $3)
     ON CONFLICT (class_id, student_id)
     DO UPDATE SET permission = EXCLUDED.permission
     RETURNING class_id, student_id, permission, joined_at`,
    [classId, studentId, permission]
  );
  return rows[0];
}

async function updateMemberPermission(classId, userId, permission) {
  const { rows } = await pool.query(
    `UPDATE class_members
     SET permission = $1
     WHERE class_id = $2 AND student_id = $3
     RETURNING class_id, student_id, permission, joined_at`,
    [permission, classId, userId]
  );
  return rows[0] || null;
}

async function removeMember(classId, userId) {
  const { rows } = await pool.query(
    `DELETE FROM class_members WHERE class_id = $1 AND student_id = $2
     RETURNING class_id, student_id, permission`,
    [classId, userId]
  );
  return rows[0] || null;
}

async function findStudent(studentId) {
  const { rows } = await pool.query(
    'SELECT id, role FROM users WHERE id = $1',
    [studentId]
  );
  return rows[0] || null;
}

async function findStudentsByIds(ids) {
  const { rows } = await pool.query(
    'SELECT id, role FROM users WHERE id = ANY($1::uuid[])',
    [ids]
  );
  return rows;
}

async function checkMembership(classId, studentId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM class_members WHERE class_id = $1 AND student_id = $2',
    [classId, studentId]
  );
  return rows.length > 0;
}

module.exports = {
  create,
  findById,
  findByIdAndTeacher,
  findByCode,
  listByTeacher,
  listByStudent,
  listAll,
  update,
  deleteById,
  setStatus,
  getMembers,
  addMember,
  upsertMember,
  updateMemberPermission,
  removeMember,
  findStudent,
  findStudentsByIds,
  checkMembership,
};
