-- Convert semantic_memory_index.entity_id from uuid to varchar(255).
-- The JPA entity (SemanticMemoryIndex.java) maps entityId as String and all
-- service code passes/receives entity IDs as opaque String identifiers.
-- Keeping the column as uuid caused a Hibernate validation failure:
--   found [uuid (Types#OTHER)], but expecting [varchar(255) (Types#VARCHAR)]
-- Note: episodic_memory.entity_id remains uuid (its entity uses java.util.UUID).
ALTER TABLE semantic_memory_index
    ALTER COLUMN entity_id TYPE varchar(255) USING entity_id::text;
