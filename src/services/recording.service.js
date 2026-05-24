const pool = require('../config/db');
const { egressClient } = require('../config/livekit');
const { minioClient, RECORDING_BUCKET_NAME } = require('./minio.client');
const { EncodedFileOutput, EncodedFileType, S3Upload } = require('livekit-server-sdk');

const RECORDING_EXPIRES_IN_SECONDS = 4 * 60 * 60;

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function startRecording(sessionId, startedByUserId) {
  const sessionResult = await pool.query(
    'SELECT id, livekit_room_id, status, class_id, title FROM sessions WHERE id = $1',
    [sessionId]
  );

  if (sessionResult.rows.length === 0) {
    throw createHttpError(404, 'Session not found.');
  }

  const session = sessionResult.rows[0];
  if (session.status !== 'ongoing' || !session.livekit_room_id) {
    throw createHttpError(400, 'Session is not ongoing.');
  }

  const runningResult = await pool.query(
    `SELECT 1
     FROM session_recordings
     WHERE session_id = $1 AND status = 'recording'
     LIMIT 1`,
    [sessionId]
  );

  if (runningResult.rows.length > 0) {
    throw createHttpError(409, 'A recording is already in progress.');
  }

  const minioHost = process.env.MINIO_ENDPOINT_RECORDING || 'localhost';
  const minioPort = Number(process.env.MINIO_PORT || 9000);
  const minioUseSsl = String(process.env.MINIO_USE_SSL || 'false').toLowerCase() === 'true';
  const minioEndpointUrl = `${minioUseSsl ? 'https' : 'http'}://${minioHost}:${minioPort}`;
  const classId = session.class_id;
  const sessionTitle = String(session.title || 'session')
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const filePath = `recordings/${classId}/${sessionTitle}-recording.mp4`;

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

  const options = {
    layout: 'speaker',
  };

  const egressInfo = await egressClient.startRoomCompositeEgress(
    session.livekit_room_id,
    { fileOutputs: [fileOutput] },
    options
  );

  console.log('egressInfo:', JSON.stringify(egressInfo, null, 2));

  const egressId = egressInfo?.egressId || egressInfo?.egress_id;
  if (!egressId) {
    throw createHttpError(500, 'Unable to start recording.');
  }

  const insertResult = await pool.query(
    `INSERT INTO session_recordings (session_id, class_id, egress_id, status, started_by)
     VALUES ($1, $2, $3, 'recording', $4)
     RETURNING id, egress_id, started_at`,
    [sessionId, session.class_id, egressId, startedByUserId]
  );

  return insertResult.rows[0];
}

async function stopRecording(sessionId, egressId) {
  const recordResult = await pool.query(
    `SELECT id, session_id, egress_id
     FROM session_recordings
     WHERE session_id = $1 AND egress_id = $2`,
    [sessionId, egressId]
  );

  if (recordResult.rows.length === 0) {
    throw createHttpError(404, 'Recording not found.');
  }

  await egressClient.stopEgress(egressId);

  await pool.query(
    `UPDATE session_recordings
     SET status = 'stopping'
     WHERE session_id = $1 AND egress_id = $2`,
    [sessionId, egressId]
  );

  return { egress_id: egressId, status: 'stopping' };
}

async function listRecordings(classId) {
  const result = await pool.query(
    `SELECT id,
            session_id,
            egress_id,
            s3_key,
            duration_seconds,
            started_at,
            ended_at
     FROM session_recordings
     WHERE class_id = $1 AND status = 'completed'
     ORDER BY started_at DESC, id DESC`,
    [classId]
  );

  const recordings = await Promise.all(
    result.rows.map(async (row) => {
      const downloadUrl = row.s3_key
        ? await minioClient.presignedGetObject(
          RECORDING_BUCKET_NAME,
          row.s3_key,
          RECORDING_EXPIRES_IN_SECONDS
        )
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

  return recordings;
}

module.exports = {
  startRecording,
  stopRecording,
  listRecordings,
};
