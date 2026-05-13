CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_categories_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT uq_categories_class_name UNIQUE (class_id, name)
);

CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL,
    class_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_folders_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    CONSTRAINT fk_folders_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT uq_folders_category_name UNIQUE (category_id, name)
);

CREATE TABLE IF NOT EXISTS class_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID NOT NULL,
    class_id UUID NOT NULL,
    uploaded_by UUID NOT NULL,
    original_name VARCHAR(500) NOT NULL,
    minio_object_key VARCHAR(1000) NOT NULL UNIQUE,
    mime_type VARCHAR(255),
    size_bytes BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_class_files_folder FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
    CONSTRAINT fk_class_files_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT fk_class_files_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_categories_class_id ON categories(class_id);
CREATE INDEX IF NOT EXISTS idx_folders_category_id ON folders(category_id);
CREATE INDEX IF NOT EXISTS idx_class_files_folder_id ON class_files(folder_id);
