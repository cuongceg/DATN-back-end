CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'student');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status') THEN
        CREATE TYPE session_status AS ENUM ('scheduled', 'ongoing', 'completed');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'artifact_status') THEN
        CREATE TYPE artifact_status AS ENUM ('processing', 'failed', 'completed');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'class_status') THEN
        CREATE TYPE class_status AS ENUM ('active', 'archived');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'class_member_permission') THEN
        CREATE TYPE class_member_permission AS ENUM ('Member', 'Owner');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_type') THEN
        CREATE TYPE post_type AS ENUM ('normal', 'session');
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role user_role NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL,
    class_code VARCHAR(6) NOT NULL UNIQUE,
    status class_status NOT NULL DEFAULT 'active',
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_classes_class_code_format
        CHECK (class_code ~ '^[A-Z0-9]{6}$'),
    CONSTRAINT fk_classes_teacher
        FOREIGN KEY (teacher_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS class_members (
    class_id UUID NOT NULL,
    student_id UUID NOT NULL,
    permission class_member_permission NOT NULL DEFAULT 'Member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (class_id, student_id),
    CONSTRAINT fk_class_members_class
        FOREIGN KEY (class_id)
        REFERENCES classes(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_class_members_student
        FOREIGN KEY (student_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL,
    livekit_room_id VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    scheduled_at TIMESTAMPTZ,
    scheduled_end_at TIMESTAMPTZ,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    status session_status NOT NULL DEFAULT 'scheduled',
    CONSTRAINT fk_sessions_class
        FOREIGN KEY (class_id)
        REFERENCES classes(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_sessions_scheduled_time
        CHECK (
            scheduled_end_at IS NULL
            OR scheduled_at IS NULL
            OR scheduled_end_at > scheduled_at
        ),
    CONSTRAINT chk_sessions_time
        CHECK (end_time IS NULL OR start_time IS NULL OR end_time >= start_time)
);

CREATE TABLE IF NOT EXISTS session_participants (
    session_id UUID NOT NULL,
    user_id UUID NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    PRIMARY KEY (session_id, user_id),
    CONSTRAINT fk_sp_session
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_sp_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL,
    author_id UUID NOT NULL,
    type post_type NOT NULL DEFAULT 'normal',
    title VARCHAR(500),
    body_delta JSONB,
    body_plain TEXT,
    session_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_posts_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT fk_posts_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_posts_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    CONSTRAINT chk_posts_session_type CHECK (
        (type = 'session' AND session_id IS NOT NULL) OR
        (type = 'normal' AND session_id IS NULL)
    )
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    content TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_messages_session
        FOREIGN KEY (session_id)
        REFERENCES sessions(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_messages_sender
        FOREIGN KEY (sender_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS session_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    video_file_path VARCHAR(500),
    transcript_file_path VARCHAR(500),
    ai_summary_content JSONB,
    status artifact_status NOT NULL DEFAULT 'processing',
    CONSTRAINT fk_session_artifacts_session
        FOREIGN KEY (session_id)
        REFERENCES sessions(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS session_recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    class_id UUID NOT NULL,
    egress_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'recording',
    s3_key TEXT,
    duration_seconds INT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    started_by UUID,
    CONSTRAINT fk_session_recordings_session
        FOREIGN KEY (session_id)
        REFERENCES sessions(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_session_recordings_class
        FOREIGN KEY (class_id)
        REFERENCES classes(id)
        ON DELETE CASCADE
);

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

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON classes(teacher_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_class_code_unique ON classes(class_code);
CREATE INDEX IF NOT EXISTS idx_class_members_student_id ON class_members(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_class_id ON sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_session_id ON session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_user_id ON session_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_session_artifacts_session_id ON session_artifacts(session_id);
CREATE INDEX IF NOT EXISTS idx_session_recordings_session_id ON session_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_session_recordings_class_id ON session_recordings(class_id);
CREATE INDEX IF NOT EXISTS idx_session_recordings_class_id_started_at ON session_recordings(class_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_class_id ON posts(class_id);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_session_id ON posts(session_id);
CREATE INDEX IF NOT EXISTS idx_folders_class_parent_id ON folders(class_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_class_path ON folders(class_id, path);
CREATE INDEX IF NOT EXISTS idx_class_files_class_path ON class_files(class_id, path);

CREATE TABLE IF NOT EXISTS session_reactions (
    session_id  UUID NOT NULL,
    user_id     UUID NOT NULL,
    type        VARCHAR(20) NOT NULL,
    raised_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_id, user_id),
    CONSTRAINT fk_sr_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_sr_user    FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_sr_type   CHECK (type IN ('raise_hand','agree','repeat','pause','confused'))
);

CREATE INDEX IF NOT EXISTS idx_session_reactions_session_id ON session_reactions(session_id);
