# CRM Infrastructure

Shared infrastructure for the Agentic AI CRM system. Provides all data stores and observability tooling for local development.

## Services

| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL 16 | 5432 | Sessions, conversations, episodic/procedural memory, compliance |
| Redis 7 | 6379 | Sessions cache, working memory, distributed locks |
| Qdrant v1.9.2 | 6333 (REST), 6334 (gRPC) | Vector DB for semantic & episodic embeddings |
| OTEL Collector | 4317 (gRPC), 4318 (HTTP) | Telemetry ingestion from all services |
| Jaeger | 16686 (UI) | Distributed tracing |
| Prometheus | 9090 | Metrics collection |
| Grafana | 3000 | Dashboards (admin/admin) |
| Loki | 3100 | Log aggregation |

## Quick Start

```bash
# Start all infrastructure
docker-compose up -d

# Wait for health checks
docker-compose ps

# Initialize Qdrant collections
chmod +x init-qdrant.sh
./init-qdrant.sh

# Verify
curl http://localhost:6333/collections        # Qdrant
redis-cli ping                                # Redis
psql -h localhost -U crm -d crmdb -c "\dt"   # PostgreSQL (password: changeme)
```

## Access Points
- **Grafana**: http://localhost:3000 (admin / admin)
- **Jaeger UI**: http://localhost:16686
- **Prometheus**: http://localhost:9090
- **Qdrant Dashboard**: http://localhost:6333/dashboard

## Network
All services share the `crm-net` bridge network. Application services connect using container names as hostnames.
