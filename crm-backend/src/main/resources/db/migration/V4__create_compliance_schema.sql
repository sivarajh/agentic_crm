-- ─── Audit Events ─────────────────────────────────────────────────────────────
-- Immutable audit trail for all agent actions, memory operations, and compliance events
CREATE TABLE audit_events (
    audit_event_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      VARCHAR(100) NOT NULL,
    agent_id        VARCHAR(100),
    user_id         UUID,
    session_id      UUID,
    action          VARCHAR(255) NOT NULL,
    resource_type   VARCHAR(100),
    resource_id     VARCHAR(255),
    data_hash       VARCHAR(64),     -- SHA-256 of action payload for tamper detection
    trace_id        VARCHAR(64),
    span_id         VARCHAR(16),
    review_status   VARCHAR(50) NOT NULL DEFAULT 'NOT_REQUIRED'
                        CHECK (review_status IN ('NOT_REQUIRED', 'PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED')),
    metadata        JSONB       NOT NULL DEFAULT '{}',
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- append-only: no UPDATE or DELETE allowed; see trigger below
);

CREATE INDEX idx_audit_user_id      ON audit_events (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_session_id   ON audit_events (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_audit_agent_id     ON audit_events (agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX idx_audit_event_type   ON audit_events (event_type);
CREATE INDEX idx_audit_review_status ON audit_events (review_status);
CREATE INDEX idx_audit_occurred_at  ON audit_events (occurred_at DESC);
CREATE INDEX idx_audit_trace_id     ON audit_events (trace_id) WHERE trace_id IS NOT NULL;
CREATE INDEX idx_audit_resource     ON audit_events (resource_type, resource_id)
    WHERE resource_type IS NOT NULL;

-- Immutability: audit_events rows must never be modified
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'audit_events is append-only: modifications are not allowed (audit_event_id: %)',
        OLD.audit_event_id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_immutable
    BEFORE UPDATE OR DELETE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- ─── Review Queue ─────────────────────────────────────────────────────────────
-- Human-review queue for flagged interactions (from guardrails, rules engine, etc.)
CREATE TABLE review_queue (
    review_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_event_id  UUID        NOT NULL REFERENCES audit_events (audit_event_id),
    flagged_by      VARCHAR(100) NOT NULL,   -- e.g. "guardrails", "compliance_rule", "manual"
    flag_reason     VARCHAR(255),
    flag_details    JSONB       NOT NULL DEFAULT '{}',
    assigned_to     VARCHAR(100),
    status          VARCHAR(50) NOT NULL DEFAULT 'OPEN'
                        CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED')),
    resolution      TEXT,
    resolved_by     VARCHAR(100),
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_status      ON review_queue (status);
CREATE INDEX idx_review_assigned_to ON review_queue (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_review_audit_event ON review_queue (audit_event_id);
CREATE INDEX idx_review_flagged_by  ON review_queue (flagged_by);
CREATE INDEX idx_review_created_at  ON review_queue (created_at DESC);

CREATE TRIGGER trg_review_updated_at
    BEFORE UPDATE ON review_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
