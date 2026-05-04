const pool = require('../config/db');

async function searchUsersByFullName(req, res, next) {
  const rawQuery = req.query.query || req.query.full_name;
  const fullName = typeof rawQuery === 'string' ? rawQuery : '';

  if (!fullName || !fullName.trim()) {
    return res.status(400).json({ message: 'query is required.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, role, full_name, email
       FROM users
       WHERE role <> 'admin'
         AND id <> $1
         AND full_name ILIKE $2
       ORDER BY full_name ASC
       LIMIT 50`,
      [req.user.id, `%${fullName.trim()}%`]
    );

    return res.status(200).json({
      users: rows,
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteUser(req, res, next) {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, email, role',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(200).json({
      message: 'User deleted successfully.',
      user: rows[0],
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  searchUsersByFullName,
  deleteUser,
};
