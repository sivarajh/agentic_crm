package com.crm.backend.agent;

import com.crm.backend.agent.model.A2ATask;
import com.crm.backend.agent.model.A2ATaskStatus;
import com.crm.backend.agent.model.AgentCard;
import com.crm.backend.common.model.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/agent")
@RequiredArgsConstructor
public class AgentGatewayController {

    private final AgentGatewayService agentGatewayService;

    @PostMapping("/tasks")
    public ResponseEntity<ApiResponse<A2ATask>> submitTask(
            @Valid @RequestBody TaskRequest request) {
        A2ATask task = agentGatewayService.submitTask(
                request.getSessionId(), request.getUserId(),
                request.getIntent(), request.getPayload(), request.getPriority());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(task));
    }

    @GetMapping("/tasks/{taskId}")
    public ResponseEntity<ApiResponse<A2ATask>> getTask(@PathVariable String taskId) {
        A2ATask task = agentGatewayService.getTask(taskId);
        if (task == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(ApiResponse.ok(task));
    }

    /**
     * Orchestrator calls this endpoint when a task completes or fails.
     * Body: { "status": "COMPLETED"|"FAILED", "result": {...}, "error": "..." }
     */
    @PatchMapping("/tasks/{taskId}/status")
    public ResponseEntity<ApiResponse<A2ATask>> updateTaskStatus(
            @PathVariable String taskId,
            @RequestBody TaskStatusUpdate update) {
        A2ATaskStatus status;
        try {
            status = A2ATaskStatus.valueOf(update.getStatus().toUpperCase());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Invalid status: " + update.getStatus(), "INVALID_STATUS"));
        }
        A2ATask updated = agentGatewayService.completeTask(
                taskId, status, update.getResult(), update.getError());
        if (updated == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(ApiResponse.ok(updated));
    }

    /**
     * Orchestrator pushes streaming chunk events here during LLM generation.
     * Body: { "eventType": "agent.message", "data": { "content": "..." } }
     */
    @PostMapping("/tasks/{taskId}/events")
    public ResponseEntity<Void> pushTaskEvent(
            @PathVariable String taskId,
            @RequestBody Map<String, Object> body) {
        String eventType = (String) body.getOrDefault("eventType", "agent.message");
        Object data = body.get("data");
        agentGatewayService.pushStreamEvent(taskId, eventType, data);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/cards")
    public ResponseEntity<ApiResponse<List<AgentCard>>> listAgentCards() {
        return ResponseEntity.ok(ApiResponse.ok(agentGatewayService.listAgentCards()));
    }

    @Data
    public static class TaskStatusUpdate {
        private String status;
        private Map<String, Object> result;
        private String error;
    }

    @Data
    public static class TaskRequest {
        @NotNull private UUID sessionId;
        @NotNull private UUID userId;
        @NotBlank private String intent;
        private Map<String, Object> payload;
        private String priority = "NORMAL";
    }
}
