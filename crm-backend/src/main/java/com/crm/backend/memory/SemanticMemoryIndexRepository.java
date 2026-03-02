package com.crm.backend.memory;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SemanticMemoryIndexRepository extends JpaRepository<SemanticMemoryIndex, UUID> {

    Optional<SemanticMemoryIndex> findByContentHash(String contentHash);

    Optional<SemanticMemoryIndex> findByQdrantPointId(String qdrantPointId);

    List<SemanticMemoryIndex> findByEntityIdAndEntityType(String entityId, String entityType);

    List<SemanticMemoryIndex> findByEntityId(String entityId);
}
