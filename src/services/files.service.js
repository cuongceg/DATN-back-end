const path = require('path');
const pool = require('../config/db');
const { minioClient, BUCKET_NAME } = require('./minio.client');

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeAndValidatePosixPath(inputPath, { requireFilename }) {
  if (typeof inputPath !== 'string') {
    throw createHttpError(400, 'path must be a string.');
  }

  const trimmed = inputPath.trim();
  if (!trimmed) {
    throw createHttpError(400, 'path is required.');
  }

  if (!trimmed.startsWith('/')) {
    throw createHttpError(400, 'path must start with "/".');
  }

  if (trimmed.includes('\\') || trimmed.includes('\u0000')) {
    throw createHttpError(400, 'path contains invalid characters.');
  }

  const parts = trimmed.split('/').filter(Boolean);
  if (parts.some((segment) => segment === '.' || segment === '..')) {
    throw createHttpError(400, 'path must not contain "." or ".." segments.');
  }

  if (requireFilename && parts.length === 0) {
    throw createHttpError(400, 'path must include a file name.');
  }

  if (parts.length === 0) {
    return { normalized: '/', dirPath: '', fileName: '' };
  }

  const normalized = '/' + parts.join('/');
  const fileName = requireFilename ? parts[parts.length - 1] : '';
  const dirParts = requireFilename ? parts.slice(0, -1) : parts;
  const dirPath = dirParts.join('/');

  if (requireFilename && !fileName) {
    throw createHttpError(400, 'path must include a file name.');
  }

  if (normalized.length > 1000) {
    throw createHttpError(400, 'path is too long.');
  }

  return { normalized, dirPath, fileName };
}

function formatListingPath(normalizedFolderPath) {
  if (normalizedFolderPath === '/') return '/';
  return `${normalizedFolderPath}/`;
}

async function ensureClassAccess(user, classId) {
  const classResult = await pool.query('SELECT id, teacher_id FROM classes WHERE id = $1', [classId]);

  if (classResult.rows.length === 0) {
    throw createHttpError(404, 'Class not found.');
  }

  const classData = classResult.rows[0];

  if (user.role === 'teacher') {
    if (classData.teacher_id !== user.id) {
      throw createHttpError(403, 'You do not have permission to access this class.');
    }

    return classData;
  }

  if (user.role === 'student') {
    const memberResult = await pool.query(
      'SELECT 1 FROM class_members WHERE class_id = $1 AND student_id = $2',
      [classId, user.id]
    );

    if (memberResult.rows.length === 0) {
      throw createHttpError(403, 'You are not a member of this class.');
    }

    return classData;
  }

  throw createHttpError(403, 'You do not have permission to access this class.');
}

async function ensureTeacherOwner(user, classId) {
  if (user.role !== 'teacher') {
    throw createHttpError(403, 'Forbidden: insufficient permissions.');
  }

  const classResult = await pool.query('SELECT id, teacher_id FROM classes WHERE id = $1', [classId]);

  if (classResult.rows.length === 0) {
    throw createHttpError(404, 'Class not found.');
  }

  const classData = classResult.rows[0];
  if (classData.teacher_id !== user.id) {
    throw createHttpError(403, 'You do not have permission to manage this class.');
  }

  return classData;
}

async function findFolderByPath(classId, folderPath) {
  const result = await pool.query(
    'SELECT id, class_id, parent_id, name, path, created_by, created_at FROM folders WHERE class_id = $1 AND path = $2',
    [classId, folderPath]
  );
  return result.rows[0] || null;
}

async function findFileByPath(classId, filePath) {
  const result = await pool.query(
    `SELECT id,
            class_id,
            path,
            created_by,
            original_name,
            minio_object_key,
            mime_type,
            size_bytes,
            created_at
     FROM class_files
     WHERE class_id = $1 AND path = $2`,
    [classId, filePath]
  );
  return result.rows[0] || null;
}

async function assertPathNotTaken(classId, normalizedPath) {
  const [folder, file] = await Promise.all([
    findFolderByPath(classId, normalizedPath),
    findFileByPath(classId, normalizedPath),
  ]);

  if (folder || file) {
    throw createHttpError(409, 'Path already exists.');
  }
}

