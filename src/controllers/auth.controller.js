const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const ALLOWED_ROLES = ['admin', 'teacher', 'student'];

async function register(req, res, next) {
  const { role, full_name, email, password } = req.body;

  if (!role || !full_name || !email || !password) {
    return res.status(400).json({ message: 'role, full_name, email, and password are required.' });
  }

  if (!ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ message: 'Invalid role.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const query = `
      INSERT INTO users (role, full_name, email, password_hash)
      VALUES ($1, $2, $3, $4)
      RETURNING id, role, full_name, email
    `;

    const values = [role, full_name, email.toLowerCase().trim(), passwordHash];
    const { rows } = await pool.query(query, values);

    return res.status(201).json({
      message: 'User registered successfully.',
      user: rows[0],
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Email already exists.' });
    }
    return next(error);
  }
}

async function login(req, res, next) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required.' });
  }

  try {
    const query = 'SELECT id, role, full_name, email, password_hash FROM users WHERE email = $1';
    const { rows } = await pool.query(query, [email.toLowerCase().trim()]);

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const user = rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        role: user.role,
        full_name: user.full_name,
        email: user.email,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  register,
  login,
};
