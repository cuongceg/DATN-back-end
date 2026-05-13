const crypto = require('crypto');
const pool = require('../config/db');
const { minioClient, BUCKET_NAME } = require('./minio.client');

async function ensureClassAccess(user, classId) {
  const classResult = await pool.query(
    'SELECT id, teacher_id FROM classes WHERE id = $1',
    [classId]
  );

  if (classResult.rows.length === 0) {
    const error = new Error('Class not found.');
    error.status = 404;
    throw error;
  }

  const classData = classResult.rows[0];

  if (user.role === 'teacher') {
    if (classData.teacher_id !== user.id) {
      const error = new Error('You do not have permission to access this class.');
      error.status = 403;
      throw error;
    }

    return classData;
  }

  if (user.role === 'student') {
    const memberResult = await pool.query(
      'SELECT 1 FROM class_members WHERE class_id = $1 AND student_id = $2',
      [classId, user.id]
    );

    if (memberResult.rows.length === 0) {
      const error = new Error('You are not a member of this class.');
      error.status = 403;
      throw error;
    }

    return classData;
  }

  const error = new Error('You do not have permission to access this class.');
  error.status = 403;
  throw error;
}

async function ensureTeacherOwner(user, classId) {
  if (user.role !== 'teacher') {
    const error = new Error('You do not have permission to manage categories.');
    error.status = 403;
    throw error;
  }

  const classResult = await pool.query(
    'SELECT id, teacher_id FROM classes WHERE id = $1',
    [classId]
  );

  if (classResult.rows.length === 0) {
    const error = new Error('Class not found.');
    error.status = 404;
    throw error;
  }

  const classData = classResult.rows[0];
  if (classData.teacher_id !== user.id) {
    const error = new Error('You do not have permission to manage this class.');
    error.status = 403;
    throw error;
  }

  return classData;
}

async function ensureCategoryInClass(classId, categoryId) {
  const categoryResult = await pool.query(
    'SELECT id FROM categories WHERE id = $1 AND class_id = $2',
    [categoryId, classId]
  );

  if (categoryResult.rows.length === 0) {
    const error = new Error('Category not found.');
    error.status = 404;
    throw error;
  }

  return categoryResult.rows[0];
}

async function ensureFolderInClass(classId, folderId) {
  const folderResult = await pool.query(
    'SELECT id, category_id FROM folders WHERE id = $1 AND class_id = $2',
    [folderId, classId]
  );

  if (folderResult.rows.length === 0) {
    const error = new Error('Folder not found.');
    error.status = 404;
    throw error;
  }

  return folderResult.rows[0];
}

async function getCategories(classId, user) {
  await ensureClassAccess(user, classId);

  const result = await pool.query(
    `SELECT c.id,
            c.name,
            c.created_at,
            COALESCE(COUNT(f.id), 0)::int AS folder_count
     FROM categories c
     LEFT JOIN folders f ON f.category_id = c.id
     WHERE c.class_id = $1
     GROUP BY c.id, c.name, c.created_at
     ORDER BY c.created_at DESC, c.id DESC`,
    [classId]
  );

  return result.rows;
}

async function createCategory(classId, user, name) {
  await ensureTeacherOwner(user, classId);

  try {
    const result = await pool.query(
      `INSERT INTO categories (class_id, name)
       VALUES ($1, $2)
       RETURNING id, class_id, name, created_at`,
      [classId, name]
    );

    return result.rows[0];
  } catch (error) {
    if (error.code === '23505') {
      const conflict = new Error('Category name already exists in this class.');
      conflict.status = 409;
      throw conflict;
    }

    throw error;
  }
}

async function deleteCategory(classId, categoryId, user) {
  await ensureTeacherOwner(user, classId);

  const categoryResult = await pool.query(
    'SELECT id FROM categories WHERE id = $1 AND class_id = $2',
    [categoryId, classId]
  );

  if (categoryResult.rows.length === 0) {
    const error = new Error('Category not found.');
    error.status = 404;
    throw error;
  }

  // TODO: enqueue MinIO cleanup for deleted category files.
  await pool.query(
    'DELETE FROM categories WHERE id = $1 AND class_id = $2',
    [categoryId, classId]
  );
}

async function getFolders(classId, categoryId, user) {
  await ensureClassAccess(user, classId);
  await ensureCategoryInClass(classId, categoryId);

  const result = await pool.query(
    `SELECT f.id,
            f.name,
            f.created_at,
            COALESCE(COUNT(cf.id), 0)::int AS file_count
     FROM folders f
     LEFT JOIN class_files cf ON cf.folder_id = f.id
     WHERE f.class_id = $1 AND f.category_id = $2
     GROUP BY f.id, f.name, f.created_at
     ORDER BY f.created_at DESC, f.id DESC`,
    [classId, categoryId]
  );

  return result.rows;
}

