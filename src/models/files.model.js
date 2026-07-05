const pool = require('../config/db');

async function findClassById(classId) {
  const { rows } = await pool.query(
    'SELECT id, teacher_id FROM classes WHERE id = $1',
    [classId]
  );
  return rows[0] || null;
}

async function findClassMember(classId, userId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM class_members WHERE class_id = $1 AND student_id = $2',
    [classId, userId]
  );
  return rows.length > 0;
}

async function findFolderByPath(classId, folderPath) {
  const { rows } = await pool.query(
    `SELECT id, class_id, parent_id, name, path, created_by, created_at
     FROM folders
     WHERE class_id = $1 AND path = $2`,
    [classId, folderPath]
  );
  return rows[0] || null;
}

async function findFileByPath(classId, filePath) {
  const { rows } = await pool.query(
    `SELECT id, class_id, path, created_by, original_name, minio_object_key, mime_type, size_bytes, created_at
     FROM class_files
     WHERE class_id = $1 AND path = $2`,
    [classId, filePath]
  );
  return rows[0] || null;
}

async function insertFolderOrNothing(classId, parentId, name, path, userId) {
  const { rows } = await pool.query(
    `INSERT INTO folders (class_id, parent_id, name, path, created_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (class_id, path) DO NOTHING
     RETURNING id, parent_id, name, path, created_by, created_at`,
    [classId, parentId, name, path, userId]
  );
  return rows[0] || null;
}

async function createFolder(classId, parentId, name, path, userId) {
  const { rows } = await pool.query(
    `INSERT INTO folders (class_id, parent_id, name, path, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, path, name, created_at`,
    [classId, parentId, name, path, userId]
  );
  return rows[0];
}

async function createFile(classId, path, createdBy, originalName, minioObjectKey, mimeType, sizeBytes) {
  const { rows } = await pool.query(
    `INSERT INTO class_files (class_id, path, created_by, original_name, minio_object_key, mime_type, size_bytes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, path, original_name, mime_type, size_bytes, created_at`,
    [classId, path, createdBy, originalName, minioObjectKey, mimeType, sizeBytes]
  );
  return rows[0];
}

async function listFolders(classId, parentFolderId, isRoot) {
  const { rows } = await pool.query(
    `SELECT f.id, f.name, f.path, f.created_at, u.full_name AS created_by_name
     FROM folders f
     JOIN users u ON u.id = f.created_by
     WHERE f.class_id = $1 AND ${isRoot ? 'f.parent_id IS NULL' : 'f.parent_id = $2'}
     ORDER BY f.name ASC, f.created_at DESC`,
    isRoot ? [classId] : [classId, parentFolderId]
  );
  return rows;
}

async function listFiles(classId, likePattern, notLikePattern) {
  const { rows } = await pool.query(
    `SELECT cf.id, cf.path, cf.original_name, cf.mime_type, cf.size_bytes, cf.created_at,
            u.full_name AS created_by_name
     FROM class_files cf
     JOIN users u ON u.id = cf.created_by
     WHERE cf.class_id = $1 AND cf.path LIKE $2 AND cf.path NOT LIKE $3
     ORDER BY cf.path ASC, cf.created_at DESC`,
    [classId, likePattern, notLikePattern]
  );
  return rows;
}

async function hasFolderChildren(classId, folderId, folderPath) {
  const [childFolders, childFiles] = await Promise.all([
    pool.query(
      'SELECT 1 FROM folders WHERE class_id = $1 AND parent_id = $2 LIMIT 1',
      [classId, folderId]
    ),
    pool.query(
      'SELECT 1 FROM class_files WHERE class_id = $1 AND path LIKE $2 LIMIT 1',
      [classId, `${folderPath}/%`]
    ),
  ]);
  return childFolders.rows.length > 0 || childFiles.rows.length > 0;
}

async function deleteFolderById(folderId) {
  await pool.query('DELETE FROM folders WHERE id = $1', [folderId]);
}

async function deleteFileById(fileId) {
  await pool.query('DELETE FROM class_files WHERE id = $1', [fileId]);
}

module.exports = {
  findClassById,
  findClassMember,
  findFolderByPath,
  findFileByPath,
  insertFolderOrNothing,
  createFolder,
  createFile,
  listFolders,
  listFiles,
  hasFolderChildren,
  deleteFolderById,
  deleteFileById,
};
