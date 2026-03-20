# System Architecture

> Agentic AI CRM Platform — Component reference and internal diagrams.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Frontend — crm-ui](#2-frontend--crm-ui)
3. [Backend — crm-backend](#3-backend--crm-backend)
4. [Orchestrator — Internal Flow](#4-orchestrator--internal-flow)
5. [Agent Network](#5-agent-network)
6. [Memory System](#6-memory-system)
7. [Streaming Pipeline](#7-streaming-pipeline)
8. [Database Schema](#8-database-schema)
9. [Infrastructure & Observability](#9-infrastructure--observability)
10. [Request Lifecycle — End to End](#10-request-lifecycle--end-to-end)

---

## 1. System Overview

All major services and their primary communication paths.

```mermaid
graph TB
    subgraph UI["crm-ui  (React 18 · port 3090)"]
        ChatWindow
        A2UIRenderer
        ZustandStores["Zustand Stores"]
        SSEClient["useA2UIStream\n(SSE listener)"]
    end

    subgraph Backend["crm-backend  (Spring Boot 3 · port 8080)"]
        AgentGW["Agent Gateway"]
        ConvSvc["Conversation Service"]
        SessionSvc["Session Service"]
        MemSvc["Memory Services"]
        CtxSvc["Context Fabric Service"]
        StreamSvc["SSE Streaming Service"]
        ComplianceSvc["Compliance Service"]
    end

    subgraph Agents["crm-agents  (Python 3.12 · FastAPI)"]
        Orch["Orchestrator :8001"]
        MemAgent["Memory Agent :8002"]
        CtxAgent["Context Agent :8003"]
        Guards["Guardrails :8004"]
        WebSearch["Web Search Agent :8005"]
        NewsResearch["News Research Agent :8006"]
    end

    subgraph Storage["Storage Layer"]
        PG[("PostgreSQL 16")]
        Redis[("Redis 7")]
        Qdrant[("Qdrant Vector DB")]
    end

    subgraph External["External APIs"]
        Gemini["Google Vertex AI\nGemini 2.x-flash"]
        Perplexity["Perplexity API\nsonar-pro"]
        GoogleCSE["Google Custom Search"]
        DDG["DuckDuckGo"]
    end

    ChatWindow -->|"REST POST /agent/tasks"| AgentGW
    SSEClient -->|"SSE GET /stream/session/{id}"| StreamSvc
    AgentGW -->|"A2A POST /a2a/tasks/send"| Orch
    Orch -->|"PATCH /agent/tasks/{id}/status"| AgentGW
    Orch -->|"POST /agent/tasks/{id}/events"| StreamSvc
    StreamSvc -->|"SSE push"| SSEClient
    Orch --> Guards
    Orch --> MemAgent
    Orch --> CtxAgent
    Orch --> WebSearch
    Orch --> NewsResearch
    Orch --> Gemini
    MemAgent --> Redis
    MemAgent --> Qdrant
    MemAgent --> PG
    CtxAgent --> Redis
    CtxAgent --> PG
    WebSearch --> GoogleCSE
    WebSearch --> DDG
    NewsResearch --> Perplexity
    ConvSvc --> PG
    SessionSvc --> Redis
    MemSvc --> PG
    MemSvc --> Qdrant
    ComplianceSvc --> PG
```

---

## 2. Frontend — crm-ui

Internal component tree, store wiring, and API calls.

```mermaid
graph TB
    subgraph Entry["Entry Point"]
        Main["main.tsx  (Vite)"]
        Router["React Router 7\nApp.tsx"]
    end

    subgraph Layout["Layout"]
        AppShell["AppShell.tsx"]
        SessionPanel["SessionPanel.tsx"]
        Sidebar["Sidebar.tsx"]
    end

    subgraph Chat["Chat Components"]
        ChatWindow["ChatWindow.tsx\norchestrates the chat view"]
        MessageList["MessageList.tsx"]
        MessageBubble["MessageBubble.tsx"]
        MessageInput["MessageInput.tsx"]
        FollowUpChips["FollowUpChips.tsx"]
        SourcesDrawer["SourcesDrawer.tsx"]
    end

    subgraph A2UI["A2UI Rendering Engine"]
        A2UIRenderer["A2UIRenderer.tsx\ncomponent whitelist dispatch"]
        CompText["text"]
        CompMD["markdown\n(react-markdown + remark-gfm)"]
        CompCard["card"]
        CompSection["section"]
        CompStatGrid["stat_grid"]
        CompKV["kv_table"]
        CompContact["contact_chip"]
        CompProgress["progress"]
        CompBadge["badge"]
        CompNull["unknown → null (safe skip)"]
    end

    subgraph Stores["Zustand Stores  (store/index.ts)"]
        SessionStore["SessionStore\nsessionId · userId"]
        ConvStore["ConversationStore\nconversations · active messages"]
        AgentStore["AgentStore\nagentStatus · streamingContent"]
        ProjectStore["ProjectStore  (new)"]
        ThemeStore["ThemeStore\ndark / light"]
    end

    subgraph Hooks["Custom Hooks"]
        useA2UIStream["useA2UIStream\nopens EventSource\ndrives AgentStore"]
        useConversation["useConversation"]
    end

    subgraph APIClients["API Clients  (api/)"]
        agentApi["agentApi.ts\nPOST /agent/tasks"]
        convApi["conversationApi.ts\nGET · POST /conversations"]
        sessionApi["sessionApi.ts\nPOST /sessions"]
        projectApi["projectApi.ts  (new)"]
    end

    Main --> Router --> AppShell
    AppShell --> SessionPanel & ChatWindow & Sidebar
    ChatWindow --> MessageList & MessageInput & FollowUpChips & SourcesDrawer
    MessageList --> MessageBubble --> A2UIRenderer
    A2UIRenderer --> CompText & CompMD & CompCard & CompSection & CompStatGrid & CompKV & CompContact & CompProgress & CompBadge & CompNull
    ChatWindow --> useA2UIStream
    useA2UIStream -->|"SSE events update"| AgentStore
    AgentStore -->|"re-render trigger"| ChatWindow
    MessageInput -->|"submit"| agentApi
    ChatWindow --> convApi
    AppShell --> sessionApi
    SessionPanel --> projectApi
```

---

## 3. Backend — crm-backend

Package breakdown, service layer, and storage mapping.

```mermaid
graph TB
    subgraph Controllers["REST Controllers  (port 8080 · /api/v1/*)"]
        AGC["AgentGatewayController\nPOST /agent/tasks\nPATCH /agent/tasks/{id}/status\nPOST /agent/tasks/{id}/events"]
        CC["ConversationController\nGET | POST /conversations\nPOST /conversations/{id}/messages"]
        SC["SessionController\nPOST /sessions\nGET /sessions/{id}\nPATCH /sessions/{id}/heartbeat"]
        SseC["SseController\nGET /stream/session/{id}"]
        MC["MemoryController\nGET /memory/semantic/search\nPOST /memory/episodic"]
        CtxC["ContextController\nGET /context/{contextId}"]
        CompC["ComplianceController\nPOST /compliance/audit\nGET /compliance/review"]
    end

    subgraph Services["Service Layer"]
        AGS["AgentGatewayService\nRedis task store\nWebClient → orchestrator"]
        ConvSvc["ConversationService\nJPA persistence\nappend-only enforcement"]
        SessSvc["SessionService\nRedis TTL 30 min\nscheduled expiry job"]
        SSEService["StreamingEventService\nConcurrentHashMap\nsessionId → SseEmitter"]
        WMS["WorkingMemoryService\nRedis hash per session"]
        SMS["SemanticMemoryService\nQdrant + PG index"]
        EMS["EpisodicMemoryService\nPostgreSQL + Qdrant"]
        PMS["ProceduralMemoryService\nPostgreSQL JSONB"]
        CtxSvc["ContextFabricService\naggregates all memory types\nRedis cache TTL 5 min"]
        CompSvc["ComplianceService\nimmutable audit trail"]
    end

    subgraph Persistence["Persistence"]
        PG[("PostgreSQL 16\nsessions · conversations\nconversation_messages\nepisodic_memory\nprocedural_memory\nsemantic_memory_index\naudit_events · review_queue")]
        Redis[("Redis 7\nsession:{id}\ntask:{id}\nwm:{id}:*\nctx:cache:{id}")]
        QdrantClient["Qdrant Client\ncrm_semantic\ncrm_episodic_embeddings"]
    end

    subgraph Outbound["Outbound HTTP  (WebClient)"]
        OrchestratorCall["→ Orchestrator :8001\nA2A POST /a2a/tasks/send"]
    end

    AGC --> AGS --> Redis
    AGS --> OrchestratorCall
    AGS --> SSEService
    CC --> ConvSvc --> PG
    SC --> SessSvc --> Redis
    SseC --> SSEService
    MC --> SMS --> QdrantClient
    MC --> EMS --> PG
    MC --> WMS --> Redis
    MC --> PMS --> PG
    CtxC --> CtxSvc --> Redis
    CtxSvc --> WMS & EMS & PMS
    CompC --> CompSvc --> PG
```

### Session State Machine

```mermaid
stateDiagram-v2
    [*] --> ACTIVE : POST /sessions
    ACTIVE --> IDLE : No activity for 15 min
    IDLE --> ACTIVE : Heartbeat received
    IDLE --> EXPIRED : TTL elapsed (30 min)
    ACTIVE --> TERMINATED : POST /sessions/{id}/terminate
    EXPIRED --> [*]
    TERMINATED --> [*]
```

---

## 4. Orchestrator — Internal Flow

`crm-agents/orchestrator/agent.py` — 10-step pipeline executed for every A2A task.

```mermaid
flowchart TD
    Recv["Receive A2A Task\nPOST /a2a/tasks/send"]

    subgraph S1["① Intent Extraction"]
        IntentExtract["Extract intent keywords\nfrom user message text"]
    end

    subgraph S2["② Input Guardrails  (fail-open)"]
        PII_In["PII detection  (Presidio)"]
        InjectionCheck["Prompt injection  (regex)"]
        CredCheck["Credential pattern detection"]
        ToxicCheck["Toxicity check  (optional)"]
    end

    subgraph S3["③ Parallel Context Fetch"]
        direction LR
        FetchCtx["Context Fabric\nGET /context/{id}"]
        FetchMem["Memory Agent\nsemantic_search"]
        FetchHist["Conversation history\nGET /conversations/{id}/messages"]
        WebGate{"Needs\nweb / research?"}
        WebAgent["Web Search Agent :8005"]
        NewsAgent["News Research Agent :8006"]
        WebGate -->|yes| WebAgent & NewsAgent
    end

    subgraph S4["④ LLM Generation  (Gemini 2.x-flash)"]
        StreamPath["generate_stream()\nstreaming response"]
        StructPath["generate()\nstructured response"]
        StreamChunks["POST /agent/tasks/{id}/events\nfor each chunk"]
        StreamPath --> StreamChunks
    end

    subgraph S5["⑤ A2UI Normalisation"]
        EnsureA2UI["_ensure_a2ui()\nnormalise output →\n{type, components[]}"]
    end

    subgraph S6["⑥ Follow-Up Generation"]
        FollowUps["generate_follow_ups()\n3 clickable suggestion chips\nvia secondary Gemini call"]
    end

    subgraph S7["⑦ Output Guardrails"]
        PII_Out["PII redaction  (Presidio anonymizer)"]
        SchemaVal["Pydantic schema validation"]
        HallucinationFlag["Hallucination flagging  (optional)"]
    end

    subgraph S8["⑧ Persist Agent Turn"]
        PersistMsg["POST /conversations/{id}/messages\nrole=agent · trace_id · span_id · token_count"]
    end

    subgraph S9["⑨ Task Completion Callback"]
        PatchStatus["PATCH /agent/tasks/{id}/status\nstatus = COMPLETED"]
    end

    subgraph S10["⑩ Compliance Audit"]
        AuditLog["POST /compliance/audit\naction · resource · severity"]
    end

    Recv --> S1 --> S2 --> S3
    S3 --> S4
    S4 --> S5 --> S6 --> S7 --> S8 --> S9 --> S10
```

### Router — Intent to Agent Mapping

```mermaid
flowchart LR
    Intent["Extracted Intent"]

    Intent -->|"context · session · recall\nbackground · history"| CtxAgent["Context Agent :8003"]
    Intent -->|"search · find · look up · retrieve"| MemSearch["Memory Agent\nsemantic_search"]
    Intent -->|"save · store · remember\nrecord · note · log"| MemWrite["Memory Agent\nmemory_write"]
    Intent -->|"workflow · procedure\nprocess · playbook · step"| MemRead["Memory Agent\nmemory_read"]
    Intent -->|"search the web · google\nstock price · weather · what is"| WebSearch["Web Search Agent :8005"]
    Intent -->|"news · latest · research\ndeep dive · trending · fact-check"| NewsResearch["News Research Agent :8006"]
    Intent -->|"default  (no keyword match)"| Gemini["Gemini — direct generation"]
```

### Task Delegation Modes

```mermaid
flowchart LR
    TaskMgr["TaskManager"]
    TaskMgr -->|"single agent"| delegate["delegate(agent, task)"]
    TaskMgr -->|"independent tasks"| parallel["delegate_parallel([agents, tasks])"]
    TaskMgr -->|"ordered pipeline"| sequential["delegate_sequential([agents, tasks])"]
```

---

## 5. Agent Network

Inter-agent communication via the A2A protocol (Google ADK v0.3).

```mermaid
graph LR
    Backend["crm-backend :8080"]

    subgraph Agents["Agent Layer"]
        Orch["Orchestrator :8001"]
        Mem["Memory Agent :8002\nskills: memory_read · memory_write\nsemantic_search · consolidate"]
        Ctx["Context Agent :8003\nskills: build_context · update_context"]
        GRD["Guardrails :8004\ninput + output validation"]
        Web["Web Search :8005\nskill: web_search"]
        News["News Research :8006\nskill: research"]
    end

    Backend -->|"A2A POST /a2a/tasks/send"| Orch
    Orch -->|"A2A POST /a2a/tasks/send"| Mem & Ctx & Web & News
    Orch -->|"HTTP validate"| GRD
    Orch -->|"PATCH status · POST events"| Backend
    Mem -->|"GET /memory/* · POST /memory/episodic"| Backend
    Ctx -->|"GET /context/{id}"| Backend
    Orch -->|"GET /.well-known/agent.json\n(skill discovery)"| Mem & Ctx & Web & News & GRD
```

### A2A Task State Machine

```mermaid
stateDiagram-v2
    [*] --> QUEUED : Backend stores task in Redis
    QUEUED --> SUBMITTED : Forwarded to Orchestrator
    SUBMITTED --> STREAMING : Orchestrator begins LLM stream
    STREAMING --> COMPLETED : All chunks sent; callback received
    SUBMITTED --> FAILED : Orchestrator throws error
    STREAMING --> FAILED : Stream interrupted
    COMPLETED --> [*]
    FAILED --> [*]
```

---

## 6. Memory System

Four-tier architecture with per-tier storage and access patterns.

```mermaid
graph TB
    subgraph Tiers["Four Memory Tiers"]
        WM["Working Memory\nin-flight reasoning"]
        SM["Semantic Memory\ndomain knowledge vectors"]
        EM["Episodic Memory\ntimestamped event history"]
        PM["Procedural Memory\nworkflows and playbooks"]
    end

    subgraph Storage["Storage"]
        Redis[("Redis 7\nhash per session\nTTL = session lifetime")]
        Qdrant[("Qdrant 1.9.6\n768-dim Cosine\ncrm_semantic\ncrm_episodic_embeddings")]
        PG[("PostgreSQL 16\nsemantic_memory_index\nepisodic_memory\nprocedural_memory")]
    end

    WM -->|"wm:{sessionId}:task_state\nwm:{sessionId}:reasoning"| Redis
    SM -->|"vector upsert / cosine search"| Qdrant
    SM -->|"index metadata\nqdrant_point_id · content_hash"| PG
    EM -->|"event records\noccurred_at timestamptz"| PG
    EM -->|"episode embeddings"| Qdrant
    PM -->|"steps (JSONB)\ntrigger_conditions (JSONB)\nagent_scope (TEXT[])"| PG
```

### Context Fabric Assembly

```mermaid
flowchart LR
    subgraph Sources["Input Sources"]
        Session["Session State\nRedis session:{id}"]
        WM2["Working Memory\nRedis wm:{id}:*"]
        Episodic["Recent Episodes\nPostgreSQL episodic_memory"]
        Procedures["Active Procedures\nPostgreSQL procedural_memory"]
        TaskID["Current Task ID\nRedis task:{id}"]
    end

    CtxSvc["ContextFabricService\naggregates all sources\ninto AgentContext object"]
    Cache{"Redis cache\nctx:cache:{contextId}\nTTL 5 min"}
    AgentCtx["AgentContext\nsent to Orchestrator\nwith every LLM call"]

    Session & WM2 & Episodic & Procedures & TaskID --> CtxSvc
    CtxSvc <--> Cache
    Cache -->|"hit"| AgentCtx
    Cache -->|"miss — rebuild"| CtxSvc
```

### Memory Tier Comparison

| Tier | Storage | Scope | TTL | Access Pattern |
|------|---------|-------|-----|----------------|
| Working | Redis | Session | 30 min | Key-value read/write |
| Semantic | Qdrant + PG | Global | Permanent (optional expiry) | Cosine vector search |
| Episodic | PostgreSQL + Qdrant | Global | Permanent | SQL + vector similarity |
| Procedural | PostgreSQL | Global | Permanent (versioned) | SQL by trigger_conditions |

---

## 7. Streaming Pipeline

How a single agent response is delivered in real-time from Gemini to the browser.

```mermaid
sequenceDiagram
    participant UI as crm-ui
    participant BE as crm-backend
    participant Orch as Orchestrator
    participant Gemini as Gemini API

    UI->>BE: POST /agent/tasks {intent, sessionId}
    BE->>BE: Store task Redis → QUEUED
    BE->>Orch: A2A POST /a2a/tasks/send
    BE-->>UI: SSE: task.submitted

    UI->>BE: GET /stream/session/{sessionId}  (EventSource open)

    Orch->>Orch: Steps ①–③  (guardrails · context fetch)
    Orch->>Gemini: generate_stream()

    loop Each text chunk
        Gemini-->>Orch: chunk
        Orch->>BE: POST /agent/tasks/{id}/events {chunk}
        BE-->>UI: SSE: agent.message {chunk}
        UI->>UI: AgentStore.appendStreamingContent(chunk)
    end

    Orch->>Orch: Steps ⑤–⑧  (A2UI · follow-ups · guardrails · persist)
    Orch->>BE: PATCH /agent/tasks/{id}/status  COMPLETED
    BE-->>UI: SSE: task.completed

    UI->>BE: GET /conversations/{id}/messages
    BE-->>UI: Full message  (A2UI JSON)
    UI->>UI: A2UIRenderer renders components
```

### SSE Emitter Registry

```mermaid
graph LR
    Register["SseController\nGET /stream/session/{id}\nregisters emitter"]
    Registry["StreamingEventService\nConcurrentHashMap\nsessionId → SseEmitter"]
    Publish["AgentGatewayService\npublishes event to\nmatching sessionId emitter"]
    Cleanup["Auto-cleanup\non timeout · error · complete"]

    Register --> Registry
    Publish --> Registry
    Registry -->|"text/event-stream"| Browser["crm-ui  EventSource"]
    Registry --> Cleanup
```

---

## 8. Database Schema

PostgreSQL 16 — entity relationships and immutability constraints.

```mermaid
erDiagram
    sessions {
        UUID session_id PK
        VARCHAR user_id
        VARCHAR agent_id
        VARCHAR state
        UUID active_task_id
        JSONB metadata
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
        TIMESTAMPTZ last_active
    }

    conversations {
        UUID conversation_id PK
        UUID session_id FK
        VARCHAR title
        JSONB metadata
        BOOLEAN deleted
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    conversation_messages {
        UUID message_id PK
        UUID conversation_id FK
        INTEGER turn_id
        VARCHAR role
        TEXT content
        VARCHAR agent_id
        INTEGER token_count
        UUID trace_id
        UUID span_id
        JSONB metadata
        TIMESTAMPTZ created_at
    }

    episodic_memory {
        UUID episode_id PK
        UUID entity_id
        VARCHAR entity_type
        VARCHAR event_type
        TEXT summary
        UUID embedding_ref
        UUID session_id
        VARCHAR agent_id
        TIMESTAMPTZ occurred_at
        TIMESTAMPTZ created_at
    }

    procedural_memory {
        UUID procedure_id PK
        VARCHAR name
        TEXT description
        JSONB trigger_conditions
        JSONB steps
        INTEGER version
        BOOLEAN active
        TEXT[] agent_scope
        VARCHAR created_by
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    semantic_memory_index {
        UUID entry_id PK
        VARCHAR qdrant_point_id UK
        UUID entity_id
        VARCHAR entity_type
        VARCHAR content_hash
        VARCHAR source_agent
        VARCHAR collection_name
        JSONB metadata
        TIMESTAMPTZ created_at
        TIMESTAMPTZ expires_at
    }

    audit_events {
        UUID event_id PK
        VARCHAR event_type
        UUID actor_id
        VARCHAR action
        VARCHAR resource_type
        VARCHAR resource_id
        JSONB details
        VARCHAR severity
        TIMESTAMPTZ created_at
    }

    review_queue {
        UUID review_id PK
        UUID audit_event_id FK
        VARCHAR status
        VARCHAR reviewed_by
        TEXT notes
        TIMESTAMPTZ created_at
        TIMESTAMPTZ resolved_at
    }

    projects {
        UUID project_id PK
        VARCHAR name
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    sessions ||--o{ conversations : "has"
    conversations ||--o{ conversation_messages : "append-only  (trigger)"
    audit_events ||--o| review_queue : "flagged in"
```

### Flyway Migration Timeline

```mermaid
timeline
    title Schema Migrations
    V1 : sessions table
       : update_updated_at trigger
    V2 : conversations
       : conversation_messages
       : append-only trigger (prevent UPDATE/DELETE)
    V3 : episodic_memory
       : procedural_memory
       : semantic_memory_index
    V4 : audit_events
       : review_queue
    V5 : fix procedural agent_scope type
    V6 : fix semantic entity_id column
    V7 : soft-delete flag on conversations
    V8 : projects schema  (in progress)
```

### Redis Key Map

| Key | TTL | Purpose |
|-----|-----|---------|
| `session:{sessionId}` | 30 min | Session cache (userId, agentId, state) |
| `task:{taskId}` | 2 h | A2A task state (intent, status, result) |
| `wm:{sessionId}:task_state` | session | Working memory — reasoning chain |
| `wm:{sessionId}:reasoning` | session | Working memory — LLM steps |
| `ctx:cache:{contextId}` | 5 min | Assembled AgentContext object |
| `lock:task:{taskId}` | 30 s | Distributed lock for task updates |

---

## 9. Infrastructure & Observability

Local dev ports, Docker Compose services, and Kubernetes namespace layout.

```mermaid
graph TB
    subgraph Dev["Local Development"]
        UI_Dev["crm-ui\nnpm run dev  :3090"]
        BE_Dev["crm-backend\nmvn spring-boot:run  :8080"]
        Agents_Dev["crm-agents\nuvicorn  :8001–8006"]
    end

    subgraph Infra["crm-infra  (Docker Compose)"]
        PG_C["PostgreSQL 16  :5432"]
        Redis_C["Redis 7  :6379"]
        Qdrant_C["Qdrant  :6333 REST · :6334 gRPC"]
        OTEL_C["OTel Collector  :4317 gRPC · :4318 HTTP"]
        Jaeger_C["Jaeger  :16686"]
        Prometheus_C["Prometheus  :9090"]
        Grafana_C["Grafana  :3000"]
        Loki_C["Loki  :3100"]
    end

    subgraph K8s["Kubernetes  (infrastructure/)"]
        NS_UI["crm-ui"]
        NS_Platform["crm-platform"]
        NS_Agents["crm-agents"]
        NS_System["crm-system\nPostgreSQL · Redis · Qdrant"]
        NS_Obs["crm-observability"]
        HPA["HPA — crm-backend"]
    end

    UI_Dev --> BE_Dev
    BE_Dev --> PG_C & Redis_C & Qdrant_C
    Agents_Dev --> Redis_C & Qdrant_C
    BE_Dev -->|"OTLP gRPC"| OTEL_C
    Agents_Dev -->|"OTLP gRPC"| OTEL_C
    OTEL_C --> Jaeger_C & Prometheus_C & Loki_C
    Prometheus_C --> Grafana_C
    Loki_C --> Grafana_C
```

### Distributed Trace Propagation

```mermaid
flowchart LR
    UI["crm-ui\n(no tracing)"]
    BE["crm-backend\nMicrometer + OTLP\ntrace_id stored in\nconversation_messages"]
    Orch["Orchestrator\nOTel Python SDK\nspan via A2A metadata"]
    SubAgents["Sub-Agents\nOTel Python SDK"]
    Collector["OTel Collector"]
    Jaeger["Jaeger  :16686"]

    UI -->|"HTTP request"| BE
    BE -->|"W3C traceparent header"| Orch
    Orch -->|"W3C traceparent header"| SubAgents
    BE & Orch & SubAgents -->|"OTLP gRPC"| Collector
    Collector --> Jaeger
```

---

## 10. Request Lifecycle — End to End

Full trace of one user message from keypress to rendered A2UI response.

```mermaid
flowchart TD
    U1["User types message\nMessageInput.tsx"]
    U2["Submit\nagentApi.submitTask()\nPOST /api/v1/agent/tasks"]

    subgraph BEGateway["Backend — Agent Gateway"]
        B1["AgentGatewayController"]
        B2["AgentGatewayService\nstores task Redis  QUEUED"]
        B3["WebClient\nA2A POST /a2a/tasks/send\n→ Orchestrator"]
        B4["SSE publish\ntask.submitted"]
    end

    subgraph OrcPipeline["Orchestrator  (10 steps)"]
        O1["① Extract intent"]
        O2["② Input guardrails\nPresidio · regex · credential scan"]
        O3["③ Parallel fetch\ncontext + memory + history\n± web / research agents"]
        O4["④ Gemini generate_stream()\nstream chunks → POST /events"]
        O5["⑤ _ensure_a2ui()\nnormalise to A2UI JSON"]
        O6["⑥ generate_follow_ups()\n3 chips"]
        O7["⑦ Output guardrails\nPII redaction · schema validation"]
        O8["⑧ POST /conversations/{id}/messages\npersist agent turn"]
        O9["⑨ PATCH /agent/tasks/{id}/status  COMPLETED"]
        O10["⑩ POST /compliance/audit"]
    end

    subgraph UIUpdate["UI — Real-time Rendering"]
        UI1["SSE: agent.message\nuseA2UIStream receives chunk"]
        UI2["AgentStore\nappendStreamingContent(chunk)"]
        UI3["ChatWindow re-renders\npartial response visible"]
        UI4["SSE: task.completed\nfetch full message"]
        UI5["A2UIRenderer\nrenders A2UI component tree"]
        UI6["FollowUpChips appear"]
    end

    U1 --> U2 --> B1 --> B2 --> B3 --> B4
    B4 -->|"SSE"| UI1
    B3 --> O1 --> O2 --> O3 --> O4
    O4 -->|"SSE agent.message per chunk"| UI1
    O4 --> O5 --> O6 --> O7 --> O8 --> O9 --> O10
    O9 -->|"SSE task.completed"| UI4
    UI1 --> UI2 --> UI3
    UI4 --> UI5 --> UI6
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Append-only `conversation_messages` | Tamper-proof history; enforced at DB level via trigger, not application code |
| Fail-open input guardrails | Validation failures never block the user; violations logged for human review |
| Four-tier memory | Each tier has different retrieval semantics — fast session state (Redis), semantic similarity (Qdrant), event timeline (PG), procedural workflows (PG JSONB) |
| Context Fabric with 5-min Redis cache | Avoids re-aggregating all memory sources on every LLM call |
| A2A protocol (Google ADK v0.3) | Standard agent-to-agent contract; task state machine decoupled from HTTP lifetime |
| SSE over WebSocket | Simpler unidirectional push; Spring `SseEmitter` sufficient; no upgrade handshake needed |
| A2UI component whitelist | Agent-generated UI cannot inject unknown components; unknown types silently render null |
| Per-session SSE emitter registry | Events scoped to exactly the requesting user's session; no broadcast leakage |
