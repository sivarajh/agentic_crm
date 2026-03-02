package com.crm.backend.memory;

import com.crm.backend.memory.model.ProceduralMemory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProceduralMemoryRepository extends JpaRepository<ProceduralMemory, UUID> {

    List<ProceduralMemory> findByActiveTrue();

    Optional<ProceduralMemory> findByNameAndActiveTrue(String name);

    // agent_scope is stored as jsonb (converted from text[] by V5 migration).
    // Use jsonb containment (@>) instead of the text-array ANY() operator.
    @Query(value = """
        SELECT * FROM procedural_memory
        WHERE active = true
          AND (:agentId IS NULL
               OR agent_scope IS NULL
               OR agent_scope @> jsonb_build_array(CAST(:agentId AS text)))
        ORDER BY name
        """, nativeQuery = true)
    List<ProceduralMemory> findActiveByAgentScope(@Param("agentId") String agentId);
}
