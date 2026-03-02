package com.crm.backend.compliance.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "audit_events")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "audit_event_id", updatable = false, nullable = false)
    private UUID auditEventId;

    @Column(name = "event_type", nullable = false, updatable = false)
    private String eventType;

    @Column(name = "agent_id", updatable = false)
    private String agentId;

    @Column(name = "user_id", updatable = false)
    private UUID userId;

    @Column(name = "session_id", updatable = false)
    private UUID sessionId;

    @Column(name = "action", nullable = false, updatable = false)
    private String action;

    @Column(name = "resource_type", updatable = false)
    private String resourceType;

    @Column(name = "resource_id", updatable = false)
    private String resourceId;

    @Column(name = "data_hash", updatable = false)
    private String dataHash;

    @Column(name = "trace_id", updatable = false)
    private String traceId;

    @Column(name = "span_id", updatable = false)
    private String spanId;

    @Column(name = "review_status", nullable = false)
    @Builder.Default
    private String reviewStatus = "NOT_REQUIRED";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", columnDefinition = "jsonb", updatable = false)
    @Builder.Default
    private Map<String, Object> metadata = new HashMap<>();

    @Column(name = "occurred_at", nullable = false, updatable = false)
    private Instant occurredAt;

    @PrePersist
    protected void onCreate() {
        if (occurredAt == null) occurredAt = Instant.now();
    }
}
