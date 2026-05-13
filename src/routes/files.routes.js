const express = require('express');
const multer = require('multer');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');
const filesController = require('../controllers/files.controller');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.use(authenticateToken);

function handleMulterErrors(err, req, res, next) {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'File exceeds 50MB limit.' });
  }

  return next(err);
}

// 1) Create folder or upload file by path
router.post(
  '/class/:classId/content',
  authorizeRoles('teacher'),
  upload.single('file'),
  filesController.createContent,
  handleMulterErrors
);

// 2) List items (folders + files) directly under a path
router.get(
  '/class/:classId/content',
  authorizeRoles('teacher', 'student'),
  filesController.listContent
);

// 3) Download by file path
router.get(
  '/class/:classId/download',
  authorizeRoles('teacher', 'student'),
  filesController.downloadByPath
);

// 4) Delete file or folder by path (only creator can delete)
router.delete(
  '/class/:classId/content',
  authorizeRoles('teacher', 'student'),
  filesController.deleteContent
);

module.exports = router;
