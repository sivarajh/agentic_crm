package com.crm.backend.memory;

import com.crm.backend.config.CrmProperties;
import com.crm.backend.common.util.HashUtil;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.context.Scope;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Manages semantic memory backed by Qdrant vector database.
 * Each entry has a 768-dim embedding stored in Qdrant and metadata
 * indexed in PostgreSQL (semantic_memory_index table) for hash-based dedup.
 */
@Service
public class SemanticMemoryService {

    private static final Logger log = LoggerFactory.getLogger(SemanticMemoryService.class);

    private static final String COLLECTION_SEMANTIC = "crm_semantic";

    private final WebClient qdrantClient;
    private final SemanticMemoryIndexRepository indexRepository;
    private final Tracer tracer;
    private final CrmProperties crmProperties;

    public SemanticMemoryService(
            CrmProperties crmProperties,
            SemanticMemoryIndexRepository indexRepository,
            Tracer tracer,
            WebClient.Builder webClientBuilder
    ) {
        this.crmProperties = crmProperties;
        this.indexRepository = indexRepository;
        this.tracer = tracer;
        this.qdrantClient = webClientBuilder
                .baseUrl("http://" + crmProperties.getQdrant().getHost()
                        + ":" + crmProperties.getQdrant().getPort())
                .build();
    }

    /**
     * Search semantic memory by query embedding (cosine similarity).
     *
     * @param queryEmbedding  768-dimensional float vector
     * @param entityType      optional filter (e.g. "contact", "account")
     * @param limit           max results to return
     * @return list of matching Qdrant points with payload and score
     */
    public List<Map<String, Object>> search(
            List<Float> queryEmbedding,
            String entityType,
            int limit
    ) {
        Span span = tracer.spanBuilder("semantic_memory.search")
                .startSpan();
        try (Scope ignored = span.makeCurrent()) {
            span.setAttribute("collection", COLLECTION_SEMANTIC);
            span.setAttribute("limit", limit);
            if (entityType != null) span.setAttribute("entity_type", entityType);

            // Build Qdrant search request
            Map<String, Object> filter = buildFilter(entityType);
            Map<String, Object> searchRequest = Map.of(
                    "vector", queryEmbedding,
                    "limit", limit,
                    "with_payload", true,
                    "filter", filter
            );

            @SuppressWarnings("unchecked")
            Map<String, Object> response = qdrantClient.post()
                    .uri("/collections/" + COLLECTION_SEMANTIC + "/points/search")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(searchRequest)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response == null || !response.containsKey("result")) {
                return List.of();
            }

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> results = (List<Map<String, Object>>) response.get("result");
            span.setAttribute("result_count", results.size());
            return results;

        } catch (Exception e) {
            span.recordException(e);
            log.error("Semantic search failed", e);
            return List.of();
        } finally {
            span.end();
        }
    }

    /**
     * Upsert a semantic memory entry. Skips if content hash already exists (dedup).
     *
     * @param entityId    business entity identifier
     * @param entityType  type label (e.g. "contact")
     * @param content     the textual content being stored
     * @param embedding   pre-computed 768-dim float vector
     * @param sourceAgent which agent produced this entry
     * @param contentType label for the content type
     * @return the Qdrant point ID that was upserted, or existing ID if duplicate
     */
    public String upsert(
            String entityId,
            String entityType,
            String content,
            List<Float> embedding,
            String sourceAgent,
            String contentType
    ) {
        Span span = tracer.spanBuilder("semantic_memory.upsert")
                .startSpan();
        try (Scope ignored = span.makeCurrent()) {
            span.setAttribute("entity_id", entityId);
            span.setAttribute("entity_type", entityType);
            span.setAttribute("source_agent", sourceAgent);

            String contentHash = HashUtil.sha256(content);

            // Check for existing entry with same hash
            var existing = indexRepository.findByContentHash(contentHash);
            if (existing.isPresent()) {
                span.setAttribute("cache.hit", true);
                log.debug("Semantic memory dedup: content hash {} already indexed at point {}",
                        contentHash, existing.get().getQdrantPointId());
                return existing.get().getQdrantPointId();
            }

            span.setAttribute("cache.hit", false);
            String pointId = UUID.randomUUID().toString();

            // Build Qdrant payload
            Map<String, Object> payload = Map.of(
                    "entity_id", entityId,
                    "entity_type", entityType,
                    "source_agent", sourceAgent,
                    "content_type", contentType,
                    "content_hash", contentHash,
                    "indexed_at", Instant.now().toString()
            );

            Map<String, Object> point = Map.of(
                    "id", pointId,
                    "vector", embedding,
                    "payload", payload
            );

            Map<String, Object> upsertRequest = Map.of("points", List.of(point));

            qdrantClient.put()
                    .uri("/collections/" + COLLECTION_SEMANTIC + "/points")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(upsertRequest)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            // Index in PostgreSQL for hash-based dedup and lifecycle management
            SemanticMemoryIndex index = new SemanticMemoryIndex();
            index.setQdrantPointId(pointId);
            index.setEntityId(entityId);
            index.setEntityType(entityType);
            index.setContentHash(contentHash);
            index.setCollectionName(COLLECTION_SEMANTIC);
            indexRepository.save(index);

            log.debug("Upserted semantic memory point {} for entity {}/{}", pointId, entityType, entityId);
            return pointId;

        } catch (Exception e) {
            span.recordException(e);
            log.error("Semantic memory upsert failed for entity {}/{}", entityType, entityId, e);
            throw new RuntimeException("Semantic memory upsert failed", e);
        } finally {
            span.end();
        }
    }

    /**
     * Delete all semantic memory entries for an entity from both Qdrant and the PG index.
     */
    public void deleteByEntity(String entityId, String entityType) {
        // Delete from PG index first
        List<SemanticMemoryIndex> entries = indexRepository.findByEntityIdAndEntityType(entityId, entityType);
        if (entries.isEmpty()) {
            return;
        }

        List<String> pointIds = entries.stream()
                .map(SemanticMemoryIndex::getQdrantPointId)
                .toList();

        // Delete from Qdrant via filter
        Map<String, Object> deleteRequest = Map.of(
                "filter", Map.of(
                        "must", List.of(
                                Map.of("key", "entity_id", "match", Map.of("value", entityId)),
                                Map.of("key", "entity_type", "match", Map.of("value", entityType))
                        )
                )
        );

        qdrantClient.post()
                .uri("/collections/" + COLLECTION_SEMANTIC + "/points/delete")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(deleteRequest)
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        indexRepository.deleteAll(entries);
        log.info("Deleted {} semantic memory points for entity {}/{}", pointIds.size(), entityType, entityId);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private Map<String, Object> buildFilter(String entityType) {
        if (entityType == null || entityType.isBlank()) {
            return Map.of();
        }
        return Map.of(
                "must", List.of(
                        Map.of("key", "entity_type", "match", Map.of("value", entityType))
                )
        );
    }
}
