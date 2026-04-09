---
name: commit-msg
description: Generate a conventional commit message and create the commit. Use when the user asks to commit changes, write a commit message, or stage and commit files.
disable-model-invocation: true
allowed-tools: Bash, Read, Glob, Grep
---

# Commit Message Skill

## Current State
- Branch: !`git branch --show-current`
- Staged changes: !`git diff --cached --stat`
- Unstaged changes: !`git status --short`
- Recent commits (for style reference): !`git log --oneline -5`

## Instructions

Generate a **Conventional Commits** message for the staged changes in this project and create the commit.

### Step 1 — Understand the changes

1. Run `git diff --cached` to read the full staged diff.
2. If nothing is staged and `$ARGUMENTS` doesn't specify files, run `git status` and ask the user which files to stage, or stage all changed files if the user said "commit everything".
3. If `$ARGUMENTS` names specific files, stage them first: `git add <files>`.

### Step 2 — Pick the right type

| Type | When to use |
|------|-------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code restructuring, no behavior change |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests |
| `docs` | Documentation only |
| `chore` | Build scripts, deps, config (no production code) |
| `style` | Formatting, whitespace (no logic change) |
| `ci` | CI/CD pipeline changes |
| `revert` | Reverting a previous commit |

### Step 3 — Determine scope (optional)

Use the service/module that changed as the scope:
- `ui` — crm-ui frontend changes
- `backend` — crm-backend Java changes
- `agents` — crm-agents Python changes
- `infra` — crm-infra / Docker / infrastructure
- `memory` — memory system changes
- `streaming` — SSE / streaming layer
- `a2ui` — A2UIRenderer / agent-to-UI components
- `guardrails` — guardrails agent
- `orchestrator` — orchestrator agent
- `db` — database migrations or schema
- `config` — configuration / environment changes

### Step 4 — Write the commit message

Format:
```
<type>(<scope>): <short summary in imperative mood>

[optional body — explain WHY, not what]

[optional footer — breaking changes, issue refs]
```

Rules:
- Summary line ≤ 72 characters
- Imperative mood: "add", "fix", "remove" — not "added", "fixing"
- No period at the end of the summary line
- Body and footer separated from summary by a blank line
- Mark breaking changes with `BREAKING CHANGE:` in footer

### Step 5 — Create the commit

Run the commit using a HEREDOC to preserve formatting:

```bash
git commit -m "$(cat <<'EOF'
<type>(<scope>): <summary>

<body if needed>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

After committing, confirm success with `git log --oneline -1`.

---

## Examples for this project

```
feat(a2ui): add chart component to safe renderer catalog

fix(streaming): prevent duplicate SSE emitters on reconnect

refactor(memory): consolidate working memory TTL config into CrmProperties

feat(orchestrator): add parallel execution mode for multi-agent tasks

fix(db): correct currency column type in V10 migration

chore(infra): bump Qdrant image to 1.9.7

test(backend): add Testcontainers integration test for SessionService

docs: update CLAUDE.md with agent port reference table
```
