-- Conversations: groups messages within a session
CREATE TABLE conversations (
    conversation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID        NOT NULL REFERENCES sessions (session_id) ON DELETE CASCADE,
    title           VARCHAR(255),
    metadata        JSONB       NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_session_id ON conversations (session_id);
CREATE INDEX idx_conversations_created_at ON conversations (created_at DESC);

-- Conversation messages: append-only immutable log
CREATE TABLE conversation_messages (
    message_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID        NOT NULL REFERENCES conversations (conversation_id) ON DELETE CASCADE,
    session_id      UUID        NOT NULL,
    turn_id         INTEGER     NOT NULL,
    role            VARCHAR(20) NOT NULL
                        CHECK (role IN ('user', 'agent', 'system', 'tool')),
    content         TEXT        NOT NULL,
    agent_id        VARCHAR(100),
    token_count     INTEGER,
    trace_id        VARCHAR(64),
    span_id         VARCHAR(16),
    metadata        JSONB       NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON conversation_messages (conversation_id);
CREATE INDEX idx_messages_session_id      ON conversation_messages (session_id);
CREATE INDEX idx_messages_created_at      ON conversation_messages (created_at DESC);
CREATE INDEX idx_messages_role            ON conversation_messages (role);
CREATE INDEX idx_messages_trace_id        ON conversation_messages (trace_id) WHERE trace_id IS NOT NULL;

-- Enforce immutability: conversation_messages rows must never be updated or deleted
CREATE OR REPLACE FUNCTION prevent_message_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'conversation_messages is append-only: updates and deletes are not allowed (message_id: %)',
        OLD.message_id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_messages_immutable
    BEFORE UPDATE OR DELETE ON conversation_messages
    FOR EACH ROW EXECUTE FUNCTION prevent_message_modification();