async function ensureFoldersForDirPath(classId, user, dirPathNormalized) {
  // dirPathNormalized: '/', '/a', '/a/b', ...
  if (dirPathNormalized === '/') {
    return null;
  }

  const segments = dirPathNormalized.split('/').filter(Boolean);
  let parentId = null;

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    const currentPath = '/' + segments.slice(0, i + 1).join('/');

    const fileAtFolderPath = await findFileByPath(classId, currentPath);
    if (fileAtFolderPath) {
      throw createHttpError(400, 'Parent path is a file.');
    }

    const insertResult = await pool.query(
      `INSERT INTO folders (class_id, parent_id, name, path, created_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (class_id, path) DO NOTHING
       RETURNING id, parent_id, name, path, created_by, created_at`,
      [classId, parentId, segment, currentPath, user.id]
    );

    if (insertResult.rows.length > 0) {
      parentId = insertResult.rows[0].id;
      continue;
    }

    const existing = await findFolderByPath(classId, currentPath);
    if (!existing) {
      throw createHttpError(500, 'Unable to create folder.');
    }

    parentId = existing.id;
  }

  return parentId;
}

async function createFolder(classId, user, folderPathInput) {
  await ensureTeacherOwner(user, classId);

  const { normalized } = normalizeAndValidatePosixPath(folderPathInput, { requireFilename: false });

  if (normalized === '/') {
    throw createHttpError(400, 'path must not be root (/).');
  }

  await assertPathNotTaken(classId, normalized);

  const parentDir = path.posix.dirname(normalized);
  const parentNormalized = parentDir === '.' ? '/' : parentDir;

  await ensureFoldersForDirPath(classId, user, parentNormalized);

  const name = path.posix.basename(normalized);
  const parentFolder = parentNormalized === '/' ? null : await findFolderByPath(classId, parentNormalized);
  const parentId = parentFolder ? parentFolder.id : null;

  try {
    const result = await pool.query(
      `INSERT INTO folders (class_id, parent_id, name, path, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, path, name, created_at`,
      [classId, parentId, name, normalized, user.id]
    );

    return result.rows[0];
  } catch (error) {
    if (error.code === '23505') {
      throw createHttpError(409, 'Path already exists.');
    }
    throw error;
  }
}

async function uploadFile(classId, user, file, targetPathInput) {
  await ensureTeacherOwner(user, classId);

  const { normalized, dirPath, fileName } = normalizeAndValidatePosixPath(targetPathInput, {
    requireFilename: true,
  });

  if (normalized === '/') {
    throw createHttpError(400, 'path must include a file name.');
  }

  const safeFileName = path.posix.basename(fileName);
  if (!safeFileName || safeFileName === '.' || safeFileName === '..') {
    throw createHttpError(400, 'Invalid file name in path.');
  }

  await assertPathNotTaken(classId, normalized);

  const dirNormalized = dirPath ? `/${dirPath}` : '/';
  await ensureFoldersForDirPath(classId, user, dirNormalized);

  const objectKey = `${classId}${normalized}`;

  try {
    await minioClient.putObject(
      BUCKET_NAME,
      objectKey,
      file.buffer,
      file.size,
      { 'Content-Type': file.mimetype || 'application/octet-stream' }
    );
  } catch (error) {
    throw createHttpError(500, 'Unable to upload file to storage.');
  }

  try {
    const result = await pool.query(
      `INSERT INTO class_files (class_id, path, created_by, original_name, minio_object_key, mime_type, size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, path, original_name, mime_type, size_bytes, created_at`,
      [
        classId,
        normalized,
        user.id,
        file.originalname || safeFileName,
        objectKey,
        file.mimetype || null,
        file.size,
      ]
    );

    return result.rows[0];
  } catch (error) {
    if (error.code === '23505') {
      try {
        await minioClient.removeObject(BUCKET_NAME, objectKey);
      } catch (cleanupError) {
        // best-effort cleanup
      }
      throw createHttpError(409, 'Path already exists.');
    }
    throw error;
  }
}

function buildDirectChildFilePatterns(normalizedFolderPath) {
  // normalizedFolderPath: '/' or '/a/b'
  const prefix = normalizedFolderPath === '/' ? '/' : `${normalizedFolderPath}/`;
  const likePattern = `${prefix}%`;
  const notLikePattern = `${prefix}%/%`;
  return { likePattern, notLikePattern, prefix };
}

