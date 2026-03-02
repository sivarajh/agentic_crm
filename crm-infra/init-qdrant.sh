#!/bin/bash
# Initialize Qdrant collections for CRM system
# Run after docker-compose up and qdrant is healthy

set -e
QDRANT_URL="${QDRANT_URL:-http://localhost:6333}"

echo "Waiting for Qdrant to be ready..."
until curl -sf "$QDRANT_URL/healthz" > /dev/null; do
  sleep 2
done
echo "Qdrant is ready."

echo "Creating crm_semantic collection..."
curl -sf -X PUT "$QDRANT_URL/collections/crm_semantic" \
  -H "Content-Type: application/json" \
  -d '{
    "vectors": {
      "size": 768,
      "distance": "Cosine"
    },
    "optimizers_config": {
      "default_segment_number": 2,
      "indexing_threshold": 10000
    },
    "replication_factor": 1,
    "hnsw_config": {
      "m": 16,
      "ef_construct": 100
    }
  }' && echo " OK" || echo " Already exists (OK)"

echo "Creating payload indexes for crm_semantic..."
for field in entity_id entity_type source_agent content_type; do
  curl -sf -X PUT "$QDRANT_URL/collections/crm_semantic/index" \
    -H "Content-Type: application/json" \
    -d "{\"field_name\": \"$field\", \"field_schema\": \"keyword\"}" \
    && echo "  $field index OK" || echo "  $field index may already exist (OK)"
done

echo "Creating crm_episodic_embeddings collection..."
curl -sf -X PUT "$QDRANT_URL/collections/crm_episodic_embeddings" \
  -H "Content-Type: application/json" \
  -d '{
    "vectors": {
      "size": 768,
      "distance": "Cosine"
    },
    "optimizers_config": {
      "default_segment_number": 2,
      "indexing_threshold": 5000
    },
    "replication_factor": 1
  }' && echo " OK" || echo " Already exists (OK)"

echo "Creating payload indexes for crm_episodic_embeddings..."
for field in episode_id entity_id entity_type event_type; do
  curl -sf -X PUT "$QDRANT_URL/collections/crm_episodic_embeddings/index" \
    -H "Content-Type: application/json" \
    -d "{\"field_name\": \"$field\", \"field_schema\": \"keyword\"}" \
    && echo "  $field index OK" || echo "  $field index may already exist (OK)"
done

curl -sf -X PUT "$QDRANT_URL/collections/crm_episodic_embeddings/index" \
  -H "Content-Type: application/json" \
  -d '{"field_name": "occurred_at", "field_schema": "datetime"}' \
  && echo "  occurred_at index OK" || true

echo ""
echo "Listing collections:"
curl -sf "$QDRANT_URL/collections" | python3 -m json.tool 2>/dev/null || \
  curl -sf "$QDRANT_URL/collections"

echo ""
echo "Qdrant initialization complete."
