const express = require('express');
const webhookController = require('../controllers/webhook.controller');

const router = express.Router();

router.post(
  '/livekit',
  express.raw({ type: '*/*' }),
  webhookController.handleLiveKitWebhook
);

module.exports = router;
