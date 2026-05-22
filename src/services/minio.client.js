const Minio = require('minio');

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
const MINIO_PORT = Number(process.env.MINIO_PORT || 9000);
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || '';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || '';
const MINIO_USE_SSL = String(process.env.MINIO_USE_SSL || 'false').toLowerCase() === 'true';

const BUCKET_NAME = 'class-files';
const RECORDING_BUCKET_NAME = process.env.MINIO_RECORDING_BUCKET || 'session-recordings';

const minioClient = new Minio.Client({
  endPoint: MINIO_ENDPOINT,
  port: MINIO_PORT,
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY,
  useSSL: MINIO_USE_SSL,
});

async function ensureBucket() {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME);
    }
  } catch (error) {
    console.warn('MinIO bucket check failed:', error.message);
  }
}

async function ensureRecordingBucket() {
  try {
    const exists = await minioClient.bucketExists(RECORDING_BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(RECORDING_BUCKET_NAME);
    }
  } catch (error) {
    console.warn('MinIO recording bucket check failed:', error.message);
  }
}

module.exports = {
  BUCKET_NAME,
  RECORDING_BUCKET_NAME,
  minioClient,
  ensureBucket,
  ensureRecordingBucket,
};
