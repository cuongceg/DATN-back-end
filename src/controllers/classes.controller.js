const pool = require('../config/db');

async function createClass(req, res, next) {
  const { name, description } = req.body;
  const teacherId = req.user.id;

  if (!name) {
    return res.status(400).json({ message: 'Class name is required.' });
  }

  try {
    const query = `
      INSERT INTO classes (teacher_id, name, description)
      VALUES ($1, $2, $3)
      RETURNING id, teacher_id, name, description, created_at
    `;
    const { rows } = await pool.query(query, [teacherId, name, description || null]);

    return res.status(201).json({
      message: 'Class created successfully.',
      class: rows[0],
    });
  } catch (error) {
    return next(error);
  }
}

async function listTeacherClasses(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT id, teacher_id, name, description, created_at
       FROM classes
       WHERE teacher_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    return res.status(200).json({ classes: rows });
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
      RETURNING id, teacher_id, name, description, created_at
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
       RETURNING id, name`,
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
  const { id: classId } = req.params;
  const studentId = req.user.id;

  try {
    const classCheck = await pool.query('SELECT id FROM classes WHERE id = $1', [classId]);
    if (classCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    const membership = await pool.query(
      `INSERT INTO class_members (class_id, student_id)
       VALUES ($1, $2)
       ON CONFLICT (class_id, student_id) DO NOTHING
       RETURNING class_id, student_id, joined_at`,
      [classId, studentId]
    );

    if (membership.rows.length === 0) {
      return res.status(409).json({ message: 'Student already joined this class.' });
    }

    return res.status(201).json({
      message: 'Joined class successfully.',
      membership: membership.rows[0],
    });
  } catch (error) {
    return next(error);
  }
}

async function addStudentToClass(req, res, next) {
  const { id: classId } = req.params;
  const { student_id: studentId } = req.body;

  if (!studentId) {
    return res.status(400).json({ message: 'student_id is required.' });
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
      `INSERT INTO class_members (class_id, student_id)
       VALUES ($1, $2)
       ON CONFLICT (class_id, student_id) DO NOTHING
       RETURNING class_id, student_id, joined_at`,
      [classId, studentId]
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

module.exports = {
  createClass,
  listTeacherClasses,
  updateClass,
  deleteClass,
  joinClass,
  addStudentToClass,
};