async function listContent(classId, user, folderPathQuery) {
  await ensureClassAccess(user, classId);

  const queryPath = folderPathQuery == null || folderPathQuery === '' ? '/' : String(folderPathQuery);
  const { normalized } = normalizeAndValidatePosixPath(queryPath, { requireFilename: false });

  let parentFolderId = null;

  if (normalized !== '/') {
    const folder = await findFolderByPath(classId, normalized);
    if (!folder) {
      throw createHttpError(404, 'Path not found.');
    }
    parentFolderId = folder.id;
  }

  const foldersResult = await pool.query(
    `SELECT f.id,
            f.name,
            f.path,
            f.created_at,
            u.full_name AS created_by_name
     FROM folders f
     JOIN users u ON u.id = f.created_by
     WHERE f.class_id = $1 AND ${normalized === '/' ? 'f.parent_id IS NULL' : 'f.parent_id = $2'}
     ORDER BY f.name ASC, f.created_at DESC`,
    normalized === '/' ? [classId] : [classId, parentFolderId]
  );

  const { likePattern, notLikePattern } = buildDirectChildFilePatterns(normalized);

  const filesResult = await pool.query(
    `SELECT cf.id,
            cf.path,
            cf.original_name,
            cf.mime_type,
            cf.size_bytes,
            cf.created_at,
            u.full_name AS created_by_name
     FROM class_files cf
     JOIN users u ON u.id = cf.created_by
     WHERE cf.class_id = $1
       AND cf.path LIKE $2
       AND cf.path NOT LIKE $3
     ORDER BY cf.path ASC, cf.created_at DESC`,
    [classId, likePattern, notLikePattern]
  );

  const folderItems = foldersResult.rows.map((row) => ({
    id: row.id,
    type: 'folder',
    name: row.name,
    path: row.path,
    created_at: row.created_at,
    created_by_name: row.created_by_name,
  }));

  const fileItems = filesResult.rows.map((row) => ({
    id: row.id,
    type: 'file',
    name: path.posix.basename(row.path),
    path: row.path,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    created_at: row.created_at,
    created_by_name: row.created_by_name,
  }));

  return {
    path: formatListingPath(normalized),
    items: [...folderItems, ...fileItems],
  };
}

async function getDownloadUrlByPath(classId, user, filePathQuery) {
  await ensureClassAccess(user, classId);

  const { normalized } = normalizeAndValidatePosixPath(filePathQuery, { requireFilename: true });

  const fileRecord = await findFileByPath(classId, normalized);
  if (!fileRecord) {
    throw createHttpError(404, 'File not found.');
  }

  try {
    const expiresInSeconds = 3600;
    const downloadUrl = await minioClient.presignedGetObject(
      BUCKET_NAME,
      fileRecord.minio_object_key,
      expiresInSeconds
    );

    return { downloadUrl, expiresInSeconds };
  } catch (error) {
    throw createHttpError(500, 'Unable to generate download URL.');
  }
}

async function deleteContentByPath(classId, user, deletePathQuery) {
  await ensureClassAccess(user, classId);

  const { normalized } = normalizeAndValidatePosixPath(deletePathQuery, { requireFilename: false });

  if (normalized === '/') {
    throw createHttpError(400, 'Cannot delete root (/).');
  }

  const folder = await findFolderByPath(classId, normalized);
  if (folder) {
    if (folder.created_by !== user.id) {
      throw createHttpError(403, 'You do not have permission to delete this folder.');
    }

    const childrenFolders = await pool.query(
      'SELECT 1 FROM folders WHERE class_id = $1 AND parent_id = $2 LIMIT 1',
      [classId, folder.id]
    );

    const childrenFiles = await pool.query(
      'SELECT 1 FROM class_files WHERE class_id = $1 AND path LIKE $2 LIMIT 1',
      [classId, `${folder.path}/%`]
    );

    if (childrenFolders.rows.length > 0 || childrenFiles.rows.length > 0) {
      throw createHttpError(400, 'Folder is not empty. Please delete its contents first.');
    }

    await pool.query('DELETE FROM folders WHERE id = $1', [folder.id]);
    return;
  }

  const fileRecord = await findFileByPath(classId, normalized);
  if (!fileRecord) {
    throw createHttpError(404, 'Path not found.');
  }

  if (fileRecord.created_by !== user.id) {
    throw createHttpError(403, 'You do not have permission to delete this file.');
  }

  try {
    await minioClient.removeObject(BUCKET_NAME, fileRecord.minio_object_key);
  } catch (error) {
    throw createHttpError(500, 'Unable to delete file from storage.');
  }

  await pool.query('DELETE FROM class_files WHERE id = $1', [fileRecord.id]);
}

module.exports = {
  createFolder,
  uploadFile,
  listContent,
  getDownloadUrlByPath,
  deleteContentByPath,
};
