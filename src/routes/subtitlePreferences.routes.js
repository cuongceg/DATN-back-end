const express = require('express');
const { body, param, validationResult } = require('express-validator');
const {
  getMyPreferences,
  upsertMyPreferences,
  listMyPresets,
  createMyPreset,
  deleteMyPreset,
} = require('../controllers/subtitlePreferences.controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();

function handleValidationResult(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array({ onlyFirstError: true })[0];
    const message = firstError?.msg || 'Validation failed.';
    return res.status(400).json({ message });
  }
  return next();
}

const positionPresets = [
  'top_left',
  'top_center',
  'top_right',
  'middle_left',
  'middle_center',
  'middle_right',
  'bottom_left',
  'bottom_center',
  'bottom_right',
];

const putPreferencesValidators = [
  body('font_size').optional().isInt({ min: 14, max: 42 }),
  body('font_family').optional().isIn(['sans-serif', 'monospace', 'OpenDyslexic']),
  body('text_color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  body('bg_color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  body('bg_opacity').optional().isFloat({ min: 0, max: 1 }),
  body('max_lines').optional().isInt({ min: 1, max: 3 }),
  body('position_preset').optional().isIn(positionPresets),
  body('width_pct').optional().isInt({ min: 40, max: 100 }),
  body('display_duration_sec').optional().isInt({ min: 1, max: 8 }),
];

const postPresetValidators = [
  body('name').exists({ checkNull: true }).bail().trim().notEmpty().isLength({ max: 100 }),
  body('settings').exists({ checkNull: true }).bail().isObject(),
];

const deletePresetValidators = [
  param('presetId').isUUID(),
];

router.get(
  '/users/me/subtitle-preferences',
  authenticateToken,
  authorizeRoles('student'),
  getMyPreferences
);

router.put(
  '/users/me/subtitle-preferences',
  authenticateToken,
  authorizeRoles('student'),
  putPreferencesValidators,
  handleValidationResult,
  upsertMyPreferences
);

router.get(
  '/users/me/subtitle-presets',
  authenticateToken,
  authorizeRoles('student'),
  listMyPresets
);

router.post(
  '/users/me/subtitle-presets',
  authenticateToken,
  authorizeRoles('student'),
  postPresetValidators,
  handleValidationResult,
  createMyPreset
);

router.delete(
  '/users/me/subtitle-presets/:presetId',
  authenticateToken,
  authorizeRoles('student'),
  deletePresetValidators,
  handleValidationResult,
  deleteMyPreset
);

module.exports = router;
