package com.crm.backend.session;

import com.crm.backend.common.exception.ResourceNotFoundException;
import com.crm.backend.config.CrmProperties;
import com.crm.backend.session.model.Session;
import com.crm.backend.session.model.SessionState;
import io.micrometer.tracing.Tracer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class SessionService {

    private static final String SESSION_KEY_PREFIX = "session:";

    private final SessionRepository sessionRepository;
    private final RedisTemplate<String, String> redisTemplate;
    private final CrmProperties crmProperties;
    private final Tracer tracer;

    @Transactional
    public Session createSession(UUID userId, String agentId) {
        Session session = Session.builder()
                .userId(userId)
                .agentId(agentId)
                .state(SessionState.ACTIVE)
                .metadata(Map.of())
                .build();
        session = sessionRepository.save(session);
        cacheSession(session);
        log.info("Created session={} for user={}", session.getSessionId(), userId);
        return session;
    }

    @Transactional(readOnly = true)
    public Session getSession(UUID sessionId) {
        return sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session", sessionId));
    }

    @Transactional
    public Session heartbeat(UUID sessionId, UUID activeTaskId) {
        Instant now = Instant.now();
        int updated = sessionRepository.updateHeartbeat(sessionId, activeTaskId, now);
        if (updated == 0) {
            throw new ResourceNotFoundException("Session", sessionId);
        }
        Session session = getSession(sessionId);
        cacheSession(session);
        return session;
    }

    @Transactional
    public void terminateSession(UUID sessionId) {
        Instant now = Instant.now();
        int updated = sessionRepository.updateState(sessionId, SessionState.TERMINATED, now);
        if (updated == 0) {
            throw new ResourceNotFoundException("Session", sessionId);
        }
        evictSession(sessionId);
        log.info("Terminated session={}", sessionId);
    }

    @Transactional
    public void updateActiveTask(UUID sessionId, UUID activeTaskId) {
        heartbeat(sessionId, activeTaskId);
    }

    public Page<Session> listSessionsByUser(UUID userId, SessionState state, Pageable pageable) {
        if (state != null) {
            return sessionRepository.findByUserIdAndState(userId, state, pageable);
        }
        return sessionRepository.findByUserId(userId, pageable);
    }

    // ─── Cache Helpers ────────────────────────────────────────────────────────

    private void cacheSession(Session session) {
        String key = SESSION_KEY_PREFIX + session.getSessionId();
        Duration ttl = Duration.ofMinutes(crmProperties.getSession().getTtlMinutes());
        redisTemplate.opsForHash().put(key, "userId", session.getUserId().toString());
        redisTemplate.opsForHash().put(key, "agentId",
                session.getAgentId() != null ? session.getAgentId() : "");
        redisTemplate.opsForHash().put(key, "state", session.getState().name());
        redisTemplate.opsForHash().put(key, "lastActive", session.getLastActive().toString());
        redisTemplate.expire(key, ttl);
    }

    private void evictSession(UUID sessionId) {
        redisTemplate.delete(SESSION_KEY_PREFIX + sessionId);
    }

    // ─── Session Expiry Job ───────────────────────────────────────────────────

    @Scheduled(fixedDelayString = "${crm.session.heartbeat-interval-ms:60000}")
    @Transactional
    public void expireIdleSessions() {
        Instant cutoff = Instant.now()
                .minus(Duration.ofMinutes(crmProperties.getSession().getTtlMinutes()));
        sessionRepository
                .findByStateAndLastActiveBefore(SessionState.ACTIVE, cutoff)
                .forEach(s -> {
                    sessionRepository.updateState(s.getSessionId(), SessionState.EXPIRED, Instant.now());
                    evictSession(s.getSessionId());
                    log.debug("Expired session={}", s.getSessionId());
                });
    }
}
