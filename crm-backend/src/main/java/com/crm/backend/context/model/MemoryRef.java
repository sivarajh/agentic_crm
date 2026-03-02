package com.crm.backend.context.model;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.UUID;

@Value
@Builder
public class MemoryRef {
    UUID episodeId;
    UUID entityId;
    String entityType;
    String eventType;
    String summary;
    Instant occurredAt;
}
