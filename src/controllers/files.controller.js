const filesService = require('../services/files.service');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function handleServiceError(res, error, next) {
  if (error && error.status) {
    return res.status(error.status).json({ message: error.message });
  }

  return next(error);
}

async function createContent(req, res, next) {
  const { classId } = req.params;
  const { type, path } = req.body;

  if (!isUuid(classId)) {
    return res.status(400).json({ message: 'classId must be a valid UUID.' });
  }

  if (!type || (type !== 'folder' && type !== 'file')) {
    return res.status(400).json({ message: 'type must be either "folder" or "file".' });
  }

  try {
    if (type === 'folder') {
      const folder = await filesService.createFolder(classId, req.user, path);
      return res.status(201).json({ message: 'Folder created successfully.', folder });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'file is required.' });
    }

    const file = await filesService.uploadFile(classId, req.user, req.file, path);
    return res.status(201).json({ message: 'File uploaded successfully.', file });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function listContent(req, res, next) {
  const { classId } = req.params;
  const { path } = req.query;

  if (!isUuid(classId)) {
    return res.status(400).json({ message: 'classId must be a valid UUID.' });
  }

  try {
    const result = await filesService.listContent(classId, req.user, path);
    return res.status(200).json(result);
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function downloadByPath(req, res, next) {
  const { classId } = req.params;
  const { path } = req.query;

  if (!isUuid(classId)) {
    return res.status(400).json({ message: 'classId must be a valid UUID.' });
  }

  try {
    const { downloadUrl, expiresInSeconds } = await filesService.getDownloadUrlByPath(
      classId,
      req.user,
      path
    );
    return res.status(200).json({
      download_url: downloadUrl,
      expires_in_seconds: expiresInSeconds,
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function deleteContent(req, res, next) {
  const { classId } = req.params;
  const { path } = req.query;

  if (!isUuid(classId)) {
    return res.status(400).json({ message: 'classId must be a valid UUID.' });
  }

  try {
    await filesService.deleteContentByPath(classId, req.user, path);
    return res.status(200).json({ message: 'Deleted successfully.' });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

module.exports = {
  createContent,
  listContent,
  downloadByPath,
  deleteContent,
};
