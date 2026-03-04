package com.crm.backend.conversation;

import com.crm.backend.common.exception.ResourceNotFoundException;
import com.crm.backend.conversation.model.Conversation;
import com.crm.backend.conversation.model.ConversationMessage;
import com.crm.backend.conversation.model.MessageRole;
import io.micrometer.tracing.Tracer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final Tracer tracer;

    @Transactional
    public Conversation createConversation(UUID sessionId) {
        Conversation conv = Conversation.builder()
                .sessionId(sessionId)
                .build();
        return conversationRepository.save(conv);
    }

    @Transactional(readOnly = true)
    public Conversation getConversation(UUID conversationId) {
        return conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation", conversationId));
    }

    @Transactional(readOnly = true)
    public List<Conversation> getConversationsBySession(UUID sessionId) {
        return conversationRepository.findBySessionIdAndDeletedAtIsNullOrderByCreatedAtDesc(sessionId);
    }

    @Transactional
    public void softDeleteConversation(UUID conversationId) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation", conversationId));
        conv.setDeletedAt(Instant.now());
        conversationRepository.save(conv);
        log.info("Soft-deleted conversation={}", conversationId);
    }

    @Transactional
    public ConversationMessage appendMessage(UUID conversationId,
                                             MessageRole role,
                                             String content,
                                             String agentId,
                                             Integer tokenCount,
                                             Map<String, Object> metadata) {
        // Verify conversation exists
        if (!conversationRepository.existsById(conversationId)) {
            throw new ResourceNotFoundException("Conversation", conversationId);
        }

        // Look up sessionId and next turn number
        Conversation conv = getConversation(conversationId);
        int nextTurn = messageRepository.findMaxTurnId(conversationId) + 1;

        // Capture active trace/span for correlation
        String traceId = null;
        String spanId = null;
        if (tracer.currentSpan() != null) {
            traceId = tracer.currentSpan().context().traceId();
            spanId = tracer.currentSpan().context().spanId();
        }

        ConversationMessage msg = ConversationMessage.builder()
                .conversationId(conversationId)
                .sessionId(conv.getSessionId())
                .turnId(nextTurn)
                .role(role)
                .content(content)
                .agentId(agentId)
                .tokenCount(tokenCount)
                .traceId(traceId)
                .spanId(spanId)
                .metadata(metadata != null ? metadata : Map.of())
                .build();

        msg = messageRepository.save(msg);
        log.debug("Appended message turn={} role={} to conversation={}", nextTurn, role, conversationId);
        return msg;
    }

    @Transactional(readOnly = true)
    public Page<ConversationMessage> getMessages(UUID conversationId, Pageable pageable) {
        if (!conversationRepository.existsById(conversationId)) {
            throw new ResourceNotFoundException("Conversation", conversationId);
        }
        return messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId, pageable);
    }
}
