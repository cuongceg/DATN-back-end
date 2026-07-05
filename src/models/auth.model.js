const pool = require('../config/db');

async function findUserByEmail(email) {
  const { rows } = await pool.query(
    'SELECT id, role, full_name, email, password_hash FROM users WHERE email = $1',
    [email]
  );
  return rows[0] || null;
}

async function createUser(role, full_name, email, passwordHash) {
  const { rows } = await pool.query(
    `INSERT INTO users (role, full_name, email, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, role, full_name, email`,
    [role, full_name, email, passwordHash]
  );
  return rows[0];
}

module.exports = { findUserByEmail, createUser };
