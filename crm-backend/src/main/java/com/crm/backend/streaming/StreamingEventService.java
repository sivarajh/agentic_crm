package com.crm.backend.streaming;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.List;

/**
 * Server-Sent Events (SSE) streaming service.
 * Maintains per-session emitter registries and broadcasts agent events.
 */
@Service
@Slf4j
public class StreamingEventService {

    // sessionId → list of active SSE emitters
    private final Map<String, List<SseEmitter>> sessionEmitters = new ConcurrentHashMap<>();

    public SseEmitter createEmitter(String sessionId) {
        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);
        sessionEmitters.computeIfAbsent(sessionId, k -> new CopyOnWriteArrayList<>()).add(emitter);

        emitter.onCompletion(() -> removeEmitter(sessionId, emitter));
        emitter.onTimeout(() -> removeEmitter(sessionId, emitter));
        emitter.onError(e -> removeEmitter(sessionId, emitter));

        log.debug("SSE emitter registered for session={}", sessionId);
        return emitter;
    }

    public void publishEvent(String sessionId, String eventType, Object data) {
        List<SseEmitter> emitters = sessionEmitters.get(sessionId);
        if (emitters == null || emitters.isEmpty()) return;

        SseEmitter.SseEventBuilder event = SseEmitter.event()
                .name(eventType)
                .data(data);

        List<SseEmitter> deadEmitters = new CopyOnWriteArrayList<>();
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(event);
            } catch (IOException e) {
                deadEmitters.add(emitter);
                log.debug("SSE emitter dead for session={}, removing", sessionId);
            }
        }
        emitters.removeAll(deadEmitters);
    }

    private void removeEmitter(String sessionId, SseEmitter emitter) {
        List<SseEmitter> emitters = sessionEmitters.get(sessionId);
        if (emitters != null) {
            emitters.remove(emitter);
            if (emitters.isEmpty()) {
                sessionEmitters.remove(sessionId);
            }
        }
    }
}
