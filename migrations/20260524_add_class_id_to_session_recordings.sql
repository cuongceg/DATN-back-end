BEGIN;

ALTER TABLE session_recordings
  ADD COLUMN IF NOT EXISTS class_id UUID;

UPDATE session_recordings sr
SET class_id = s.class_id
FROM sessions s
WHERE sr.session_id = s.id
  AND sr.class_id IS NULL;

ALTER TABLE session_recordings
  ALTER COLUMN class_id SET NOT NULL;

ALTER TABLE session_recordings
  ADD CONSTRAINT IF NOT EXISTS fk_session_recordings_class_id
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_session_recordings_class_id
  ON session_recordings(class_id);

CREATE INDEX IF NOT EXISTS idx_session_recordings_class_id_started_at
  ON session_recordings(class_id, started_at DESC);

COMMIT;
