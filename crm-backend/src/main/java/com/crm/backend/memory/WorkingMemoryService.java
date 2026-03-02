package com.crm.backend.memory;

import com.crm.backend.config.CrmProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Working Memory — short-term, session-scoped memory backed by Redis.
 * TTL mirrors the session TTL. All data is volatile and lost on expiry.
 *
 * Key patterns:
 *   wm:{sessionId}:task_state     → STRING (JSON)
 *   wm:{sessionId}:reasoning      → LIST   (capped)
 *   wm:{sessionId}:tool_results   → HASH
 *   wm:{sessionId}:scratch        → HASH   (arbitrary key/value)
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class WorkingMemoryService {

    private static final String WM_PREFIX = "wm:";

    private final RedisTemplate<String, String> redisTemplate;
    private final CrmProperties crmProperties;
    private final ObjectMapper objectMapper;

    // ─── Task State ───────────────────────────────────────────────────────────

    @SneakyThrows
    public void setTaskState(UUID sessionId, Object state) {
        String key = key(sessionId, "task_state");
        redisTemplate.opsForValue().set(key, objectMapper.writeValueAsString(state), ttl());
    }

    @SneakyThrows
    public <T> T getTaskState(UUID sessionId, Class<T> type) {
        String key = key(sessionId, "task_state");
        String raw = redisTemplate.opsForValue().get(key);
        if (raw == null) return null;
        return objectMapper.readValue(raw, type);
    }

    // ─── Reasoning Steps ──────────────────────────────────────────────────────

    public void pushReasoning(UUID sessionId, String step) {
        String key = key(sessionId, "reasoning");
        long maxEntries = crmProperties.getMemory().getWorking().getReasoningMaxEntries();
        redisTemplate.opsForList().rightPush(key, step);
        redisTemplate.opsForList().trim(key, -maxEntries, -1); // keep last N
        redisTemplate.expire(key, ttl());
    }

    public List<String> getReasoning(UUID sessionId) {
        String key = key(sessionId, "reasoning");
        List<String> result = redisTemplate.opsForList().range(key, 0, -1);
        return result != null ? result : List.of();
    }

    // ─── Tool Results ─────────────────────────────────────────────────────────

    @SneakyThrows
    public void setToolResult(UUID sessionId, String toolName, Object result) {
        String key = key(sessionId, "tool_results");
        redisTemplate.opsForHash().put(key, toolName, objectMapper.writeValueAsString(result));
        redisTemplate.expire(key, ttl());
    }

    @SneakyThrows
    public <T> T getToolResult(UUID sessionId, String toolName, Class<T> type) {
        String key = key(sessionId, "tool_results");
        Object raw = redisTemplate.opsForHash().get(key, toolName);
        if (raw == null) return null;
        return objectMapper.readValue(raw.toString(), type);
    }

    // ─── Scratch Pad ──────────────────────────────────────────────────────────

    public void set(UUID sessionId, String scratchKey, String value) {
        String key = key(sessionId, "scratch");
        redisTemplate.opsForHash().put(key, scratchKey, value);
        redisTemplate.expire(key, ttl());
    }

    public String get(UUID sessionId, String scratchKey) {
        String key = key(sessionId, "scratch");
        Object val = redisTemplate.opsForHash().get(key, scratchKey);
        return val != null ? val.toString() : null;
    }

    public void delete(UUID sessionId, String scratchKey) {
        String key = key(sessionId, "scratch");
        redisTemplate.opsForHash().delete(key, scratchKey);
    }

    // ─── Snapshot (for context fabric) ────────────────────────────────────────

    public Map<String, Object> getAllForSession(UUID sessionId) {
        Map<String, Object> snapshot = new HashMap<>();
        String taskState = redisTemplate.opsForValue().get(key(sessionId, "task_state"));
        if (taskState != null) snapshot.put("taskState", taskState);

        List<String> reasoning = getReasoning(sessionId);
        snapshot.put("reasoning", reasoning);

        Map<Object, Object> scratch = redisTemplate.opsForHash()
                .entries(key(sessionId, "scratch"));
        snapshot.put("scratch", scratch);
        return snapshot;
    }

    // ─── Full Session Clear ───────────────────────────────────────────────────

    public void clearSession(UUID sessionId) {
        Set<String> keys = redisTemplate.keys(WM_PREFIX + sessionId + ":*");
        if (keys != null && !keys.isEmpty()) {
            redisTemplate.delete(keys);
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private static String key(UUID sessionId, String suffix) {
        return WM_PREFIX + sessionId + ":" + suffix;
    }

    private Duration ttl() {
        return Duration.ofMinutes(crmProperties.getMemory().getWorking().getTtlMinutes());
    }
}
