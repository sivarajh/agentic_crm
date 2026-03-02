# crm-agents

Python agent infrastructure for the Agentic AI CRM platform.
Implements the Orchestrator, Memory Agent, Context Agent, and Guardrails
service using Google ADK, the A2A protocol, and OpenTelemetry.

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Python 3.12 |
| Agent Framework | Google ADK (`google-adk >= 0.3.0`) |
| Agent Protocol | A2A v0.3 (HTTP + SSE) |
| LLM | Google Gemini via Vertex AI |
| API Framework | FastAPI + uvicorn |
| PII Detection | Presidio Analyzer |
| Task Registry | Redis (multi-replica safe) |
| Vector DB Client | qdrant-client |
| Observability | OpenTelemetry → OTLP gRPC |
| Config | Pydantic Settings |

## Agent Architecture

```
orchestrator (port 8001)
│   Routes tasks to sub-agents via A2A protocol
│   Execution modes: sequential, parallel, loop
├── memory-agent (port 8002)
│       Skills: memory_read, memory_write, semantic_search, consolidate_memory
├── context-agent (port 8003)
│       Skills: build_context, update_context
└── guardrails (port 8004)
        Input: PII detection, prompt injection, toxicity, credential patterns
        Output: PII redaction, schema validation, hallucination flagging
```

## Project Structure

```
orchestrator/           # Main orchestrator agent + ADK wiring
  agent.py              # FastAPI app + A2A server + handle_task()
  router.py             # Intent → (agent, skill, mode) routing
  task_manager.py       # A2A delegation helpers
  modes/
    sequential.py       # Chain artifacts between steps
    parallel.py         # asyncio.gather fan-out
    loop.py             # Iterative refinement with LOOP_DONE signal
memory_agent/           # Memory agent (all 4 memory types)
  agent.py
  tools/                # working/semantic/episodic/procedural tools
context_agent/          # Context fabric agent
  agent.py
guardrails/             # Standalone guardrails FastAPI service
  engine.py
  api.py
  input_guardrails/
  output_guardrails/
shared/
  a2a/                  # A2A models, TaskRegistry, server, client
  clients/              # backend_client.py
  config/settings.py    # Pydantic Settings (all env vars)
  otel/setup.py         # TracerProvider + MeterProvider + auto-instrumentation
tests/
  test_guardrails.py
  test_router.py
```

## A2A Protocol

Every agent exposes the same A2A interface:

```
GET  /.well-known/agent.json     → Agent Card (skills, capabilities)
POST /a2a/tasks/send             → Submit task (returns task_id immediately)
GET  /a2a/tasks/{id}             → Poll task status
GET  /a2a/tasks/{id}/stream      → SSE stream of task events
POST /a2a/tasks/{id}/cancel      → Cancel task
```

## Running Locally

### Prerequisites

```bash
# Install uv (fast Python package manager)
pip install uv

# Install deps
uv sync

# Start shared infra
cd ../crm-infra && docker compose up -d
```

### Start all agents

```bash
docker compose up --build
```

### Start individual agent (dev mode with auto-reload)

```bash
# Orchestrator
uv run uvicorn orchestrator.agent:app --reload --port 8001

# Memory Agent
uv run uvicorn memory_agent.agent:app --reload --port 8002

# Guardrails
uv run uvicorn guardrails.api:app --reload --port 8004
```

## Environment Variables

Key variables (see `shared/config/settings.py` for full list):

```bash
BACKEND_URL=http://localhost:8080
REDIS_HOST=localhost
REDIS_PORT=6379
QDRANT_HOST=localhost
QDRANT_PORT=6333
GOOGLE_CLOUD_PROJECT=your-project-id
GEMINI_MODEL=gemini-1.5-pro
VERTEX_LOCATION=us-central1
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
GUARDRAILS_ENABLED=true
```

## Running Tests

```bash
uv run pytest tests/ -v
```

## Kubernetes Deployment

```bash
# Apply service account first
kubectl apply -f k8s/serviceaccount.yaml

# Deploy each agent
kubectl apply -f k8s/orchestrator/
kubectl apply -f k8s/memory-agent/
kubectl apply -f k8s/context-agent/
kubectl apply -f k8s/guardrails/
```
