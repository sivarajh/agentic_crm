-- V7: Soft-delete support for conversations
-- Messages are immutable (append-only trigger) so we cannot cascade-delete them.
-- Instead, mark the conversation row as deleted; queries filter on deleted_at IS NULL.

ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Index to make the IS NULL filter fast on list queries
CREATE INDEX IF NOT EXISTS idx_conversations_deleted_at ON conversations (deleted_at)
    WHERE deleted_at IS NULL;
