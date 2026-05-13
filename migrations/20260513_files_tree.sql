-- Destructive migration: redesign Files feature to pure folder tree by path.
-- NOTE: This drops existing file/category/folder data.

DROP TABLE IF EXISTS class_files CASCADE;
DROP TABLE IF EXISTS folders CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL,
    parent_id UUID,
    name VARCHAR(255) NOT NULL,
    path TEXT NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_folders_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT fk_folders_parent FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE RESTRICT,
    CONSTRAINT fk_folders_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_folders_class_path UNIQUE (class_id, path)
);

CREATE TABLE IF NOT EXISTS class_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL,
    path TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_name VARCHAR(500) NOT NULL,
    minio_object_key TEXT NOT NULL UNIQUE,
    mime_type VARCHAR(255),
    size_bytes BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_class_files_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT uq_class_files_class_path UNIQUE (class_id, path)
);

CREATE INDEX IF NOT EXISTS idx_folders_class_parent_id ON folders(class_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_class_path ON folders(class_id, path);
CREATE INDEX IF NOT EXISTS idx_class_files_class_path ON class_files(class_id, path);
