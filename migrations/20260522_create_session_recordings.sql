CREATE TABLE IF NOT EXISTS session_recordings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  egress_id        TEXT NOT NULL UNIQUE,
  status           TEXT NOT NULL DEFAULT 'recording',
  s3_key           TEXT,
  duration_seconds INT,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at         TIMESTAMPTZ,
  started_by       UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_session_recordings_session_id
  ON session_recordings(session_id);
