DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_type') THEN
        CREATE TYPE post_type AS ENUM ('normal', 'session');
    END IF;
END
$$;

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

CREATE INDEX IF NOT EXISTS idx_posts_class_id ON posts(class_id);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_session_id ON posts(session_id);
