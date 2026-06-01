const pool = require('../config/db');

const DEFAULT_PREFERENCES = {
  font_size: 20,
  font_family: 'sans-serif',
  text_color: '#FFFFFF',
  bg_color: '#000000',
  bg_opacity: 0.65,
  max_lines: 2,
  position_preset: 'bottom_center',
  width_pct: 80,
  display_duration_sec: 5,
};

const ALLOWED_PREFERENCE_FIELDS = new Set(Object.keys(DEFAULT_PREFERENCES));

function createCodedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function getPreferences(userId) {
  const result = await pool.query(
    'SELECT * FROM subtitle_preferences WHERE user_id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    return {
      user_id: userId,
      ...DEFAULT_PREFERENCES,
    };
  }

  return result.rows[0];
}

async function upsertPreferences(userId, fields) {
  const inputKeys = Object.keys(fields || {});
  const keys = inputKeys.filter((key) => ALLOWED_PREFERENCE_FIELDS.has(key));
  if (keys.length === 0) {
    throw createCodedError('NO_FIELDS', 'No fields provided.');
  }

  const insertColumns = ['user_id', ...keys];
  const insertPlaceholders = insertColumns.map((_, idx) => `$${idx + 1}`);
  const insertValues = [userId, ...keys.map((key) => fields[key])];

  const updateAssignments = [];
  const updateValues = [];

  keys.forEach((key, idx) => {
    updateAssignments.push(`${key} = $${insertValues.length + idx + 1}`);
    updateValues.push(fields[key]);
  });

  updateAssignments.push('updated_at = NOW()');

  const sql = `INSERT INTO subtitle_preferences (${insertColumns.join(', ')})
              VALUES (${insertPlaceholders.join(', ')})
              ON CONFLICT (user_id) DO UPDATE
              SET ${updateAssignments.join(', ')}
              RETURNING *`;

  const result = await pool.query(sql, [...insertValues, ...updateValues]);
  return result.rows[0];
}

async function listPresets(userId) {
  const result = await pool.query(
    `SELECT id, name, settings, created_at
     FROM subtitle_presets
     WHERE user_id = $1
     ORDER BY created_at ASC`,
    [userId]
  );

  return result.rows;
}

async function createPreset(userId, name, settings) {
  const countResult = await pool.query(
    'SELECT COUNT(*)::int AS count FROM subtitle_presets WHERE user_id = $1',
    [userId]
  );

  const count = countResult.rows[0]?.count ?? 0;
  if (count >= 10) {
    throw createCodedError('PRESET_LIMIT_EXCEEDED', 'Maximum 10 presets allowed.');
  }

  const result = await pool.query(
    `INSERT INTO subtitle_presets (user_id, name, settings)
     VALUES ($1, $2, $3)
     RETURNING id, name, settings, created_at`,
    [userId, name, settings]
  );

  return result.rows[0];
}

async function deletePreset(userId, presetId) {
  const result = await pool.query(
    'DELETE FROM subtitle_presets WHERE id = $1 AND user_id = $2',
    [presetId, userId]
  );

  if (result.rowCount === 0) {
    throw createCodedError('PRESET_NOT_FOUND', 'Preset not found.');
  }

  return { id: presetId };
}

module.exports = {
  DEFAULT_PREFERENCES,
  getPreferences,
  upsertPreferences,
  listPresets,
  createPreset,
  deletePreset,
};
