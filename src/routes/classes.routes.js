const express = require('express');
const {
  createClass,
  listTeacherClasses,
  updateClass,
  deleteClass,
  joinClass,
  addStudentToClass,
} = require('../controllers/classes.controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/', authenticateToken, authorizeRoles('teacher'), createClass);
router.get('/', authenticateToken, authorizeRoles('teacher'), listTeacherClasses);
router.put('/:id', authenticateToken, authorizeRoles('teacher'), updateClass);
router.delete('/:id', authenticateToken, authorizeRoles('teacher'), deleteClass);

router.post('/:id/join', authenticateToken, authorizeRoles('student'), joinClass);

router.post('/:id/members', authenticateToken, authorizeRoles('teacher'), addStudentToClass);

module.exports = router;
