const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load default environment first.
dotenv.config();

// Optionally override with .env.local if it exists.
const localEnvPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath, override: true });
}

const app = require('./app');
const pool = require('./config/db');
const { ensureBucket } = require('./services/minio.client');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Fail fast on startup if database connection is not available.
    await pool.query('SELECT 1');
    console.log('Database connection check passed.');

    await ensureBucket();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Database connection check failed:', error.message);
    process.exit(1);
  }
}

startServer();
