CREATE TABLE IF NOT EXISTS session_participants (
    session_id  UUID        NOT NULL,
    user_id     UUID        NOT NULL,
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at     TIMESTAMPTZ,
    PRIMARY KEY (session_id, user_id),
    CONSTRAINT fk_sp_session
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_sp_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_participants_session_id
    ON session_participants(session_id);

CREATE INDEX IF NOT EXISTS idx_session_participants_user_id
    ON session_participants(user_id);
