package com.crm.backend.agent.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Value
@Builder(toBuilder = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class A2ATask {

    String taskId;
    UUID sessionId;
    UUID userId;
    String intent;
    Map<String, Object> payload;
    String priority;   // LOW, NORMAL, HIGH
    A2ATaskStatus status;
    List<A2AArtifact> artifacts;
    Map<String, Object> result;   // populated by orchestrator completion callback
    String error;
    Instant createdAt;
    Instant updatedAt;
}
