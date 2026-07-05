const authService = require('../services/auth.service');

async function register(req, res, next) {
  const { role, full_name, email, password } = req.body;

  if (!role || !full_name || !email || !password) {
    return res.status(400).json({ message: 'role, full_name, email, and password are required.' });
  }

  try {
    const user = await authService.register(role, full_name, email, password);
    return res.status(201).json({ message: 'User registered successfully.', user });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
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
    const result = await authService.login(email, password);
    return res.status(200).json({ message: 'Login successful.', ...result });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    return next(error);
  }
}

module.exports = { register, login };