async function createFolder(classId, categoryId, user, name) {
  await ensureTeacherOwner(user, classId);
  await ensureCategoryInClass(classId, categoryId);

  try {
    const result = await pool.query(
      `INSERT INTO folders (class_id, category_id, name)
       VALUES ($1, $2, $3)
       RETURNING id, class_id, category_id, name, created_at`,
      [classId, categoryId, name]
    );

    return result.rows[0];
  } catch (error) {
    if (error.code === '23505') {
      const conflict = new Error('Folder name already exists in this category.');
      conflict.status = 409;
      throw conflict;
    }

    throw error;
  }
}

async function deleteFolder(classId, categoryId, folderId, user) {
  await ensureTeacherOwner(user, classId);
  await ensureCategoryInClass(classId, categoryId);

  const folderResult = await pool.query(
    'SELECT id FROM folders WHERE id = $1 AND class_id = $2 AND category_id = $3',
    [folderId, classId, categoryId]
  );

  if (folderResult.rows.length === 0) {
    const error = new Error('Folder not found.');
    error.status = 404;
    throw error;
  }

  // TODO: enqueue MinIO cleanup for deleted folder files.
  await pool.query(
    'DELETE FROM folders WHERE id = $1 AND class_id = $2 AND category_id = $3',
    [folderId, classId, categoryId]
  );
}

async function uploadFile(classId, folderId, user, file) {
  await ensureTeacherOwner(user, classId);
  await ensureFolderInClass(classId, folderId);

  const objectKey = `${classId}/${folderId}/${crypto.randomUUID()}_${file.originalname}`;

  await minioClient.putObject(
    BUCKET_NAME,
    objectKey,
    file.buffer,
    file.size,
    { 'Content-Type': file.mimetype }
  );

  const result = await pool.query(
    `INSERT INTO class_files (folder_id, class_id, uploaded_by, original_name, minio_object_key, mime_type, size_bytes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, original_name, mime_type, size_bytes, created_at`,
    [folderId, classId, user.id, file.originalname, objectKey, file.mimetype || null, file.size]
  );

  return result.rows[0];
}

async function listFiles(classId, folderId, user) {
  await ensureClassAccess(user, classId);
  await ensureFolderInClass(classId, folderId);

  const result = await pool.query(
    `SELECT cf.id,
            cf.original_name,
            cf.mime_type,
            cf.size_bytes,
            cf.created_at,
            u.full_name AS uploaded_by_name
     FROM class_files cf
     JOIN users u ON u.id = cf.uploaded_by
     WHERE cf.class_id = $1 AND cf.folder_id = $2
     ORDER BY cf.created_at DESC, cf.id DESC`,
    [classId, folderId]
  );

  return result.rows;
}

async function getDownloadUrl(fileId, user) {
  const fileResult = await pool.query(
    `SELECT id, class_id, minio_object_key
     FROM class_files
     WHERE id = $1`,
    [fileId]
  );

  if (fileResult.rows.length === 0) {
    const error = new Error('File not found.');
    error.status = 404;
    throw error;
  }

  const fileRecord = fileResult.rows[0];
  await ensureClassAccess(user, fileRecord.class_id);

  try {
    const expiresInSeconds = 3600;
    const downloadUrl = await minioClient.presignedGetObject(
      BUCKET_NAME,
      fileRecord.minio_object_key,
      expiresInSeconds
    );

    return { downloadUrl, expiresInSeconds };
  } catch (error) {
    const err = new Error('Unable to generate download URL.');
    err.status = 500;
    throw err;
  }
}

async function deleteFile(fileId, user) {
  const fileResult = await pool.query(
    `SELECT id, class_id, minio_object_key
     FROM class_files
     WHERE id = $1`,
    [fileId]
  );

  if (fileResult.rows.length === 0) {
    const error = new Error('File not found.');
    error.status = 404;
    throw error;
  }

  const fileRecord = fileResult.rows[0];
  await ensureTeacherOwner(user, fileRecord.class_id);

  try {
    await minioClient.removeObject(BUCKET_NAME, fileRecord.minio_object_key);
  } catch (error) {
    const err = new Error('Unable to delete file from storage.');
    err.status = 500;
    throw err;
  }

  await pool.query('DELETE FROM class_files WHERE id = $1', [fileId]);

  return { id: fileId };
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
