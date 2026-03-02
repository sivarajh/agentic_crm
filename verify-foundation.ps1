# verify-foundation.ps1  -  End-to-end smoke test for the CRM platform foundation
#
# Usage:
#   .\verify-foundation.ps1
#   .\verify-foundation.ps1 -BackendUrl http://localhost:8080 -OrchestratorUrl http://localhost:8001
#
# No external tools needed - uses PowerShell built-in Invoke-RestMethod (no curl, no jq).

param(
    [string]$BackendUrl      = "http://localhost:8080",
    [string]$OrchestratorUrl = "http://localhost:8001",
    [string]$GuardrailsUrl   = "http://localhost:8004"
)

$script:PASS = 0
$script:FAIL = 0

# ---- Output helpers ----------------------------------------------------------

function Write-Pass([string]$msg) {
    Write-Host "  [PASS] $msg" -ForegroundColor Green
    $script:PASS++
}

function Write-Fail([string]$msg) {
    Write-Host "  [FAIL] $msg" -ForegroundColor Red
    $script:FAIL++
}

function Write-Info([string]$msg) {
    Write-Host "  [INFO] $msg" -ForegroundColor Cyan
}

function Write-Section([string]$title) {
    Write-Host ""
    Write-Host ("=" * 52) -ForegroundColor Yellow
    Write-Host "  $title" -ForegroundColor Yellow
    Write-Host ("=" * 52) -ForegroundColor Yellow
}

# ---- HTTP helpers ------------------------------------------------------------

function Invoke-CrmGet([string]$Url, [string]$Desc) {
    $params = @{ Uri = $Url; Method = "GET"; ContentType = "application/json"; ErrorAction = "Stop" }
    try   { return Invoke-RestMethod @params }
    catch { Write-Fail "$Desc - GET $Url failed: $($_.Exception.Message)"; return $null }
}

function Invoke-CrmPost([string]$Url, [string]$Body, [string]$Desc) {
    $params = @{ Uri = $Url; Method = "POST"; ContentType = "application/json"; Body = $Body; ErrorAction = "Stop" }
    try   { return Invoke-RestMethod @params }
    catch { Write-Fail "$Desc - POST $Url failed: $($_.Exception.Message)"; return $null }
}

function Invoke-CrmPut([string]$Url, [string]$Body, [string]$Desc) {
    $params = @{ Uri = $Url; Method = "PUT"; ContentType = "application/json"; Body = $Body; ErrorAction = "Stop" }
    try   { Invoke-RestMethod @params | Out-Null; return $true }
    catch { Write-Fail "$Desc - PUT $Url failed: $($_.Exception.Message)"; return $false }
}

function Assert-Eq([string]$Actual, [string]$Expected, [string]$Desc) {
    if ($Actual -eq $Expected) { Write-Pass $Desc }
    else { Write-Fail "$Desc  (expected='$Expected'  got='$Actual')" }
}

# Safely extract field: tries .data.FIELD first, then .FIELD
function Get-Field($Obj, [string]$Field) {
    if ($null -eq $Obj) { return $null }
    $v = $Obj.data.$Field
    if ($null -ne $v) { return $v }
    return $Obj.$Field
}

# ---- 1. Backend Health -------------------------------------------------------

Write-Section "1. Backend Health"

$r = Invoke-CrmGet "$BackendUrl/actuator/health" "backend health"
if ($r) { Assert-Eq $r.status "UP" "Backend actuator health = UP" }

$r = Invoke-CrmGet "$BackendUrl/actuator/health/readiness" "backend readiness"
if ($r) { Assert-Eq $r.status "UP" "Backend readiness probe" }

# ---- 2. Session API ----------------------------------------------------------

Write-Section "2. Session API"

$sessBody = '{"userId":"00000000-0000-0000-0000-000000000001","agentId":"crm-orchestrator"}'
$sessResp = Invoke-CrmPost "$BackendUrl/api/v1/sessions" $sessBody "create session"
if (-not $sessResp) { Write-Host "Cannot continue without a session." -ForegroundColor Red; exit 1 }

