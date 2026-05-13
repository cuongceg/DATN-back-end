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

async function getCategories(req, res, next) {
  const { classId } = req.params;

  if (!isUuid(classId)) {
    return res.status(400).json({ message: 'classId must be a valid UUID.' });
  }

  try {
    const categories = await filesService.getCategories(classId, req.user);
    return res.status(200).json({ categories });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function createCategory(req, res, next) {
  const { classId } = req.params;
  const { name } = req.body;

  if (!isUuid(classId)) {
    return res.status(400).json({ message: 'classId must be a valid UUID.' });
  }

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ message: 'name is required.' });
  }

  const trimmedName = name.trim();
  if (trimmedName.length > 255) {
    return res.status(400).json({ message: 'name must be at most 255 characters.' });
  }

  try {
    const category = await filesService.createCategory(classId, req.user, trimmedName);
    return res.status(201).json({
      message: 'Category created successfully.',
      category,
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function deleteCategory(req, res, next) {
  const { classId, categoryId } = req.params;

  if (!isUuid(classId)) {
    return res.status(400).json({ message: 'classId must be a valid UUID.' });
  }

  if (!isUuid(categoryId)) {
    return res.status(400).json({ message: 'categoryId must be a valid UUID.' });
  }

  try {
    await filesService.deleteCategory(classId, categoryId, req.user);
    return res.status(200).json({ message: 'Category deleted successfully.' });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function getFolders(req, res, next) {
  const { classId, categoryId } = req.params;

  if (!isUuid(classId)) {
    return res.status(400).json({ message: 'classId must be a valid UUID.' });
  }

  if (!isUuid(categoryId)) {
    return res.status(400).json({ message: 'categoryId must be a valid UUID.' });
  }

  try {
    const folders = await filesService.getFolders(classId, categoryId, req.user);
    return res.status(200).json({ folders });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function createFolder(req, res, next) {
  const { classId, categoryId } = req.params;
  const { name } = req.body;

  if (!isUuid(classId)) {
    return res.status(400).json({ message: 'classId must be a valid UUID.' });
  }

  if (!isUuid(categoryId)) {
    return res.status(400).json({ message: 'categoryId must be a valid UUID.' });
  }

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ message: 'name is required.' });
  }

  const trimmedName = name.trim();
  if (trimmedName.length > 255) {
    return res.status(400).json({ message: 'name must be at most 255 characters.' });
  }

  try {
    const folder = await filesService.createFolder(classId, categoryId, req.user, trimmedName);
    return res.status(201).json({
      message: 'Folder created successfully.',
      folder,
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function deleteFolder(req, res, next) {
  const { classId, categoryId, folderId } = req.params;

  if (!isUuid(classId)) {
    return res.status(400).json({ message: 'classId must be a valid UUID.' });
  }

  if (!isUuid(categoryId)) {
    return res.status(400).json({ message: 'categoryId must be a valid UUID.' });
  }

  if (!isUuid(folderId)) {
    return res.status(400).json({ message: 'folderId must be a valid UUID.' });
  }

  try {
    await filesService.deleteFolder(classId, categoryId, folderId, req.user);
    return res.status(200).json({ message: 'Folder deleted successfully.' });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function uploadFile(req, res, next) {
  const { classId, folderId } = req.params;

  if (!isUuid(classId)) {
    return res.status(400).json({ message: 'classId must be a valid UUID.' });
  }

  if (!isUuid(folderId)) {
    return res.status(400).json({ message: 'folderId must be a valid UUID.' });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'file is required.' });
  }

  try {
    const file = await filesService.uploadFile(classId, folderId, req.user, req.file);
    return res.status(201).json({
      message: 'File uploaded successfully.',
      file,
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function listFiles(req, res, next) {
  const { classId, folderId } = req.params;

  if (!isUuid(classId)) {
    return res.status(400).json({ message: 'classId must be a valid UUID.' });
  }

  if (!isUuid(folderId)) {
    return res.status(400).json({ message: 'folderId must be a valid UUID.' });
  }

  try {
    const files = await filesService.listFiles(classId, folderId, req.user);
    return res.status(200).json({ files });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function getDownloadUrl(req, res, next) {
  const { fileId } = req.params;

  if (!isUuid(fileId)) {
    return res.status(400).json({ message: 'fileId must be a valid UUID.' });
  }

  try {
    const { downloadUrl, expiresInSeconds } = await filesService.getDownloadUrl(fileId, req.user);
    return res.status(200).json({
      download_url: downloadUrl,
      expires_in_seconds: expiresInSeconds,
    });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

async function deleteFile(req, res, next) {
  const { fileId } = req.params;

  if (!isUuid(fileId)) {
    return res.status(400).json({ message: 'fileId must be a valid UUID.' });
  }

  try {
    await filesService.deleteFile(fileId, req.user);
    return res.status(200).json({ message: 'File deleted successfully.' });
  } catch (error) {
    return handleServiceError(res, error, next);
  }
}

module.exports = {
  getCategories,
  createCategory,
  deleteCategory,
  getFolders,
  createFolder,
  deleteFolder,
  uploadFile,
  listFiles,
  getDownloadUrl,
  deleteFile,
};
