package com.crm.backend.context;

import com.crm.backend.config.CrmProperties;
import com.crm.backend.context.model.AgentContext;
import com.crm.backend.context.model.MemoryRef;
import com.crm.backend.memory.EpisodicMemoryService;
import com.crm.backend.memory.ProceduralMemoryService;
import com.crm.backend.memory.WorkingMemoryService;
import com.crm.backend.memory.model.EpisodicMemory;
import com.crm.backend.session.SessionService;
import com.crm.backend.session.model.Session;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.tracing.Span;
import io.micrometer.tracing.Tracer;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Context Fabric Service — assembles unified agent context from all platform stores.
 *
 * Context is cached in Redis (TTL: 5 min) keyed by contextId.
 * Cache is invalidated on explicit update.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ContextFabricService {

    private static final String CTX_CACHE_PREFIX = "ctx:cache:";

    private final SessionService sessionService;
    private final WorkingMemoryService workingMemoryService;
    private final EpisodicMemoryService episodicMemoryService;
    private final ProceduralMemoryService proceduralMemoryService;
    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;
    private final CrmProperties crmProperties;
    private final Tracer tracer;

    @SneakyThrows
    public AgentContext buildContext(String contextId, UUID sessionId,
                                      String agentId, UUID userId) {
        Span span = tracer.nextSpan().name("crm.context.build").start();
        try (Tracer.SpanInScope ws = tracer.withSpan(span)) {

            // Check Redis cache
            String cached = redisTemplate.opsForValue().get(CTX_CACHE_PREFIX + contextId);
            if (cached != null) {
                span.tag("cache.hit", "true");
                return objectMapper.readValue(cached, AgentContext.class);
            }
            span.tag("cache.hit", "false");

            // Assemble context from all stores
            Session session = sessionService.getSession(sessionId);
            Map<String, Object> workingMem = workingMemoryService.getAllForSession(sessionId);
            List<EpisodicMemory> recentEpisodes = episodicMemoryService.getRecent(
                    userId, crmProperties.getMemory().getEpisodic().getRecentLimit());

            AgentContext context = AgentContext.builder()
                    .contextId(contextId)
                    .sessionId(sessionId)
                    .agentId(agentId)
                    .userId(userId)
                    .timestamp(Instant.now())
                    .sessionState(session.getState().name())
                    .workingMemorySnapshot(workingMem)
                    .memoryRefs(toMemoryRefs(recentEpisodes))
                    .availableProcedures(proceduralMemoryService.getActiveForAgent(agentId))
                    .currentTask(session.getActiveTaskId() != null
                            ? session.getActiveTaskId().toString() : null)
                    .build();

            // Cache assembled context
            cacheContext(contextId, context);
            return context;

        } finally {
            span.end();
        }
    }

    @SneakyThrows
    public AgentContext getContext(String contextId) {
        String cached = redisTemplate.opsForValue().get(CTX_CACHE_PREFIX + contextId);
        if (cached == null) {
            return null;
        }
        return objectMapper.readValue(cached, AgentContext.class);
    }

    @SneakyThrows
    public AgentContext updateContext(String contextId, Map<String, Object> patch) {
        // Invalidate cache
        redisTemplate.delete(CTX_CACHE_PREFIX + contextId);
        AgentContext existing = getContext(contextId);
        if (existing == null) {
            return null;
        }
        // Merge patch into existing context (simple field-level merge)
        AgentContext.AgentContextBuilder builder = existing.toBuilder()
                .timestamp(Instant.now());

        if (patch.containsKey("currentTask")) {
            builder.currentTask((String) patch.get("currentTask"));
        }
        AgentContext updated = builder.build();
        cacheContext(contextId, updated);
        return updated;
    }

    public void deleteContext(String contextId) {
        redisTemplate.delete(CTX_CACHE_PREFIX + contextId);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    @SneakyThrows
    private void cacheContext(String contextId, AgentContext context) {
        Duration ttl = Duration.ofMinutes(crmProperties.getContext().getCacheTtlMinutes());
        redisTemplate.opsForValue().set(
                CTX_CACHE_PREFIX + contextId,
                objectMapper.writeValueAsString(context),
                ttl);
    }

    private List<MemoryRef> toMemoryRefs(List<EpisodicMemory> episodes) {
        return episodes.stream()
                .map(e -> MemoryRef.builder()
                        .episodeId(e.getEpisodeId())
                        .entityId(e.getEntityId())
                        .entityType(e.getEntityType())
                        .eventType(e.getEventType())
                        .summary(e.getSummary())
                        .occurredAt(e.getOccurredAt())
                        .build())
                .toList();
    }
}
