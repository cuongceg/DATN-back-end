const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authModel = require('../models/auth.model');

const ALLOWED_ROLES = ['admin', 'teacher', 'student'];

async function register(role, full_name, email, password) {
  if (!ALLOWED_ROLES.includes(role)) {
    const error = new Error('Invalid role.');
    error.status = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  return authModel.createUser(role, full_name, email.toLowerCase().trim(), passwordHash);
}

async function login(email, password) {
  const user = await authModel.findUserByEmail(email.toLowerCase().trim());

  if (!user) {
    const error = new Error('Invalid email or password.');
    error.status = 401;
    throw error;
  }

  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    const error = new Error('Invalid email or password.');
    error.status = 401;
    throw error;
  }

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  return {
    token,
    user: { id: user.id, role: user.role, full_name: user.full_name, email: user.email },
  };
}

module.exports = { register, login };
