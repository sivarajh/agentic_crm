package com.crm.backend.conversation;

import com.crm.backend.common.model.ApiResponse;
import com.crm.backend.conversation.model.Conversation;
import com.crm.backend.conversation.model.ConversationMessage;
import com.crm.backend.conversation.model.MessageRole;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/conversations")
@RequiredArgsConstructor
public class ConversationController {

    private final ConversationService conversationService;

    @PostMapping
    public ResponseEntity<ApiResponse<Conversation>> createConversation(
            @Valid @RequestBody CreateConversationRequest request) {
        Conversation conv = conversationService.createConversation(request.getSessionId());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(conv));
    }

    @GetMapping("/{conversationId}")
    public ResponseEntity<ApiResponse<Conversation>> getConversation(
            @PathVariable UUID conversationId) {
        return ResponseEntity.ok(ApiResponse.ok(conversationService.getConversation(conversationId)));
    }

    @GetMapping("/session/{sessionId}")
    public ResponseEntity<ApiResponse<List<Conversation>>> getConversationsBySession(
            @PathVariable UUID sessionId) {
        return ResponseEntity.ok(ApiResponse.ok(
                conversationService.getConversationsBySession(sessionId)));
    }

    @PostMapping("/{conversationId}/messages")
    public ResponseEntity<ApiResponse<ConversationMessage>> appendMessage(
            @PathVariable UUID conversationId,
            @Valid @RequestBody AppendMessageRequest request) {
        ConversationMessage msg = conversationService.appendMessage(
                conversationId,
                request.getRole(),
                request.getContent(),
                request.getAgentId(),
                request.getTokenCount(),
                request.getMetadata()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(msg));
    }

    @DeleteMapping("/{conversationId}")
    public ResponseEntity<ApiResponse<Void>> deleteConversation(
            @PathVariable UUID conversationId) {
        conversationService.softDeleteConversation(conversationId);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @GetMapping("/{conversationId}/messages")
    public ResponseEntity<ApiResponse<Page<ConversationMessage>>> getMessages(
            @PathVariable UUID conversationId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Page<ConversationMessage> msgs = conversationService.getMessages(
                conversationId,
                PageRequest.of(page, size, Sort.by("createdAt").ascending()));
        return ResponseEntity.ok(ApiResponse.ok(msgs));
    }

    // ─── Request DTOs ─────────────────────────────────────────────────────────

    @Data
    public static class CreateConversationRequest {
        @NotNull
        private UUID sessionId;
    }

    @Data
    public static class AppendMessageRequest {
        @NotNull
        private MessageRole role;
        @NotBlank
        private String content;
        private String agentId;
        private Integer tokenCount;
        private Map<String, Object> metadata;
    }
}
