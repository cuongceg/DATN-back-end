const subtitlePreferencesModel = require('../models/subtitlePreferences.model');

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

function normalizePreferencesRow(row) {
  if (!row) return row;
  const bgOpacity = row.bg_opacity;
  const parsedBgOpacity =
    bgOpacity === null || bgOpacity === undefined ? bgOpacity : Number(bgOpacity);
  return {
    ...row,
    bg_opacity: Number.isNaN(parsedBgOpacity) ? bgOpacity : parsedBgOpacity,
  };
}

function createCodedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function getPreferences(userId) {
  const row = await subtitlePreferencesModel.findByUser(userId);
  if (!row) {
    return { user_id: userId, ...DEFAULT_PREFERENCES };
  }
  return normalizePreferencesRow(row);
}

async function upsertPreferences(userId, fields) {
  const inputKeys = Object.keys(fields || {});
  const keys = inputKeys.filter((key) => ALLOWED_PREFERENCE_FIELDS.has(key));
  if (keys.length === 0) {
    throw createCodedError('NO_FIELDS', 'No fields provided.');
  }

  const values = keys.map((key) => fields[key]);
  const row = await subtitlePreferencesModel.upsert(userId, keys, values);
  return normalizePreferencesRow(row);
}

async function listPresets(userId) {
  return subtitlePreferencesModel.listPresets(userId);
}

async function createPreset(userId, name, settings) {
  const count = await subtitlePreferencesModel.countPresets(userId);
  if (count >= 10) {
    throw createCodedError('PRESET_LIMIT_EXCEEDED', 'Maximum 10 presets allowed.');
  }
  return subtitlePreferencesModel.createPreset(userId, name, settings);
}

async function deletePreset(userId, presetId) {
  const rowCount = await subtitlePreferencesModel.deletePreset(userId, presetId);
  if (rowCount === 0) {
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
