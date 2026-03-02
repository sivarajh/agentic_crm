package com.crm.backend.memory;

import com.crm.backend.common.model.ApiResponse;
import com.crm.backend.memory.model.EpisodicMemory;
import com.crm.backend.memory.model.ProceduralMemory;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/memory")
@RequiredArgsConstructor
public class MemoryController {

    private final WorkingMemoryService workingMemoryService;
    private final EpisodicMemoryService episodicMemoryService;
    private final ProceduralMemoryService proceduralMemoryService;

    // ─── Working Memory ───────────────────────────────────────────────────────

    @GetMapping("/working/{sessionId}/{key}")
    public ResponseEntity<ApiResponse<String>> getWorking(
            @PathVariable UUID sessionId, @PathVariable String key) {
        String val = workingMemoryService.get(sessionId, key);
        return ResponseEntity.ok(ApiResponse.ok(val));
    }

    @PutMapping("/working/{sessionId}/{key}")
    public ResponseEntity<ApiResponse<Void>> setWorking(
            @PathVariable UUID sessionId,
            @PathVariable String key,
            @RequestBody String value) {
        workingMemoryService.set(sessionId, key, value);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @DeleteMapping("/working/{sessionId}")
    public ResponseEntity<Void> clearWorking(@PathVariable UUID sessionId) {
        workingMemoryService.clearSession(sessionId);
        return ResponseEntity.noContent().build();
    }

    // ─── Episodic Memory ──────────────────────────────────────────────────────

    @PostMapping("/episodic")
    public ResponseEntity<ApiResponse<EpisodicMemory>> recordEpisode(
            @Valid @RequestBody EpisodeRequest request) {
        EpisodicMemory episode = episodicMemoryService.recordEpisode(
                request.getEntityId(),
                request.getEntityType(),
                request.getEventType(),
                request.getSummary(),
                request.getSessionId(),
                request.getAgentId(),
                request.getMetadata()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(episode));
    }

    @GetMapping("/episodic/entity/{entityId}")
    public ResponseEntity<ApiResponse<List<EpisodicMemory>>> getEpisodes(
            @PathVariable UUID entityId,
            @RequestParam(required = false) String entityType,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant before) {
        List<EpisodicMemory> episodes = episodicMemoryService.getByEntity(
                entityId, entityType, limit, before);
        return ResponseEntity.ok(ApiResponse.ok(episodes));
    }

    // ─── Procedural Memory ────────────────────────────────────────────────────

    @GetMapping("/procedural")
    public ResponseEntity<ApiResponse<List<ProceduralMemory>>> getProcedures(
            @RequestParam(required = false) String agentScope) {
        List<ProceduralMemory> procs = agentScope != null
                ? proceduralMemoryService.getActiveForAgent(agentScope)
                : proceduralMemoryService.getAll();
        return ResponseEntity.ok(ApiResponse.ok(procs));
    }

    @GetMapping("/procedural/{procedureId}")
    public ResponseEntity<ApiResponse<ProceduralMemory>> getProcedure(
            @PathVariable UUID procedureId) {
        return ResponseEntity.ok(ApiResponse.ok(proceduralMemoryService.getById(procedureId)));
    }

    @PostMapping("/procedural")
    public ResponseEntity<ApiResponse<ProceduralMemory>> createProcedure(
            @Valid @RequestBody ProcedureRequest request) {
        ProceduralMemory proc = proceduralMemoryService.create(
                request.getName(), request.getDescription(),
                request.getTriggerConditions(), request.getSteps(),
                request.getAgentScope(), request.getCreatedBy(), request.getMetadata());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(proc));
    }

    @PutMapping("/procedural/{procedureId}")
    public ResponseEntity<ApiResponse<ProceduralMemory>> updateProcedure(
            @PathVariable UUID procedureId,
            @RequestBody ProcedureUpdateRequest request) {
        ProceduralMemory proc = proceduralMemoryService.update(
                procedureId, request.getDescription(), request.getSteps(),
                request.getActive(), request.getMetadata());
        return ResponseEntity.ok(ApiResponse.ok(proc));
    }

    // ─── DTOs ─────────────────────────────────────────────────────────────────

    @Data
    public static class EpisodeRequest {
        @NotNull private UUID entityId;
        @NotBlank private String entityType;
        @NotBlank private String eventType;
        @NotBlank private String summary;
        private UUID sessionId;
        private String agentId;
        private Map<String, Object> metadata;
    }

    @Data
    public static class ProcedureRequest {
        @NotBlank private String name;
        private String description;
        private List<Map<String, Object>> triggerConditions;
        @NotNull private List<Map<String, Object>> steps;
        private List<String> agentScope;
        private String createdBy;
        private Map<String, Object> metadata;
    }

    @Data
    public static class ProcedureUpdateRequest {
        private String description;
        private List<Map<String, Object>> steps;
        private Boolean active;
        private Map<String, Object> metadata;
    }
}
