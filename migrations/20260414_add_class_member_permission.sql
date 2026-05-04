DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'class_member_permission') THEN
        CREATE TYPE class_member_permission AS ENUM ('Member', 'Owner');
    END IF;
END
$$;

ALTER TABLE class_members
ADD COLUMN IF NOT EXISTS permission class_member_permission NOT NULL DEFAULT 'Member';
