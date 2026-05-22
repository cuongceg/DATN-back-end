const { RoomServiceClient, EgressClient } = require('livekit-server-sdk');

const roomService = new RoomServiceClient(
  process.env.LIVEKIT_URL,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

const egressClient = new EgressClient(
  process.env.LIVEKIT_HOST || process.env.LIVEKIT_URL,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);

module.exports = {
  roomService,
  egressClient,
};
