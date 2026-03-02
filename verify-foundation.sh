#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# verify-foundation.sh  —  End-to-end smoke test for the CRM platform foundation
#
# Usage:
#   ./verify-foundation.sh [BACKEND_URL] [ORCHESTRATOR_URL]
#
# Defaults to localhost ports used by docker-compose local dev.
# Requires: curl, jq
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BACKEND="${1:-http://localhost:8080}"
ORCH="${2:-http://localhost:8001}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

pass() { echo -e "${GREEN}✓${NC} $1"; ((PASS++)); }
fail() { echo -e "${RED}✗${NC} $1"; ((FAIL++)); }
info() { echo -e "${YELLOW}→${NC} $1"; }
section() { echo -e "\n${YELLOW}══════════════════════════════════════${NC}"; echo "  $1"; echo -e "${YELLOW}══════════════════════════════════════${NC}"; }

require_cmd() {
  command -v "$1" &>/dev/null || { echo "ERROR: '$1' is required but not installed."; exit 1; }
}
require_cmd curl
require_cmd jq

# ─── Helpers ─────────────────────────────────────────────────────────────────

# GETs a URL, returns the body. Exits with fail() on non-2xx.
get() {
  local url="$1" desc="$2"
  local resp
  resp=$(curl -sf "$url" 2>/dev/null) || { fail "$desc: GET $url failed"; return 1; }
  echo "$resp"
}

# POSTs JSON body to a URL, returns the response body.
post() {
  local url="$1" body="$2" desc="$3"
  local resp
  resp=$(curl -sf -X POST "$url" \
    -H "Content-Type: application/json" \
    -d "$body" 2>/dev/null) || { fail "$desc: POST $url failed"; return 1; }
  echo "$resp"
}

# PUTs JSON body to a URL.
put() {
  local url="$1" body="$2" desc="$3"
  curl -sf -X PUT "$url" \
    -H "Content-Type: application/json" \
    -d "$body" &>/dev/null || { fail "$desc: PUT $url failed"; return 1; }
}

assert_jq() {
  local json="$1" query="$2" expected="$3" desc="$4"
  local actual
  actual=$(echo "$json" | jq -r "$query" 2>/dev/null)
  if [[ "$actual" == "$expected" ]]; then
    pass "$desc"
  else
    fail "$desc (expected='$expected' got='$actual')"
  fi
}

# ─── 1. Backend Health ────────────────────────────────────────────────────────

section "1. Backend Health"

resp=$(get "$BACKEND/actuator/health" "backend health") && {
  assert_jq "$resp" ".status" "UP" "Backend actuator health=UP"
} || true

resp=$(get "$BACKEND/actuator/health/readiness" "backend readiness") && {
  assert_jq "$resp" ".status" "UP" "Backend readiness probe"
} || true

# ─── 2. Session API ───────────────────────────────────────────────────────────

section "2. Session API"

SESSION_BODY='{"userId":"00000000-0000-0000-0000-000000000001","agentId":"crm-orchestrator"}'
SESS_RESP=$(post "$BACKEND/api/v1/sessions" "$SESSION_BODY" "create session") || { fail "Cannot proceed without session"; exit 1; }
SESSION_ID=$(echo "$SESS_RESP" | jq -r '.data.sessionId // .sessionId' 2>/dev/null)

if [[ -z "$SESSION_ID" || "$SESSION_ID" == "null" ]]; then
  fail "Session creation: could not extract sessionId from response"
  echo "Response: $SESS_RESP"
else
  pass "Session created: $SESSION_ID"
fi

# GET session
GET_SESS=$(get "$BACKEND/api/v1/sessions/$SESSION_ID" "get session") && {
  assert_jq "$GET_SESS" ".data.state // .state" "ACTIVE" "Session state=ACTIVE"
} || true

# Heartbeat
put "$BACKEND/api/v1/sessions/$SESSION_ID/heartbeat" '{}' "session heartbeat" && pass "Session heartbeat" || true

# ─── 3. Conversation API ──────────────────────────────────────────────────────

