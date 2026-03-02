package com.crm.backend.memory;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/**
 * PostgreSQL index entry for a Qdrant semantic memory point.
 * Enables hash-based deduplication and lifecycle management
 * without querying Qdrant directly for existence checks.
 */
@Entity
@Table(
    name = "semantic_memory_index",
    indexes = {
        @Index(name = "idx_smi_entity", columnList = "entity_id, entity_type"),
        @Index(name = "idx_smi_hash", columnList = "content_hash", unique = true)
    }
)
public class SemanticMemoryIndex {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "entry_id")
    private UUID entryId;

    @Column(name = "qdrant_point_id", nullable = false, unique = true)
    private String qdrantPointId;

    @Column(name = "entity_id", nullable = false)
    private String entityId;

    @Column(name = "entity_type", nullable = false, length = 100)
    private String entityType;

    @Column(name = "content_hash", nullable = false, length = 64)
    private String contentHash;

    @Column(name = "collection_name", nullable = false, length = 100)
    private String collectionName;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    // Getters and setters

    public UUID getEntryId() { return entryId; }
    public void setEntryId(UUID entryId) { this.entryId = entryId; }

    public String getQdrantPointId() { return qdrantPointId; }
    public void setQdrantPointId(String qdrantPointId) { this.qdrantPointId = qdrantPointId; }

    public String getEntityId() { return entityId; }
    public void setEntityId(String entityId) { this.entityId = entityId; }

    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }

    public String getContentHash() { return contentHash; }
    public void setContentHash(String contentHash) { this.contentHash = contentHash; }

    public String getCollectionName() { return collectionName; }
    public void setCollectionName(String collectionName) { this.collectionName = collectionName; }

    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }

    public Instant getCreatedAt() { return createdAt; }
}
