const express = require('express');
const { authenticateToken } = require('../middleware/auth.middleware');
const suggestionController = require('../controllers/suggestionController');

const router = express.Router();

router.use(authenticateToken);

router.get('/suggestions', suggestionController.getSuggestions);

module.exports = router;