section "3. Conversation API"

CONV_BODY="{\"sessionId\":\"$SESSION_ID\",\"title\":\"Foundation smoke test\"}"
CONV_RESP=$(post "$BACKEND/api/v1/conversations" "$CONV_BODY" "create conversation") || { fail "Cannot proceed without conversation"; exit 1; }
CONVERSATION_ID=$(echo "$CONV_RESP" | jq -r '.data.conversationId // .conversationId' 2>/dev/null)

if [[ -z "$CONVERSATION_ID" || "$CONVERSATION_ID" == "null" ]]; then
  fail "Conversation creation: could not extract conversationId"
  echo "Response: $CONV_RESP"
else
  pass "Conversation created: $CONVERSATION_ID"
fi

# Post a message
MSG_BODY="{\"conversationId\":\"$CONVERSATION_ID\",\"sessionId\":\"$SESSION_ID\",\"role\":\"USER\",\"content\":\"Hello, this is a smoke test message\"}"
MSG_RESP=$(post "$BACKEND/api/v1/conversations/$CONVERSATION_ID/messages" "$MSG_BODY" "post message") && {
  MESSAGE_ID=$(echo "$MSG_RESP" | jq -r '.data.messageId // .messageId' 2>/dev/null)
  [[ -n "$MESSAGE_ID" && "$MESSAGE_ID" != "null" ]] && pass "Message posted: $MESSAGE_ID" || fail "Message post: no messageId"
} || true

# GET messages
MSG_LIST=$(get "$BACKEND/api/v1/conversations/$CONVERSATION_ID/messages" "list messages") && {
  MSG_COUNT=$(echo "$MSG_LIST" | jq '.data | length // (.messages | length) // 0' 2>/dev/null)
  [[ "$MSG_COUNT" -ge 1 ]] && pass "Conversation has $MSG_COUNT message(s)" || fail "Expected ≥1 message, got $MSG_COUNT"
} || true

# ─── 4. Working Memory API ────────────────────────────────────────────────────

section "4. Working Memory API"

WM_KEY="smoke_test_key"
WM_VALUE='{"test":true,"value":"smoke_test_value"}'
put "$BACKEND/api/v1/memory/working/$SESSION_ID/$WM_KEY" "$WM_VALUE" "set working memory" && pass "Working memory set" || true

WM_RESP=$(get "$BACKEND/api/v1/memory/working/$SESSION_ID/$WM_KEY" "get working memory") && {
  WM_DATA=$(echo "$WM_RESP" | jq -r '.data.test // .test' 2>/dev/null)
  [[ "$WM_DATA" == "true" ]] && pass "Working memory read: test=true" || fail "Working memory read failed (got: $WM_DATA)"
} || true

# ─── 5. Context Fabric API ────────────────────────────────────────────────────

section "5. Context Fabric API"

CTX_RESP=$(get "$BACKEND/api/v1/context/$SESSION_ID" "get context") && {
  CTX_SESSION=$(echo "$CTX_RESP" | jq '.data.session // .session' 2>/dev/null)
  [[ "$CTX_SESSION" != "null" ]] && pass "Context Fabric: session present" || fail "Context Fabric: session field missing"
} || true

# ─── 6. Episodic Memory API ───────────────────────────────────────────────────

section "6. Episodic Memory API"

ENTITY_ID="00000000-0000-0000-0000-000000000042"
EPI_BODY="{\"entityId\":\"$ENTITY_ID\",\"entityType\":\"test_entity\",\"eventType\":\"SMOKE_TEST\",\"summary\":\"Smoke test episodic memory entry\",\"sessionId\":\"$SESSION_ID\"}"
EPI_RESP=$(post "$BACKEND/api/v1/memory/episodic" "$EPI_BODY" "create episodic memory") && {
  EPI_ID=$(echo "$EPI_RESP" | jq -r '.data.episodeId // .episodeId' 2>/dev/null)
  [[ -n "$EPI_ID" && "$EPI_ID" != "null" ]] && pass "Episodic memory created: $EPI_ID" || fail "Episodic memory: no episodeId in response"
} || true

