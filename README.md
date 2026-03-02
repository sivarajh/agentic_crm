# Agentic AI CRM Platform — Foundation

A polyrepo agentic AI CRM foundation built with Spring Boot, Python ADK, and React.
This phase establishes all platform infrastructure with no CRM domain entities yet.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  crm-ui  (React 18 + A2UI)                                          │
│  ┌────────────────────────────────────────────┐                     │
│  │ ChatWindow → A2UIRenderer (safe catalog)   │                     │
│  │ useA2UIStream (SSE) → Zustand store        │                     │
│  └──────────────┬─────────────────────────────┘                     │
└─────────────────┼───────────────────────────────────────────────────┘
                  │ REST + SSE (/api/v1/*)
┌─────────────────▼───────────────────────────────────────────────────┐
│  crm-backend  (Spring Boot 3.3 / Java 21)                           │
│  Sessions │ Conversations │ Memory │ Context Fabric │ Compliance    │
│  Agent Gateway → A2A → Orchestrator                                 │
│  SSE Streaming (SseEmitter per session)                             │
└──────┬──────────────────────────────────────────────────────────────┘
       │ A2A protocol (HTTP + SSE)
┌──────▼──────────────────────────────────────────────────────────────┐
│  crm-agents  (Python + Google ADK)                                  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ crm-orchestrator (8001)                                      │   │
│  │ routes → sequential / parallel / loop execution modes       │   │
│  └──────┬──────────────┬─────────────────────┐                 │   │
│         ▼              ▼                     ▼                 │   │
│  memory-agent(8002) context-agent(8003) guardrails(8004)       │   │
│  (4 memory types)  (context fabric)    (PII/injection/output)  │   │
└─────────────────────────────────────────────────────────────────────┘
       │                    │                  │
       ▼                    ▼                  ▼
  PostgreSQL 16         Redis 7           Qdrant 1.9
  (sessions,          (working mem,      (semantic +
   conversations,      session cache)     episodic
   episodic,                              embeddings)
   procedural,
   compliance)
       │
OTEL Collector → Jaeger + Prometheus + Grafana + Loki
```

## Repos

| Repo | Language | Port | Description |
|------|----------|------|-------------|
| `crm-backend` | Java 21 / Spring Boot | 8080 | REST APIs, memory, context, compliance |
| `crm-agents` | Python 3.12 / ADK | 8001–8004 | Orchestrator + sub-agents + guardrails |
| `crm-ui` | TypeScript / React 18 | 3000 | Chat UI with A2UI rendering |

## Infrastructure Services

| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL 16 | 5432 | Relational persistence (sessions, conversations, memory, compliance) |
| Redis 7 | 6379 | Working memory, session cache, task registry, distributed locks |
| Qdrant 1.9 | 6333 | Vector embeddings for semantic + episodic memory |
| OTEL Collector | 4317/4318 | Telemetry pipeline |
| Jaeger | 16686 | Distributed tracing UI |
| Prometheus | 9090 | Metrics |
| Grafana | 3000 | Dashboards (Prometheus + Jaeger + Loki) |
| Loki | 3100 | Log aggregation |

## Quick Start

### 1. Start shared infrastructure

```bash
cd crm-infra
docker compose up -d
# All services have health checks — wait until all are healthy
docker compose ps
```

### 2. Initialize Qdrant collections

```bash
cd crm-infra
chmod +x init-qdrant.sh && ./init-qdrant.sh
```

### 3. Start backend

```bash
cd crm-backend
docker compose up --build -d
# Or: mvn spring-boot:run
```

### 4. Start agents

```bash
cd crm-agents
docker compose up --build -d
```

### 5. Start UI

```bash
cd crm-ui
docker compose up --build -d
# Or: npm install && npm run dev
```

### 6. Verify

```bash
chmod +x verify-foundation.sh
./verify-foundation.sh
```

## Kubernetes Deployment

```bash
# Namespaces
kubectl apply -f infrastructure/k8s/namespaces.yaml

# Infrastructure (postgres, redis, qdrant)
kubectl apply -f infrastructure/k8s/infra/

# Observability stack
kubectl apply -f infrastructure/k8s/observability/

# Backend
kubectl apply -f crm-backend/k8s/

# Agents
kubectl apply -f crm-agents/k8s/serviceaccount.yaml
kubectl apply -f crm-agents/k8s/orchestrator/
kubectl apply -f crm-agents/k8s/memory-agent/
kubectl apply -f crm-agents/k8s/context-agent/
kubectl apply -f crm-agents/k8s/guardrails/

# UI
kubectl apply -f crm-ui/k8s/
```

## Key Design Decisions

### Memory System (4 types)

| Type | Storage | TTL | Purpose |
|------|---------|-----|---------|
| Working | Redis | Session TTL (30min) | In-flight task state, reasoning chain |
| Semantic | Qdrant (768-dim) + PG index | Explicit | Similarity search over domain knowledge |
| Episodic | PostgreSQL (append-only) + Qdrant | Permanent | Timestamped event history per entity |
| Procedural | PostgreSQL (JSONB steps) | Permanent | Reusable agent workflow definitions |

### Immutability

`conversation_messages` and `audit_events` have PostgreSQL triggers that
raise an exception on any `UPDATE` or `DELETE` — enforced at the DB level.

### A2UI Security

`A2UIRenderer` uses a `switch` over an approved component type catalog.
Unknown types return `null`. There is no fallback `eval` or dynamic rendering.

### Context Fabric

`ContextFabricService` aggregates session state + working memory snapshot
+ recent episodic entries + active procedures into a single `AgentContext`
object, cached in Redis with a 5-minute TTL.

### Guardrails (layered)

Input: PII detection (Presidio), prompt injection (regex patterns), toxicity,
credential patterns → blocks or flags for review before agent processes input.

Output: PII redaction, Pydantic schema validation, hallucination flagging.

Violations emit compliance audit events automatically.

## CI/CD

Each repo has a GitHub Actions workflow at `.github/workflows/ci.yml`:

- **crm-backend**: `mvn test` (with Testcontainers) → Docker build + push to GHCR
- **crm-agents**: `pytest` → Docker build for each agent image
- **crm-ui**: TypeScript type-check + `npm run build` → Docker build
