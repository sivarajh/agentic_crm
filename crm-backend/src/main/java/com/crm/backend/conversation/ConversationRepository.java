package com.crm.backend.conversation;

import com.crm.backend.conversation.model.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, UUID> {
    List<Conversation> findBySessionIdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID sessionId);
    List<Conversation> findByProjectId(UUID projectId);
}