EPI_LIST=$(get "$BACKEND/api/v1/memory/episodic/entity/$ENTITY_ID" "list episodic memory") && {
  EPI_COUNT=$(echo "$EPI_LIST" | jq '.data | length // 0' 2>/dev/null)
  [[ "$EPI_COUNT" -ge 1 ]] && pass "Episodic memory list: $EPI_COUNT entry(s)" || fail "Expected ≥1 episodic entry, got $EPI_COUNT"
} || true

# ─── 7. Procedural Memory API ─────────────────────────────────────────────────

section "7. Procedural Memory API"

PROC_BODY='{
  "name": "smoke_test_procedure",
  "triggerConditions": {"intent": "smoke_test"},
  "steps": [{"step": 1, "action": "verify_system"}],
  "agentScope": ["crm-orchestrator"],
  "active": true
}'
PROC_RESP=$(post "$BACKEND/api/v1/memory/procedural" "$PROC_BODY" "create procedural memory") && {
  PROC_ID=$(echo "$PROC_RESP" | jq -r '.data.procedureId // .procedureId' 2>/dev/null)
  [[ -n "$PROC_ID" && "$PROC_ID" != "null" ]] && pass "Procedural memory created: $PROC_ID" || fail "Procedural memory: no procedureId"
} || true

# ─── 8. Compliance Audit API ──────────────────────────────────────────────────

section "8. Compliance Audit API"

AUDIT_BODY="{\"eventType\":\"TASK_SUBMITTED\",\"agentId\":\"crm-orchestrator\",\"userId\":\"00000000-0000-0000-0000-000000000001\",\"sessionId\":\"$SESSION_ID\",\"action\":\"smoke_test\",\"resourceType\":\"session\",\"resourceId\":\"$SESSION_ID\",\"payload\":{\"test\":true}}"
AUDIT_RESP=$(post "$BACKEND/api/v1/compliance/audit" "$AUDIT_BODY" "create audit event") && {
  AUDIT_ID=$(echo "$AUDIT_RESP" | jq -r '.data.auditEventId // .auditEventId' 2>/dev/null)
  [[ -n "$AUDIT_ID" && "$AUDIT_ID" != "null" ]] && pass "Audit event recorded: $AUDIT_ID" || fail "Audit event: no auditEventId"
} || true

AUDIT_LIST=$(get "$BACKEND/api/v1/compliance/audit?sessionId=$SESSION_ID" "list audit events") && {
  A_COUNT=$(echo "$AUDIT_LIST" | jq '.data | length // (.content | length) // 0' 2>/dev/null)
  [[ "$A_COUNT" -ge 1 ]] && pass "Audit trail: $A_COUNT event(s) for session" || fail "Expected ≥1 audit event, got $A_COUNT"
} || true

# ─── 9. Agent Gateway / Orchestrator ─────────────────────────────────────────

section "9. Agent Gateway (Orchestrator A2A)"

# Check orchestrator Agent Card
CARD_RESP=$(get "$ORCH/.well-known/agent.json" "orchestrator agent card") && {
  CARD_NAME=$(echo "$CARD_RESP" | jq -r '.name' 2>/dev/null)
  [[ "$CARD_NAME" == "crm-orchestrator" ]] && pass "Orchestrator Agent Card: name=crm-orchestrator" || fail "Agent Card: unexpected name '$CARD_NAME'"
} || true

# Submit a task via backend gateway
TASK_BODY="{\"sessionId\":\"$SESSION_ID\",\"conversationId\":\"$CONVERSATION_ID\",\"intent\":\"smoke_test\",\"input\":\"Verify the foundation is working\"}"
TASK_RESP=$(post "$BACKEND/api/v1/agent/tasks" "$TASK_BODY" "submit agent task") && {
  TASK_ID=$(echo "$TASK_RESP" | jq -r '.data.taskId // .taskId' 2>/dev/null)
  [[ -n "$TASK_ID" && "$TASK_ID" != "null" ]] && pass "Agent task submitted: $TASK_ID" || fail "Agent task: no taskId in response"
} || true

