package com.crm.backend.agent;

import com.crm.backend.agent.model.A2AArtifact;
import com.crm.backend.agent.model.A2ATask;
import com.crm.backend.agent.model.A2ATaskStatus;
import com.crm.backend.agent.model.AgentCard;
import com.crm.backend.common.exception.AgentCommunicationException;
import com.crm.backend.config.CrmProperties;
import com.crm.backend.streaming.StreamingEventService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Gateway between the Java backend and Python A2A agent network.
 * Submits tasks to the orchestrator, tracks status in Redis, and
 * publishes SSE events for the UI streaming layer.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AgentGatewayService {

    private static final String TASK_KEY_PREFIX = "task:";
    private static final Duration TASK_TTL = Duration.ofHours(2);

    private final CrmProperties crmProperties;
    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;
    private final StreamingEventService streamingEventService;

    @SneakyThrows
    public A2ATask submitTask(UUID sessionId, UUID userId,
                               String intent, Map<String, Object> payload,
                               String priority) {
        String taskId = UUID.randomUUID().toString();
        A2ATask task = A2ATask.builder()
                .taskId(taskId)
                .sessionId(sessionId)
                .userId(userId)
                .intent(intent)
                .payload(payload != null ? payload : Map.of())
                .priority(priority != null ? priority : "NORMAL")
                .status(A2ATaskStatus.QUEUED)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        // Store task in Redis
        persistTask(task);

        // Forward to orchestrator asynchronously
        forwardToOrchestrator(task);

        log.info("Submitted task={} intent='{}' session={}", taskId, intent, sessionId);
        return task;
    }

    @SneakyThrows
    public A2ATask getTask(String taskId) {
        String raw = redisTemplate.opsForValue().get(TASK_KEY_PREFIX + taskId);
        if (raw == null) return null;
        return objectMapper.readValue(raw, A2ATask.class);
    }

    public List<AgentCard> listAgentCards() {
        // Fetch agent cards from all known agent services
        return List.of(
            fetchAgentCard(crmProperties.getAgents().getOrchestratorUrl()),
            fetchAgentCard(crmProperties.getAgents().getMemoryAgentUrl()),
            fetchAgentCard(crmProperties.getAgents().getContextAgentUrl())
        );
    }

    // ─── Orchestrator Callback ─────────────────────────────────────────────────

    /**
     * Called by the orchestrator via PATCH /api/v1/agent/tasks/{taskId}/status
     * to mark a task as completed or failed with its result payload.
     */
    @SneakyThrows
    public A2ATask completeTask(String taskId, A2ATaskStatus status,
                                 Map<String, Object> result, String error) {
        String raw = redisTemplate.opsForValue().get(TASK_KEY_PREFIX + taskId);
        if (raw == null) {
            log.warn("completeTask: task {} not found in Redis", taskId);
            return null;
        }
        A2ATask task = objectMapper.readValue(raw, A2ATask.class);
        A2ATask updated = task.toBuilder()
                .status(status)
                .result(result)
                .error(error)
                .updatedAt(Instant.now())
                .build();
        persistTask(updated);
        log.info("Task {} marked {} via orchestrator callback", taskId, status);

        // Broadcast SSE so the UI streaming layer picks it up immediately
        streamingEventService.publishEvent(
                task.getSessionId().toString(),
                status == A2ATaskStatus.COMPLETED ? "task.completed" : "task.failed",
                Map.of("taskId", taskId, "status", status.name())
        );
        return updated;
    }

    // ─── Streaming event push ─────────────────────────────────────────────────

    /**
     * Called by the orchestrator during LLM streaming to push individual chunk
     * events directly to the UI's SSE channel for the task's session.
     */
    @SneakyThrows
    public void pushStreamEvent(String taskId, String eventType, Object data) {
        String raw = redisTemplate.opsForValue().get(TASK_KEY_PREFIX + taskId);
        if (raw == null) {
            log.debug("pushStreamEvent: task {} not found", taskId);
            return;
        }
        A2ATask task = objectMapper.readValue(raw, A2ATask.class);
        streamingEventService.publishEvent(task.getSessionId().toString(), eventType, data);
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    @SneakyThrows
    private void persistTask(A2ATask task) {
        redisTemplate.opsForValue().set(
                TASK_KEY_PREFIX + task.getTaskId(),
                objectMapper.writeValueAsString(task),
                TASK_TTL);
    }

    private void forwardToOrchestrator(A2ATask task) {
        String orchestratorUrl = crmProperties.getAgents().getOrchestratorUrl();
        WebClient client = WebClient.builder()
                .baseUrl(orchestratorUrl)
                .codecs(cfg -> cfg.defaultCodecs().maxInMemorySize(1024 * 1024))
                .build();

        // Build A2A task send request
        Map<String, Object> a2aRequest = Map.of(
            "task_id", task.getTaskId(),
            "session_id", task.getSessionId().toString(),
            "message", Map.of(
                "role", "user",
                "parts", List.of(Map.of(
                    "type", "text",
                    "text", task.getIntent()
                ))
            ),
            "metadata", Map.of(
                "userId", task.getUserId().toString(),
                "payload", task.getPayload(),
                "priority", task.getPriority()
            )
        );

        client.post()
            .uri("/a2a/tasks/send")
            .bodyValue(a2aRequest)
            .retrieve()
            .bodyToMono(Map.class)
            .doOnSuccess(resp -> {
                updateTaskStatus(task.getTaskId(), A2ATaskStatus.SUBMITTED);
                streamingEventService.publishEvent(
                    task.getSessionId().toString(),
                    "task.submitted",
                    Map.of("taskId", task.getTaskId(), "status", "SUBMITTED")
                );
            })
            .doOnError(err -> {
                log.error("Failed to forward task={} to orchestrator: {}", task.getTaskId(), err.getMessage());
                updateTaskStatus(task.getTaskId(), A2ATaskStatus.FAILED);
                streamingEventService.publishEvent(
                    task.getSessionId().toString(),
                    "task.failed",
                    Map.of("taskId", task.getTaskId(), "error", err.getMessage())
                );
            })
            .subscribe();
    }

    @SneakyThrows
    private void updateTaskStatus(String taskId, A2ATaskStatus status) {
        String raw = redisTemplate.opsForValue().get(TASK_KEY_PREFIX + taskId);
        if (raw == null) return;
        A2ATask task = objectMapper.readValue(raw, A2ATask.class);
        A2ATask updated = task.toBuilder()
                .status(status)
                .updatedAt(Instant.now())
                .build();
        persistTask(updated);
    }

    private AgentCard fetchAgentCard(String agentUrl) {
        try {
            return WebClient.create(agentUrl)
                    .get()
                    .uri("/.well-known/agent.json")
                    .retrieve()
                    .bodyToMono(AgentCard.class)
                    .block(Duration.ofSeconds(5));
        } catch (Exception e) {
            log.warn("Could not fetch agent card from {}: {}", agentUrl, e.getMessage());
            return null;
        }
    }
}