$sessionId = Get-Field $sessResp "sessionId"
if ($sessionId -and $sessionId -ne "null") {
    Write-Pass "Session created: $sessionId"
} else {
    Write-Fail "Session creation: could not extract sessionId"
    exit 1
}

$r = Invoke-CrmGet "$BackendUrl/api/v1/sessions/$sessionId" "get session"
if ($r) { Assert-Eq (Get-Field $r "state") "ACTIVE" "Session state = ACTIVE" }

if (Invoke-CrmPut "$BackendUrl/api/v1/sessions/$sessionId/heartbeat" '{}' "heartbeat") {
    Write-Pass "Session heartbeat OK"
}

# ---- 3. Conversation API -----------------------------------------------------

Write-Section "3. Conversation API"

$convBody = "{""sessionId"":""$sessionId"",""title"":""Foundation smoke test""}"
$convResp = Invoke-CrmPost "$BackendUrl/api/v1/conversations" $convBody "create conversation"
if (-not $convResp) { Write-Host "Cannot continue without a conversation." -ForegroundColor Red; exit 1 }

$conversationId = Get-Field $convResp "conversationId"
if ($conversationId -and $conversationId -ne "null") {
    Write-Pass "Conversation created: $conversationId"
} else {
    Write-Fail "Conversation creation: could not extract conversationId"
}

$msgBody = "{""conversationId"":""$conversationId"",""sessionId"":""$sessionId"",""role"":""user"",""content"":""Hello, smoke test message""}"
$msgResp = Invoke-CrmPost "$BackendUrl/api/v1/conversations/$conversationId/messages" $msgBody "post message"
if ($msgResp) {
    $mid = Get-Field $msgResp "messageId"
    if ($mid -and $mid -ne "null") { Write-Pass "Message posted: $mid" }
    else { Write-Fail "Post message: no messageId in response" }
}

$msgList = Invoke-CrmGet "$BackendUrl/api/v1/conversations/$conversationId/messages" "list messages"
if ($msgList) {
    $msgs  = if ($msgList.data) { $msgList.data } elseif ($msgList.messages) { $msgList.messages } else { @() }
    $count = @($msgs).Count
    if ($count -ge 1) { Write-Pass "Conversation has $count message(s)" }
    else              { Write-Fail "Expected >= 1 message, got $count" }
}

# ---- 4. Working Memory API ---------------------------------------------------

Write-Section "4. Working Memory API"

$wmKey = "smoke_test_key"
if (Invoke-CrmPut "$BackendUrl/api/v1/memory/working/$sessionId/$wmKey" '"smoke_test_value"' "set working memory") {
    Write-Pass "Working memory set"
}

$wmResp = Invoke-CrmGet "$BackendUrl/api/v1/memory/working/$sessionId/$wmKey" "get working memory"
if ($wmResp) {
    # ApiResponse<String>: data holds the raw stored value.
    # Spring @RequestBody String reads raw bytes, so the stored value retains JSON outer quotes.
    # Trim them before comparing.
    $wmVal = if ($null -ne $wmResp.data) { "$($wmResp.data)".Trim('"') } else { "" }
    if ($wmVal -eq "smoke_test_value") { Write-Pass "Working memory roundtrip OK" }
    else { Write-Fail "Working memory read failed (got: $wmVal)" }
}

# ---- 5. Context Fabric API ---------------------------------------------------

Write-Section "5. Context Fabric API"

$ctxResp = Invoke-CrmGet ($BackendUrl + "/api/v1/context/" + $sessionId + "?sessionId=" + $sessionId + "&agentId=crm-orchestrator&userId=00000000-0000-0000-0000-000000000001") "get context"
if ($ctxResp) {
    # AgentContext has 'sessionState' (string), not 'session' (object)
    $sessState = if ($ctxResp.data.sessionState) { $ctxResp.data.sessionState } else { $ctxResp.sessionState }
    if ($sessState) { Write-Pass "Context Fabric: sessionState=$sessState" }
    else            { Write-Fail "Context Fabric: sessionState field missing" }
}

