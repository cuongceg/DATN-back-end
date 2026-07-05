const pool = require('../config/db');

async function findByUser(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM subtitle_preferences WHERE user_id = $1',
    [userId]
  );
  return rows[0] || null;
}

async function upsert(userId, keys, values) {
  const insertColumns = ['user_id', ...keys];
  const insertPlaceholders = insertColumns.map((_, idx) => `$${idx + 1}`);
  const insertValues = [userId, ...values];

  const updateAssignments = [];
  const updateValues = [];
  keys.forEach((key, idx) => {
    updateAssignments.push(`${key} = $${insertValues.length + idx + 1}`);
    updateValues.push(values[idx]);
  });
  updateAssignments.push('updated_at = NOW()');

  const sql = `
    INSERT INTO subtitle_preferences (${insertColumns.join(', ')})
    VALUES (${insertPlaceholders.join(', ')})
    ON CONFLICT (user_id) DO UPDATE
    SET ${updateAssignments.join(', ')}
    RETURNING *`;

  const { rows } = await pool.query(sql, [...insertValues, ...updateValues]);
  return rows[0];
}

async function listPresets(userId) {
  const { rows } = await pool.query(
    `SELECT id, name, settings, created_at
     FROM subtitle_presets
     WHERE user_id = $1
     ORDER BY created_at ASC`,
    [userId]
  );
  return rows;
}

async function countPresets(userId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS count FROM subtitle_presets WHERE user_id = $1',
    [userId]
  );
  return rows[0]?.count ?? 0;
}

async function createPreset(userId, name, settings) {
  const { rows } = await pool.query(
    `INSERT INTO subtitle_presets (user_id, name, settings)
     VALUES ($1, $2, $3)
     RETURNING id, name, settings, created_at`,
    [userId, name, settings]
  );
  return rows[0];
}

async function deletePreset(userId, presetId) {
  const result = await pool.query(
    'DELETE FROM subtitle_presets WHERE id = $1 AND user_id = $2',
    [presetId, userId]
  );
  return result.rowCount;
}

module.exports = { findByUser, upsert, listPresets, countPresets, createPreset, deletePreset };
