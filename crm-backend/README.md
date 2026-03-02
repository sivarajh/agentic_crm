# crm-backend

Spring Boot 3.3 foundation service for the Agentic AI CRM platform.
Provides session management, conversation history, four-type memory system,
context fabric, compliance audit trail, agent gateway, and SSE streaming.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Java 21 |
| Framework | Spring Boot 3.3 |
| Database | PostgreSQL 16 (Flyway migrations) |
| Cache | Redis 7 |
| Vector DB | Qdrant 1.9 (semantic memory) |
| Observability | OpenTelemetry → Jaeger + Prometheus |
| API Docs | SpringDoc OpenAPI 3 (`/swagger-ui.html`) |

## Project Structure

```
src/main/java/com/crm/backend/
├── agent/          # AgentGatewayService, A2A task submission
├── common/         # GlobalExceptionHandler, ApiResponse, HashUtil
├── compliance/     # Immutable audit_events, review_queue
├── config/         # RedisConfig, OpenTelemetryConfig, CrmProperties
├── context/        # ContextFabricService — aggregates all stores
├── conversation/   # Append-only conversation messages
├── memory/         # Working (Redis), Semantic (Qdrant), Episodic, Procedural
├── session/        # Session lifecycle + Redis TTL cache
└── streaming/      # SSE emitter registry + SseController
src/main/resources/
├── application.yml
└── db/migration/   # V1–V4 Flyway SQL migrations
```

## Running Locally

### Prerequisites

Start shared infrastructure first:

```bash
cd ../crm-infra
docker compose up -d
# wait for health checks
```

### Run with Maven

```bash
mvn spring-boot:run
```

The service starts on port `8080`. Management endpoints are on `8081`.

### Run with Docker

```bash
docker compose up --build
```

## API Reference

Interactive docs available at `http://localhost:8080/swagger-ui.html` when running.

| Domain | Base Path |
|--------|-----------|
| Sessions | `POST /api/v1/sessions` |
| Conversations | `POST /api/v1/conversations` |
| Working Memory | `GET/PUT /api/v1/memory/working/{sessionId}/{key}` |
| Semantic Memory | `POST /api/v1/memory/semantic/search` |
| Episodic Memory | `POST /api/v1/memory/episodic` |
| Procedural Memory | `GET/POST /api/v1/memory/procedural` |
| Context Fabric | `GET /api/v1/context/{contextId}` |
| Compliance | `POST /api/v1/compliance/audit` |
| Agent Gateway | `POST /api/v1/agent/tasks` |
| SSE Stream | `GET /api/v1/stream/session/{sessionId}` |

## Database Migrations

Flyway runs automatically on startup. Migration files:

| Version | Description |
|---------|-------------|
| V1 | sessions schema + TTL helpers |
| V2 | conversations + immutable message log (DB trigger) |
| V3 | episodic, procedural, semantic memory indexes |
| V4 | audit_events (append-only) + review_queue |

## Configuration

Key `application.yml` properties (override via env vars):

```yaml
crm:
  agents:
    orchestrator-url: http://localhost:8001
    memory-url: http://localhost:8002
    context-url: http://localhost:8003
    guardrails-url: http://localhost:8004
  session:
    ttl-minutes: 30
  context:
    cache-ttl-minutes: 5
  qdrant:
    host: localhost
    port: 6333
```

## Running Tests

```bash
mvn test
```

Tests use Testcontainers — Docker must be running.

## Kubernetes Deployment

```bash
kubectl apply -f k8s/
```

Manifests in `k8s/`: `configmap.yaml`, `secret.yaml`, `deployment.yaml`,
`service.yaml`, `hpa.yaml`, `ingress.yaml`.
