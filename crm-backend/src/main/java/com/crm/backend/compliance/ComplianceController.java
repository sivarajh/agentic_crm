package com.crm.backend.compliance;

import com.crm.backend.common.model.ApiResponse;
import com.crm.backend.compliance.model.AuditEvent;
import com.crm.backend.compliance.model.ReviewQueueItem;
import com.crm.backend.compliance.model.ReviewStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/compliance")
@RequiredArgsConstructor
public class ComplianceController {

    private final ComplianceService complianceService;

    // ─── Audit Events ─────────────────────────────────────────────────────────

    @PostMapping("/audit")
    public ResponseEntity<ApiResponse<AuditEvent>> recordAuditEvent(
            @Valid @RequestBody AuditEventRequest request) {
        AuditEvent event = complianceService.recordEvent(
                request.getEventType(), request.getAgentId(), request.getUserId(),
                request.getSessionId(), request.getAction(), request.getResourceType(),
                request.getResourceId(), request.getPayload(), request.getMetadata());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(event));
    }

    @GetMapping("/audit")
    public ResponseEntity<ApiResponse<Page<AuditEvent>>> listAuditEvents(
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) String agentId,
            @RequestParam(required = false) String eventType,
            @RequestParam(required = false) UUID sessionId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Page<AuditEvent> events = complianceService.listEvents(
                userId, agentId, eventType, sessionId, from, to,
                PageRequest.of(page, size, Sort.by("occurredAt").descending()));
        return ResponseEntity.ok(ApiResponse.ok(events));
    }

    // ─── Review Queue ─────────────────────────────────────────────────────────

    @PostMapping("/review/{eventId}")
    public ResponseEntity<ApiResponse<ReviewQueueItem>> flagForReview(
            @PathVariable UUID eventId,
            @Valid @RequestBody FlagRequest request) {
        ReviewQueueItem item = complianceService.flagForReview(
                eventId, request.getFlaggedBy(), request.getFlagReason(), request.getFlagDetails());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(item));
    }

    @GetMapping("/review")
    public ResponseEntity<ApiResponse<Page<ReviewQueueItem>>> listReviewQueue(
            @RequestParam(required = false) ReviewStatus status,
            @RequestParam(required = false) String assignedTo,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<ReviewQueueItem> items = complianceService.listReviewQueue(
                status, assignedTo,
                PageRequest.of(page, size, Sort.by("createdAt").descending()));
        return ResponseEntity.ok(ApiResponse.ok(items));
    }

    @PutMapping("/review/{reviewId}/resolve")
    public ResponseEntity<ApiResponse<ReviewQueueItem>> resolveReview(
            @PathVariable UUID reviewId,
            @Valid @RequestBody ResolveRequest request) {
        ReviewQueueItem item = complianceService.resolveReview(
                reviewId, request.getResolution(), request.getResolvedBy());
        return ResponseEntity.ok(ApiResponse.ok(item));
    }

    // ─── DTOs ─────────────────────────────────────────────────────────────────

    @Data
    public static class AuditEventRequest {
        @NotBlank private String eventType;
        private String agentId;
        private UUID userId;
        private UUID sessionId;
        @NotBlank private String action;
        private String resourceType;
        private String resourceId;
        private Object payload;
        private Map<String, Object> metadata;
    }

    @Data
    public static class FlagRequest {
        @NotBlank private String flaggedBy;
        private String flagReason;
        private Map<String, Object> flagDetails;
    }

    @Data
    public static class ResolveRequest {
        @NotBlank private String resolution;
        @NotBlank private String resolvedBy;
    }
}
