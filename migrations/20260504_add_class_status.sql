DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'class_status') THEN
        CREATE TYPE class_status AS ENUM ('active', 'archived');
    END IF;
END
$$;

ALTER TABLE classes
ADD COLUMN IF NOT EXISTS status class_status NOT NULL DEFAULT 'active';