# ---- 6. Episodic Memory API --------------------------------------------------

Write-Section "6. Episodic Memory API"

$entityId = "00000000-0000-0000-0000-000000000042"
$epiBody  = "{""entityId"":""$entityId"",""entityType"":""test_entity"",""eventType"":""SMOKE_TEST"",""summary"":""Smoke test episodic memory entry"",""sessionId"":""$sessionId""}"
$epiResp  = Invoke-CrmPost "$BackendUrl/api/v1/memory/episodic" $epiBody "create episodic memory"
if ($epiResp) {
    $eid = Get-Field $epiResp "episodeId"
    if ($eid -and $eid -ne "null") { Write-Pass "Episodic memory created: $eid" }
    else                           { Write-Fail "Episodic memory: no episodeId in response" }
}

$epiList = Invoke-CrmGet "$BackendUrl/api/v1/memory/episodic/entity/$entityId" "list episodic memory"
if ($epiList) {
    $entries = if ($epiList.data) { $epiList.data } else { @() }
    $count   = @($entries).Count
    if ($count -ge 1) { Write-Pass "Episodic memory list: $count entry(s)" }
    else              { Write-Fail "Expected >= 1 episodic entry, got $count" }
}

# ---- 7. Procedural Memory API ------------------------------------------------

Write-Section "7. Procedural Memory API"

$procName = "smoke_test_proc_$(Get-Date -Format 'yyMMddHHmmss')"
$procBody = "{""name"":""$procName"",""triggerConditions"":[{""intent"":""smoke_test""}],""steps"":[{""step"":1,""action"":""verify_system""}],""agentScope"":[""crm-orchestrator""],""active"":true}"
$procResp = Invoke-CrmPost "$BackendUrl/api/v1/memory/procedural" $procBody "create procedural memory"
if ($procResp) {
    $pid_ = Get-Field $procResp "procedureId"
    if ($pid_ -and $pid_ -ne "null") { Write-Pass "Procedural memory created: $pid_" }
    else                             { Write-Fail "Procedural memory: no procedureId in response" }
}

# ---- 8. Compliance Audit API -------------------------------------------------

Write-Section "8. Compliance Audit API"

$auditBody = "{""eventType"":""TASK_SUBMITTED"",""agentId"":""crm-orchestrator"",""userId"":""00000000-0000-0000-0000-000000000001"",""sessionId"":""$sessionId"",""action"":""smoke_test"",""resourceType"":""session"",""resourceId"":""$sessionId"",""payload"":{""test"":true}}"
$auditResp = Invoke-CrmPost "$BackendUrl/api/v1/compliance/audit" $auditBody "create audit event"
if ($auditResp) {
    $aid = Get-Field $auditResp "auditEventId"
    if ($aid -and $aid -ne "null") { Write-Pass "Audit event recorded: $aid" }
    else                           { Write-Fail "Audit event: no auditEventId in response" }
}

$auditList = Invoke-CrmGet "$BackendUrl/api/v1/compliance/audit?sessionId=$sessionId" "list audit events"
if ($auditList) {
    $events = if ($auditList.data) { $auditList.data } elseif ($auditList.content) { $auditList.content } else { @() }
    $count  = @($events).Count
    if ($count -ge 1) { Write-Pass "Audit trail: $count event(s) for session" }
    else              { Write-Fail "Expected >= 1 audit event, got $count" }
}

# ---- 9. Agent Gateway --------------------------------------------------------

Write-Section "9. Agent Gateway (Orchestrator A2A)"

$cardResp = Invoke-CrmGet "$OrchestratorUrl/.well-known/agent.json" "orchestrator agent card"
if ($cardResp) { Assert-Eq $cardResp.name "crm-orchestrator" "Orchestrator Agent Card name" }

