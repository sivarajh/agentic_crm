-- Sessions: tracks active/historical agent-user sessions
CREATE TABLE sessions (
    session_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    agent_id        VARCHAR(100),
    start_time      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    state           VARCHAR(50)  NOT NULL DEFAULT 'ACTIVE'
                        CHECK (state IN ('ACTIVE', 'IDLE', 'TERMINATED', 'EXPIRED')),
    active_task_id  UUID,
    metadata        JSONB        NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id    ON sessions (user_id);
CREATE INDEX idx_sessions_state      ON sessions (state);
CREATE INDEX idx_sessions_last_active ON sessions (last_active DESC);
CREATE INDEX idx_sessions_agent_id   ON sessions (agent_id) WHERE agent_id IS NOT NULL;

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
