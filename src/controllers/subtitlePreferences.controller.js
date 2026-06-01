const subtitlePreferencesService = require('../services/subtitlePreferences.service');

const PREFERENCE_FIELD_WHITELIST = [
  'font_size',
  'font_family',
  'text_color',
  'bg_color',
  'bg_opacity',
  'max_lines',
  'position_preset',
  'width_pct',
  'display_duration_sec',
];

function pickWhitelistedFields(body) {
  const fields = {};
  if (!body || typeof body !== 'object') {
    return fields;
  }

  PREFERENCE_FIELD_WHITELIST.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      fields[key] = body[key];
    }
  });

  return fields;
}

async function getMyPreferences(req, res, next) {
  try {
    const result = await subtitlePreferencesService.getPreferences(req.user.id);
    return res.status(200).json({ preferences: result });
  } catch (error) {
    return next(error);
  }
}

async function upsertMyPreferences(req, res, next) {
  try {
    const fields = pickWhitelistedFields(req.body);

    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided.' });
    }

    const result = await subtitlePreferencesService.upsertPreferences(req.user.id, fields);
    return res.status(200).json({ preferences: result });
  } catch (error) {
    return next(error);
  }
}

async function listMyPresets(req, res, next) {
  try {
    const result = await subtitlePreferencesService.listPresets(req.user.id);
    return res.status(200).json({ presets: result });
  } catch (error) {
    return next(error);
  }
}

async function createMyPreset(req, res, next) {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const settings = req.body?.settings;

    const result = await subtitlePreferencesService.createPreset(req.user.id, name, settings);
    return res.status(201).json({ preset: result });
  } catch (error) {
    if (error && error.code === 'PRESET_LIMIT_EXCEEDED') {
      return res.status(409).json({ message: 'Maximum 10 presets allowed.' });
    }

    return next(error);
  }
}

async function deleteMyPreset(req, res, next) {
  try {
    const { presetId } = req.params;

    const result = await subtitlePreferencesService.deletePreset(req.user.id, presetId);
    return res.status(200).json({
      message: 'Preset deleted successfully.',
      preset: result,
    });
  } catch (error) {
    if (error && error.code === 'PRESET_NOT_FOUND') {
      return res.status(404).json({ message: 'Preset not found.' });
    }

    return next(error);
  }
}

module.exports = {
  getMyPreferences,
  upsertMyPreferences,
  listMyPresets,
  createMyPreset,
  deleteMyPreset,
};
