ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS scheduled_end_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_sessions_scheduled_time'
  ) THEN
    ALTER TABLE sessions
      ADD CONSTRAINT chk_sessions_scheduled_time
        CHECK (
          scheduled_end_at IS NULL
          OR scheduled_at IS NULL
          OR scheduled_end_at > scheduled_at
        );
  END IF;
END $$;
