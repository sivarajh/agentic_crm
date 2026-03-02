package com.crm.backend.compliance;

import com.crm.backend.common.exception.ResourceNotFoundException;
import com.crm.backend.common.util.HashUtil;
import com.crm.backend.compliance.model.AuditEvent;
import com.crm.backend.compliance.model.ReviewQueueItem;
import com.crm.backend.compliance.model.ReviewStatus;
import io.micrometer.tracing.Tracer;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class ComplianceService {

    private final AuditEventRepository auditEventRepository;
    private final ReviewQueueRepository reviewQueueRepository;
    private final Tracer tracer;

    @Transactional
    public AuditEvent recordEvent(String eventType,
                                   String agentId,
                                   UUID userId,
                                   UUID sessionId,
                                   String action,
                                   String resourceType,
                                   String resourceId,
                                   Object payload,
                                   Map<String, Object> metadata) {
        // Capture trace context
        String traceId = null;
        String spanId = null;
        if (tracer.currentSpan() != null) {
            traceId = tracer.currentSpan().context().traceId();
            spanId = tracer.currentSpan().context().spanId();
        }

        String dataHash = payload != null ? HashUtil.sha256(payload) : null;

        AuditEvent event = AuditEvent.builder()
                .eventType(eventType)
                .agentId(agentId)
                .userId(userId)
                .sessionId(sessionId)
                .action(action)
                .resourceType(resourceType)
                .resourceId(resourceId)
                .dataHash(dataHash)
                .traceId(traceId)
                .spanId(spanId)
                .metadata(metadata != null ? metadata : Map.of())
                .build();
        event = auditEventRepository.save(event);
        log.debug("Audit event={} type={} session={}", event.getAuditEventId(), eventType, sessionId);
        return event;
    }

    @Transactional(readOnly = true)
    public Page<AuditEvent> listEvents(UUID userId, String agentId, String eventType,
                                        UUID sessionId, Instant from, Instant to,
                                        Pageable pageable) {
        // Build predicates dynamically to avoid JDBC null-type inference issues
        // that arise from "(:param IS NULL OR col = :param)" patterns on PostgreSQL.
        Specification<AuditEvent> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (userId    != null) predicates.add(cb.equal(root.get("userId"),    userId));
            if (agentId   != null) predicates.add(cb.equal(root.get("agentId"),   agentId));
            if (eventType != null) predicates.add(cb.equal(root.get("eventType"), eventType));
            if (sessionId != null) predicates.add(cb.equal(root.get("sessionId"), sessionId));
            if (from      != null) predicates.add(cb.greaterThanOrEqualTo(root.get("occurredAt"), from));
            if (to        != null) predicates.add(cb.lessThanOrEqualTo(root.get("occurredAt"), to));
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return auditEventRepository.findAll(spec, pageable);
    }

    @Transactional
    public ReviewQueueItem flagForReview(UUID auditEventId,
                                          String flaggedBy,
                                          String flagReason,
                                          Map<String, Object> flagDetails) {
        if (!auditEventRepository.existsById(auditEventId)) {
            throw new ResourceNotFoundException("AuditEvent", auditEventId);
        }
        ReviewQueueItem item = ReviewQueueItem.builder()
                .auditEventId(auditEventId)
                .flaggedBy(flaggedBy)
                .flagReason(flagReason)
                .flagDetails(flagDetails != null ? flagDetails : Map.of())
                .status(ReviewStatus.OPEN)
                .build();
        return reviewQueueRepository.save(item);
    }

    @Transactional(readOnly = true)
    public Page<ReviewQueueItem> listReviewQueue(ReviewStatus status,
                                                  String assignedTo,
                                                  Pageable pageable) {
        if (assignedTo != null && status != null) {
            return reviewQueueRepository.findByStatusAndAssignedTo(status, assignedTo, pageable);
        }
        if (status != null) {
            return reviewQueueRepository.findByStatus(status, pageable);
        }
        return reviewQueueRepository.findAll(pageable);
    }

    @Transactional
    public ReviewQueueItem resolveReview(UUID reviewId, String resolution, String resolvedBy) {
        ReviewQueueItem item = reviewQueueRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("ReviewQueueItem", reviewId));
        item.setStatus(ReviewStatus.RESOLVED);
        item.setResolution(resolution);
        item.setResolvedBy(resolvedBy);
        item.setResolvedAt(Instant.now());
        return reviewQueueRepository.save(item);
    }
}
