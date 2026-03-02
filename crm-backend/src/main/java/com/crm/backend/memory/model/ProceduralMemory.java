package com.crm.backend.memory.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "procedural_memory")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProceduralMemory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "procedure_id", updatable = false, nullable = false)
    private UUID procedureId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "trigger_conditions", columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private List<Map<String, Object>> triggerConditions = List.of();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "steps", columnDefinition = "jsonb", nullable = false)
    private List<Map<String, Object>> steps;

    @Column(name = "version", nullable = false)
    @Builder.Default
    private Integer version = 1;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private Boolean active = true;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "agent_scope", columnDefinition = "jsonb")
    private List<String> agentScope;

    @Column(name = "created_by")
    private String createdBy;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> metadata = new HashMap<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }
}
