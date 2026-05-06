const { AccessToken } = require('livekit-server-sdk');
const { roomService } = require('../config/livekit');

async function generateLiveKitToken(roomName, identity, grants = {}) {
  const token = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity: String(identity),
      ttl: '4h',
    }
  );

  const {
    canPublish,
    canSubscribe,
    canPublishData,
    roomAdmin,
    metadata,
    user,
    role,
    ...extraGrants
  } = grants;

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: canPublish ?? true,
    canSubscribe: canSubscribe ?? true,
    canPublishData: canPublishData ?? true,
    roomAdmin: roomAdmin ?? false,
    ...extraGrants,
  });

  const resolvedMetadata = metadata || (user
    ? { name: user.full_name, role: role || user.role }
    : null);

  if (resolvedMetadata) {
    token.metadata = JSON.stringify(resolvedMetadata);
  }

  return await token.toJwt();
}

async function createLiveKitRoom(roomName) {
  return roomService.createRoom({
    name: roomName,
    emptyTimeout: 300,
    maxParticipants: 50,
  });
}

async function deleteLiveKitRoom(roomName) {
  try {
    await roomService.deleteRoom(roomName);
  } catch (error) {
    console.warn('deleteRoom warning:', error.message);
  }
}

async function getActiveParticipants(roomName) {
  return roomService.listParticipants(roomName);
}

module.exports = {
  generateLiveKitToken,
  createLiveKitRoom,
  deleteLiveKitRoom,
  getActiveParticipants,
};
