const express = require('express');
const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('./docs/openapi');
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const classesRoutes = require('./routes/classes.routes');
const sessionRoutes = require('./routes/session.routes');
const postsRoutes = require('./routes/posts.routes');
const filesRoutes = require('./routes/files.routes');

const app = express();

app.use(express.json());

app.get('/api-docs.json', (req, res) => {
  return res.status(200).json(openapiSpec);
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/classes', classesRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/files', filesRoutes);

app.use((req, res) => {
  return res.status(404).json({ message: 'Route not found.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  return res.status(500).json({ message: 'Internal server error.' });
});

module.exports = app;
