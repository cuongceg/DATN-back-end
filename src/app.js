const express = require('express');
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const classesRoutes = require('./routes/classes.routes');

const app = express();

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/classes', classesRoutes);

app.use((req, res) => {
  return res.status(404).json({ message: 'Route not found.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  return res.status(500).json({ message: 'Internal server error.' });
});

module.exports = app;
