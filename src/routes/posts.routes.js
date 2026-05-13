const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');
const postsController = require('../controllers/posts.controller');

const router = express.Router();

router.use(authenticateToken);
router.use(authorizeRoles('teacher', 'student'));

router.post('/', postsController.createPost);
router.get('/class/:classId', postsController.getPostsByClass);
router.get('/:postId', postsController.getPostById);
router.patch('/:postId', postsController.updatePost);
router.delete('/:postId', postsController.deletePost);

module.exports = router;
