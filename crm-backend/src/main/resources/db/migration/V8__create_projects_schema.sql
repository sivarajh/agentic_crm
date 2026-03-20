-- V8: Projects — named groups for organizing conversations

CREATE TABLE projects (
    project_id  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL,
    name        VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_projects_user_id ON projects (user_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Nullable FK on conversations so each conversation can belong to at most one project
ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects (project_id) ON DELETE SET NULL;

CREATE INDEX idx_conversations_project_id ON conversations (project_id)
    WHERE project_id IS NOT NULL;
