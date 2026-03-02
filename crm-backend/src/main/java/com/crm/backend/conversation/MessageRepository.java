package com.crm.backend.conversation;

import com.crm.backend.conversation.model.ConversationMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface MessageRepository extends JpaRepository<ConversationMessage, UUID> {

    Page<ConversationMessage> findByConversationIdOrderByCreatedAtAsc(
            UUID conversationId, Pageable pageable);

    @Query("SELECT COALESCE(MAX(m.turnId), 0) FROM ConversationMessage m " +
           "WHERE m.conversationId = :convId")
    int findMaxTurnId(@Param("convId") UUID conversationId);
}
