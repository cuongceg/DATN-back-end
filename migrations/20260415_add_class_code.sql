ALTER TABLE classes
ADD COLUMN IF NOT EXISTS class_code VARCHAR(6);

WITH generated_codes AS (
    SELECT
        c.id,
        UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 6)) AS new_code
    FROM classes c
    WHERE c.class_code IS NULL
)
UPDATE classes c
SET class_code = g.new_code
FROM generated_codes g
WHERE c.id = g.id;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM classes WHERE class_code IS NULL) THEN
        RAISE EXCEPTION 'Failed to populate class_code for all existing classes.';
    END IF;
END
$$;

ALTER TABLE classes
ALTER COLUMN class_code SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_classes_class_code_format'
    ) THEN
        ALTER TABLE classes
        ADD CONSTRAINT chk_classes_class_code_format
        CHECK (class_code ~ '^[A-Z0-9]{6}$');
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_class_code_unique ON classes(class_code);
