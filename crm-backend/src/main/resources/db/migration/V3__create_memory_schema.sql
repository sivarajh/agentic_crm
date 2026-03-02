-- ─── Episodic Memory ──────────────────────────────────────────────────────────
-- Stores time-stamped interaction episodes for entities (users, accounts, etc.)
CREATE TABLE episodic_memory (
    episode_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id       UUID        NOT NULL,
    entity_type     VARCHAR(50) NOT NULL,
    event_type      VARCHAR(100) NOT NULL,
    summary         TEXT        NOT NULL,
    embedding_ref   VARCHAR(36),     -- Qdrant point UUID in crm_episodic_embeddings
    session_id      UUID,
    agent_id        VARCHAR(100),
    metadata        JSONB       NOT NULL DEFAULT '{}',
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_episodic_entity          ON episodic_memory (entity_id, entity_type);
CREATE INDEX idx_episodic_event_type      ON episodic_memory (event_type);
CREATE INDEX idx_episodic_occurred_at     ON episodic_memory (occurred_at DESC);
CREATE INDEX idx_episodic_session_id      ON episodic_memory (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_episodic_embedding_ref   ON episodic_memory (embedding_ref) WHERE embedding_ref IS NOT NULL;

-- ─── Procedural Memory ────────────────────────────────────────────────────────
-- Stores workflow definitions, playbooks, and rules available to agents
CREATE TABLE procedural_memory (
    procedure_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    trigger_conditions  JSONB       NOT NULL DEFAULT '[]',
    steps               JSONB       NOT NULL,
    version             INTEGER     NOT NULL DEFAULT 1,
    active              BOOLEAN     NOT NULL DEFAULT TRUE,
    agent_scope         TEXT[],     -- agent IDs that can use this procedure; NULL = all agents
    created_by          VARCHAR(100),
    metadata            JSONB       NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_procedural_name_version UNIQUE (name, version)
);

CREATE INDEX idx_procedural_active     ON procedural_memory (active);
CREATE INDEX idx_procedural_name       ON procedural_memory (name);
CREATE INDEX idx_procedural_agent_scope ON procedural_memory USING GIN (agent_scope);

CREATE TRIGGER trg_procedural_updated_at
    BEFORE UPDATE ON procedural_memory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Semantic Memory Index ────────────────────────────────────────────────────
-- Tracks vector entries in Qdrant; structured metadata lives here in PostgreSQL
CREATE TABLE semantic_memory_index (
    entry_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    qdrant_point_id VARCHAR(36) NOT NULL UNIQUE,   -- UUID string in Qdrant
    entity_id       UUID,
    entity_type     VARCHAR(50),
    content_hash    VARCHAR(64) NOT NULL,            -- SHA-256 of original content
    source_agent    VARCHAR(100),
    collection_name VARCHAR(100) NOT NULL DEFAULT 'crm_semantic',
    metadata        JSONB       NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ
);

CREATE INDEX idx_semantic_entity       ON semantic_memory_index (entity_id, entity_type);
CREATE INDEX idx_semantic_qdrant       ON semantic_memory_index (qdrant_point_id);
CREATE INDEX idx_semantic_collection   ON semantic_memory_index (collection_name);
CREATE INDEX idx_semantic_expires_at   ON semantic_memory_index (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_semantic_content_hash ON semantic_memory_index (content_hash);
