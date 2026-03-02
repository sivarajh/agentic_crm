package com.crm.backend.session;

import com.crm.backend.session.model.Session;
import com.crm.backend.session.model.SessionState;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface SessionRepository extends JpaRepository<Session, UUID> {

    Page<Session> findByUserId(UUID userId, Pageable pageable);

    Page<Session> findByUserIdAndState(UUID userId, SessionState state, Pageable pageable);

    List<Session> findByStateAndLastActiveBefore(SessionState state, Instant cutoff);

    @Modifying
    @Query("UPDATE Session s SET s.state = :state, s.updatedAt = :now WHERE s.sessionId = :id")
    int updateState(@Param("id") UUID sessionId,
                    @Param("state") SessionState state,
                    @Param("now") Instant now);

    @Modifying
    @Query("UPDATE Session s SET s.lastActive = :now, s.activeTaskId = :taskId, s.updatedAt = :now " +
           "WHERE s.sessionId = :id")
    int updateHeartbeat(@Param("id") UUID sessionId,
                        @Param("taskId") UUID activeTaskId,
                        @Param("now") Instant now);
}
