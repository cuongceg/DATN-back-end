const { WebhookReceiver } = require('livekit-server-sdk');
const webhookService = require('../services/webhook.service');

const receiver = new WebhookReceiver(
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

async function handleLiveKitWebhook(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(400).json({ message: 'Authorization header is required.' });
  }

  try {
    const rawBody = req.body;
    const event = await receiver.receive(rawBody, authHeader);

    if (event?.event === 'room_finished') {
      const roomValue = event.room;
      const roomName = typeof roomValue === 'string'
        ? roomValue
        : (roomValue && typeof roomValue === 'object' ? (roomValue.name || roomValue.roomName) : null);

      if (roomName) {
        await webhookService.handleRoomFinished(roomName);
      }
    }

    if (event?.event === 'egress_ended') {
      await webhookService.handleEgressEnded(event.egressInfo);
    }

    return res.sendStatus(200);
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('signature')) {
      return res.status(401).json({ message: 'Invalid LiveKit webhook signature.' });
    }
    return next(error);
  }
}

module.exports = { handleLiveKitWebhook };
