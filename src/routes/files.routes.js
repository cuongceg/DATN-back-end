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

router.get(
  '/class/:classId/categories',
  authorizeRoles('teacher', 'student'),
  filesController.getCategories
);
router.post(
  '/class/:classId/categories',
  authorizeRoles('teacher'),
  filesController.createCategory
);
router.delete(
  '/class/:classId/categories/:categoryId',
  authorizeRoles('teacher'),
  filesController.deleteCategory
);

router.get(
  '/class/:classId/categories/:categoryId/folders',
  authorizeRoles('teacher', 'student'),
  filesController.getFolders
);
router.post(
  '/class/:classId/categories/:categoryId/folders',
  authorizeRoles('teacher'),
  filesController.createFolder
);
router.delete(
  '/class/:classId/categories/:categoryId/folders/:folderId',
  authorizeRoles('teacher'),
  filesController.deleteFolder
);

router.post(
  '/class/:classId/folders/:folderId/upload',
  authorizeRoles('teacher'),
  upload.single('file'),
  filesController.uploadFile,
  (err, req, res, next) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'File exceeds 50MB limit.' });
    }

    return next(err);
  }
);

router.get(
  '/class/:classId/folders/:folderId/files',
  authorizeRoles('teacher', 'student'),
  filesController.listFiles
);
router.get(
  '/:fileId/download-url',
  authorizeRoles('teacher', 'student'),
  filesController.getDownloadUrl
);
router.delete(
  '/:fileId',
  authorizeRoles('teacher'),
  filesController.deleteFile
);

module.exports = router;