# Poll task status (up to 30s)
if [[ -n "${TASK_ID:-}" && "$TASK_ID" != "null" ]]; then
  info "Polling task $TASK_ID (max 30s)..."
  TASK_DONE=false
  for i in $(seq 1 6); do
    sleep 5
    TSTAT=$(get "$BACKEND/api/v1/agent/tasks/$TASK_ID" "poll task") && {
      STATUS=$(echo "$TSTAT" | jq -r '.data.status // .status' 2>/dev/null)
      info "  Task status: $STATUS (poll $i/6)"
      if [[ "$STATUS" == "completed" || "$STATUS" == "COMPLETED" ]]; then
        pass "Agent task completed within 30s"
        TASK_DONE=true
        break
      elif [[ "$STATUS" == "failed" || "$STATUS" == "FAILED" ]]; then
        fail "Agent task failed"
        TASK_DONE=true
        break
      fi
    } || break
  done
  [[ "$TASK_DONE" == "false" ]] && fail "Agent task did not complete within 30s (may still be running)"
fi

# ─── 10. SSE Stream ───────────────────────────────────────────────────────────

section "10. SSE Stream"

# Just verify the endpoint opens without error (2s timeout)
SSE_RESP=$(curl -sf --max-time 2 "$BACKEND/api/v1/stream/session/$SESSION_ID" 2>&1) || SSE_EXIT=$?
# curl exits 28 (timeout) for SSE since stream stays open — that's success
if [[ "${SSE_EXIT:-0}" -eq 0 || "${SSE_EXIT:-0}" -eq 28 ]]; then
  pass "SSE stream endpoint reachable"
else
  fail "SSE stream endpoint returned error (exit=$SSE_EXIT)"
fi

# ─── 11. Guardrails Service ───────────────────────────────────────────────────

section "11. Guardrails Service"

GUARDRAILS_URL="${GUARDRAILS_URL:-http://localhost:8004}"

GR_HEALTH=$(get "$GUARDRAILS_URL/health" "guardrails health") && {
  pass "Guardrails service healthy"
} || { info "Guardrails not reachable at $GUARDRAILS_URL — skipping"; }

# Clean input — should pass
GR_CLEAN='{"text":"Please help me find the customer account for Acme Corp","session_id":"test","agent_id":"crm-orchestrator"}'
GR_RESP=$(post "$GUARDRAILS_URL/guardrails/validate/input" "$GR_CLEAN" "guardrails clean input") && {
  GR_PASS=$(echo "$GR_RESP" | jq '.passed // .is_valid' 2>/dev/null)
  [[ "$GR_PASS" == "true" ]] && pass "Guardrails: clean input passed" || fail "Guardrails: clean input should pass (got: $GR_PASS)"
} || true

# PII input — should flag violation
GR_PII='{"text":"My SSN is 123-45-6789 and my email is test@example.com","session_id":"test","agent_id":"crm-orchestrator"}'
GR_PII_RESP=$(post "$GUARDRAILS_URL/guardrails/validate/input" "$GR_PII" "guardrails PII input") && {
  VIOLATIONS=$(echo "$GR_PII_RESP" | jq '.violations | length // 0' 2>/dev/null)
  [[ "$VIOLATIONS" -ge 1 ]] && pass "Guardrails: PII detected ($VIOLATIONS violation(s))" || fail "Guardrails: PII input should produce violations"
} || true

# ─── Final Summary ────────────────────────────────────────────────────────────

section "Summary"
TOTAL=$((PASS + FAIL))
echo -e "Tests run: $TOTAL   ${GREEN}Passed: $PASS${NC}   ${RED}Failed: $FAIL${NC}"

if [[ $FAIL -eq 0 ]]; then
  echo -e "\n${GREEN}✓ All foundation checks passed!${NC}"
  exit 0
else
  echo -e "\n${RED}✗ $FAIL check(s) failed. Review output above.${NC}"
  exit 1
fi
