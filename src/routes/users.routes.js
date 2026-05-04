const express = require('express');
const { searchUsersByFullName, deleteUser } = require('../controllers/users.controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/search', authenticateToken, searchUsersByFullName);
router.delete('/:id', authenticateToken, authorizeRoles('admin'), deleteUser);

module.exports = router;
