package com.crm.backend.streaming;

import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/v1/stream")
@RequiredArgsConstructor
public class SseController {

    private final StreamingEventService streamingEventService;

    /**
     * Open an SSE stream for a session.
     * The UI calls this once per session to receive real-time agent events:
     *   agent.thinking, agent.tool_call, agent.message, task.completed, task.failed
     */
    @GetMapping(value = "/session/{sessionId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamSession(@PathVariable String sessionId) {
        return streamingEventService.createEmitter(sessionId);
    }
}
