const { egressClient } = require('../config/livekit');
const { minioClient, RECORDING_BUCKET_NAME } = require('./minio.client');
const { EncodedFileOutput, EncodedFileType, S3Upload } = require('livekit-server-sdk');
const sessionsModel = require('../models/sessions.model');
const recordingsModel = require('../models/recordings.model');

const RECORDING_EXPIRES_IN_SECONDS = 4 * 60 * 60;

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function startRecording(sessionId, startedByUserId) {
  const session = await sessionsModel.findById(sessionId);
  if (!session) {
    throw createHttpError(404, 'Session not found.');
  }
  if (session.status !== 'ongoing' || !session.livekit_room_id) {
    throw createHttpError(400, 'Session is not ongoing.');
  }

  const isRunning = await recordingsModel.findRunningBySession(sessionId);
  if (isRunning) {
    throw createHttpError(409, 'A recording is already in progress.');
  }

  const minioHost = process.env.MINIO_ENDPOINT || 'localhost';
  const minioPort = Number(process.env.MINIO_PORT || 9000);
  const minioUseSsl = String(process.env.MINIO_USE_SSL || 'false').toLowerCase() === 'true';
  const minioEndpointUrl = `${minioUseSsl ? 'https' : 'http'}://${minioHost}:${minioPort}`;

  const sessionTitle = String(session.title || 'session')
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const datePath = `${dd}-${mm}-${yyyy}-${hh}-${min}`;

  const filePath = `recordings/${session.class_id}/${sessionTitle}-recording-${datePath}.mp4`;

  const fileOutput = new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath: filePath,
    output: {
      case: 's3',
      value: new S3Upload({
        accessKey: process.env.MINIO_ACCESS_KEY,
        secret: process.env.MINIO_SECRET_KEY,
        region: process.env.MINIO_REGION || 'us-east-1',
        bucket: RECORDING_BUCKET_NAME,
        endpoint: minioEndpointUrl,
        forcePathStyle: true,
      }),
    },
  });

  const egressInfo = await egressClient.startRoomCompositeEgress(
    session.livekit_room_id,
    { file: fileOutput },
    { layout: 'speaker' }
  );

  console.log('egressInfo:', JSON.stringify(egressInfo, null, 2));

  const egressId = egressInfo?.egressId || egressInfo?.egress_id;
  if (!egressId) {
    throw createHttpError(500, 'Unable to start recording.');
  }

  return recordingsModel.create(sessionId, session.class_id, egressId, startedByUserId);
}

async function stopRecording(sessionId, egressId) {
  const record = await recordingsModel.findBySessionAndEgress(sessionId, egressId);
  if (!record) {
    throw createHttpError(404, 'Recording not found.');
  }

  await egressClient.stopEgress(egressId);
  await recordingsModel.updateStopping(sessionId, egressId);

  return { egress_id: egressId, status: 'stopping' };
}

async function listRecordings(classId) {
  const rows = await recordingsModel.listCompleted(classId);

  return Promise.all(
    rows.map(async (row) => {
      const downloadUrl = row.s3_key
        ? await minioClient.presignedGetObject(RECORDING_BUCKET_NAME, row.s3_key, RECORDING_EXPIRES_IN_SECONDS)
        : null;

      return {
        id: row.id,
        session_id: row.session_id,
        egress_id: row.egress_id,
        duration_seconds: row.duration_seconds,
        started_at: row.started_at,
        ended_at: row.ended_at,
        download_url: downloadUrl,
        expires_in_seconds: RECORDING_EXPIRES_IN_SECONDS,
      };
    })
  );
}

async function recordingExists(sessionId, egressId) {
  return recordingsModel.checkExists(sessionId, egressId);
}

module.exports = { startRecording, stopRecording, listRecordings, recordingExists };
