package com.crm.backend.memory;

import com.crm.backend.memory.model.EpisodicMemory;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface EpisodicMemoryRepository extends JpaRepository<EpisodicMemory, UUID> {

    List<EpisodicMemory> findByEntityIdAndEntityTypeOrderByOccurredAtDesc(
            UUID entityId, String entityType, Pageable pageable);

    List<EpisodicMemory> findByEntityIdAndEntityTypeAndOccurredAtBeforeOrderByOccurredAtDesc(
            UUID entityId, String entityType, Instant before, Pageable pageable);

    List<EpisodicMemory> findByEntityIdOrderByOccurredAtDesc(UUID entityId, Pageable pageable);
}
