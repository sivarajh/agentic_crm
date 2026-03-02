package com.crm.backend.memory.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "episodic_memory")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EpisodicMemory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "episode_id", updatable = false, nullable = false)
    private UUID episodeId;

    @Column(name = "entity_id", nullable = false)
    private UUID entityId;

    @Column(name = "entity_type", nullable = false)
    private String entityType;

    @Column(name = "event_type", nullable = false)
    private String eventType;

    @Column(name = "summary", nullable = false, columnDefinition = "TEXT")
    private String summary;

    @Column(name = "embedding_ref")
    private String embeddingRef;

    @Column(name = "session_id")
    private UUID sessionId;

    @Column(name = "agent_id")
    private String agentId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> metadata = new HashMap<>();

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
        if (occurredAt == null) occurredAt = Instant.now();
    }
}
