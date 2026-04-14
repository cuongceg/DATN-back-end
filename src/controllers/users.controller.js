const pool = require('../config/db');

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
  deleteUser,
};