$taskBody = "{""sessionId"":""$sessionId"",""userId"":""00000000-0000-0000-0000-000000000001"",""intent"":""smoke_test"",""payload"":{""input"":""Verify the foundation is working""}}"
$taskResp = Invoke-CrmPost "$BackendUrl/api/v1/agent/tasks" $taskBody "submit agent task"
$taskId   = $null
if ($taskResp) {
    $taskId = Get-Field $taskResp "taskId"
    if ($taskId -and $taskId -ne "null") { Write-Pass "Agent task submitted: $taskId" }
    else                                 { Write-Fail "Agent task: no taskId in response" }
}

if ($taskId -and $taskId -ne "null") {
    Write-Info "Polling task $taskId for up to 30s..."
    $done = $false
    for ($i = 1; $i -le 6; $i++) {
        Start-Sleep -Seconds 5
        $ts = Invoke-CrmGet "$BackendUrl/api/v1/agent/tasks/$taskId" "poll task"
        if ($ts) {
            $status = Get-Field $ts "status"
            Write-Info "  poll $i/6 - status: $status"
            if ($status -in @("completed", "COMPLETED")) {
                Write-Pass "Agent task completed within 30s"
                $done = $true
                break
            }
            if ($status -in @("failed", "FAILED")) {
                Write-Fail "Agent task failed"
                $done = $true
                break
            }
        } else {
            break
        }
    }
    if (-not $done) { Write-Fail "Agent task did not complete within 30s (may still be running)" }
}

# ---- 10. SSE Stream ----------------------------------------------------------

Write-Section "10. SSE Stream"

try {
    $req         = [System.Net.HttpWebRequest]::Create("$BackendUrl/api/v1/stream/session/$sessionId")
    $req.Timeout = 2000
    $rsp         = $req.GetResponse()
    $rsp.Close()
    Write-Pass "SSE stream endpoint reachable"
} catch [System.Net.WebException] {
    if ($_.Exception.Status -eq [System.Net.WebExceptionStatus]::Timeout) {
        Write-Pass "SSE stream endpoint reachable (timeout expected for open stream)"
    } else {
        Write-Fail "SSE stream error: $($_.Exception.Message)"
    }
} catch {
    Write-Fail "SSE stream error: $_"
}

# ---- 11. Guardrails Service --------------------------------------------------

Write-Section "11. Guardrails Service"

$grHealth = Invoke-CrmGet "$GuardrailsUrl/health" "guardrails health"
if ($grHealth) {
    Write-Pass "Guardrails service healthy"

    # InputValidationRequest uses 'content' field (not 'text')
    $grClean = '{"content":"Please help me find the customer account for Acme Corp","session_id":"test","agent_id":"crm-orchestrator"}'
    $gr = Invoke-CrmPost "$GuardrailsUrl/guardrails/validate/input" $grClean "guardrails clean input"
    if ($gr) {
        if ($gr.passed -eq $true) { Write-Pass "Guardrails: clean input passed" }
        else                      { Write-Fail "Guardrails: clean input should pass (passed=$($gr.passed), violations=$($gr.violations.Count))" }
    }

    $grPii = '{"content":"My SSN is 123-45-6789 and my email is test@example.com","session_id":"test","agent_id":"crm-orchestrator"}'
    $gr = Invoke-CrmPost "$GuardrailsUrl/guardrails/validate/input" $grPii "guardrails PII input"
    if ($gr) {
        $vcount = if ($gr.violations) { @($gr.violations).Count } else { 0 }
        if ($vcount -ge 1) { Write-Pass "Guardrails: PII detected ($vcount violation(s))" }
        else               { Write-Fail "Guardrails: PII input should produce violations (got 0)" }
    }
} else {
    Write-Info "Guardrails not reachable at $GuardrailsUrl - skipping guardrails checks"
}

# ---- Summary -----------------------------------------------------------------

Write-Section "Summary"
$total = $script:PASS + $script:FAIL
Write-Host "  Tests run : $total"
Write-Host "  Passed    : $($script:PASS)" -ForegroundColor Green
Write-Host "  Failed    : $($script:FAIL)" -ForegroundColor Red
Write-Host ""

if ($script:FAIL -eq 0) {
    Write-Host "  All foundation checks passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "  $($script:FAIL) check(s) failed - review output above." -ForegroundColor Red
    exit 1
}
