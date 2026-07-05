const pool = require('../config/db');

async function findById(id) {
  const { rows } = await pool.query(
    'SELECT id, role, full_name, email FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function searchByFullName(requesterId, fullName) {
  const { rows } = await pool.query(
    `SELECT id, role, full_name, email
     FROM users
     WHERE role <> 'admin'
       AND id <> $1
       AND full_name ILIKE $2
     ORDER BY full_name ASC
     LIMIT 50`,
    [requesterId, `%${fullName}%`]
  );
  return rows;
}

async function deleteById(id) {
  const { rows } = await pool.query(
    'DELETE FROM users WHERE id = $1 RETURNING id, email, role',
    [id]
  );
  return rows[0] || null;
}

module.exports = { findById, searchByFullName, deleteById };
