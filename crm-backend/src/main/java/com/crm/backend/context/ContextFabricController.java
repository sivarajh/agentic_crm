package com.crm.backend.context;

import com.crm.backend.common.model.ApiResponse;
import com.crm.backend.context.model.AgentContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/context")
@RequiredArgsConstructor
public class ContextFabricController {

    private final ContextFabricService contextFabricService;

    @GetMapping("/{contextId}")
    public ResponseEntity<ApiResponse<AgentContext>> getContext(
            @PathVariable String contextId,
            @RequestParam UUID sessionId,
            @RequestParam String agentId,
            @RequestParam UUID userId) {
        AgentContext context = contextFabricService.buildContext(
                contextId, sessionId, agentId, userId);
        return ResponseEntity.ok(ApiResponse.ok(context));
    }

    @PostMapping("/{contextId}")
    public ResponseEntity<ApiResponse<AgentContext>> updateContext(
            @PathVariable String contextId,
            @RequestBody Map<String, Object> patch) {
        AgentContext updated = contextFabricService.updateContext(contextId, patch);
        return ResponseEntity.ok(ApiResponse.ok(updated));
    }

    @DeleteMapping("/{contextId}")
    public ResponseEntity<Void> deleteContext(@PathVariable String contextId) {
        contextFabricService.deleteContext(contextId);
        return ResponseEntity.noContent().build();
    }
}
