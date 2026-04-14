const express = require('express');
const { deleteUser } = require('../controllers/users.controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();

router.delete('/:id', authenticateToken, authorizeRoles('admin'), deleteUser);

module.exports = router;
