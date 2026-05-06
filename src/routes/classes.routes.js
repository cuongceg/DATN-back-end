const express = require('express');
const {
  createClass,
  listTeacherClasses,
  fetchClassDetails,
  updateClass,
  deleteClass,
  archiveClass,
  activeClass,
  joinClass,
  addStudentToClass,
  addStudentsToClassBulk,
  updateMemberRole,
  removeMember,
} = require('../controllers/classes.controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/', authenticateToken, authorizeRoles('teacher'), createClass);
router.get('/', authenticateToken, listTeacherClasses);
router.get('/:id', authenticateToken, fetchClassDetails);
router.put('/:id', authenticateToken, authorizeRoles('teacher'), updateClass);
router.patch('/:id/archive', authenticateToken, authorizeRoles('teacher'), archiveClass);
router.patch('/:id/activate', authenticateToken, authorizeRoles('teacher'), activeClass);
router.delete('/:id', authenticateToken, authorizeRoles('teacher'), deleteClass);

router.post('/join', authenticateToken, authorizeRoles('student'), joinClass);

router.post('/:id/members', authenticateToken, authorizeRoles('teacher'), addStudentToClass);
router.post('/:id/members/bulk', authenticateToken, authorizeRoles('teacher'), addStudentsToClassBulk);
router.patch('/:id/members/:userId/role', authenticateToken, authorizeRoles('teacher'), updateMemberRole);
router.delete('/:id/members/:userId', authenticateToken, authorizeRoles('teacher'), removeMember);

module.exports = router;
