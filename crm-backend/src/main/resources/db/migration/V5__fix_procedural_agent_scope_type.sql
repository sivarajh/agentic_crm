-- Convert procedural_memory.agent_scope from text[] to jsonb.
-- The JPA entity maps agent_scope with @JdbcTypeCode(SqlTypes.JSON), which requires
-- a jsonb column; the original V3 DDL used text[] causing a Hibernate validation mismatch.
--
-- The GIN index must be dropped first: text[] GIN uses array_ops which is incompatible
-- with jsonb. It is recreated with jsonb_path_ops after the type change.
DROP INDEX IF EXISTS idx_procedural_agent_scope;

ALTER TABLE procedural_memory
    ALTER COLUMN agent_scope TYPE jsonb USING to_jsonb(agent_scope);

CREATE INDEX idx_procedural_agent_scope ON procedural_memory USING GIN (agent_scope jsonb_path_ops);
