const { WebhookReceiver } = require('livekit-server-sdk');
const pool = require('../config/db');

const receiver = new WebhookReceiver(
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

function toDurationSeconds(durationNs) {
  if (durationNs === undefined || durationNs === null) return null;

  const value = typeof durationNs === 'string' ? Number(durationNs) : durationNs;
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value / 1e9);
}

async function handleLiveKitWebhook(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(400).json({ message: 'Authorization header is required.' });
  }

  try {
    const rawBody = req.body;
    const event = await receiver.receive(rawBody, authHeader);

    if (event?.event === 'egress_ended') {
      const info = event.egressInfo || {};
      const egressId = info.egressId || info.egress_id;

      if (egressId) {
        if (info.error) {
          await pool.query(
            `UPDATE session_recordings
             SET status = 'failed', ended_at = NOW()
             WHERE egress_id = $1`,
            [egressId]
          );
        } else {
          const file = Array.isArray(info.fileResults) ? info.fileResults[0] : null;
          const s3Key = file?.filename || null;
          const durationSeconds = toDurationSeconds(file?.duration);

          await pool.query(
            `UPDATE session_recordings
             SET status = 'completed',
                 s3_key = COALESCE($1, s3_key),
                 duration_seconds = COALESCE($2, duration_seconds),
                 ended_at = NOW()
             WHERE egress_id = $3`,
            [s3Key, durationSeconds, egressId]
          );
        }
      }
    }

    return res.sendStatus(200);
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('signature')) {
      return res.status(401).json({ message: 'Invalid LiveKit webhook signature.' });
    }

    return next(error);
  }
}

module.exports = {
  handleLiveKitWebhook,
};
