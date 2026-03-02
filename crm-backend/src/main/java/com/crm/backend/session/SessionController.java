package com.crm.backend.session;

import com.crm.backend.common.model.ApiResponse;
import com.crm.backend.session.model.Session;
import com.crm.backend.session.model.SessionState;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/sessions")
@RequiredArgsConstructor
public class SessionController {

    private final SessionService sessionService;

    @PostMapping
    public ResponseEntity<ApiResponse<Session>> createSession(
            @Valid @RequestBody CreateSessionRequest request) {
        Session session = sessionService.createSession(request.getUserId(), request.getAgentId());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(session));
    }

    @GetMapping("/{sessionId}")
    public ResponseEntity<ApiResponse<Session>> getSession(
            @PathVariable UUID sessionId) {
        return ResponseEntity.ok(ApiResponse.ok(sessionService.getSession(sessionId)));
    }

    @PutMapping("/{sessionId}/heartbeat")
    public ResponseEntity<ApiResponse<Session>> heartbeat(
            @PathVariable UUID sessionId,
            @RequestBody(required = false) HeartbeatRequest request) {
        UUID activeTaskId = request != null ? request.getActiveTaskId() : null;
        return ResponseEntity.ok(ApiResponse.ok(sessionService.heartbeat(sessionId, activeTaskId)));
    }

    @DeleteMapping("/{sessionId}")
    public ResponseEntity<Void> terminateSession(@PathVariable UUID sessionId) {
        sessionService.terminateSession(sessionId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Page<Session>>> listSessions(
            @RequestParam UUID userId,
            @RequestParam(required = false) SessionState state,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<Session> sessions = sessionService.listSessionsByUser(
                userId, state, PageRequest.of(page, size, Sort.by("lastActive").descending()));
        return ResponseEntity.ok(ApiResponse.ok(sessions));
    }

    // ─── Request DTOs ─────────────────────────────────────────────────────────

    @Data
    public static class CreateSessionRequest {
        @NotNull
        private UUID userId;
        private String agentId;
    }

    @Data
    public static class HeartbeatRequest {
        private UUID activeTaskId;
    }
}
