package com.crm.backend.memory;

import com.crm.backend.common.exception.ResourceNotFoundException;
import com.crm.backend.memory.model.ProceduralMemory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class ProceduralMemoryService {

    private final ProceduralMemoryRepository proceduralMemoryRepository;

    @Transactional(readOnly = true)
    public List<ProceduralMemory> getAll() {
        return proceduralMemoryRepository.findByActiveTrue();
    }

    @Transactional(readOnly = true)
    public List<ProceduralMemory> getActiveForAgent(String agentId) {
        return proceduralMemoryRepository.findActiveByAgentScope(agentId);
    }

    @Transactional(readOnly = true)
    public ProceduralMemory getById(UUID procedureId) {
        return proceduralMemoryRepository.findById(procedureId)
                .orElseThrow(() -> new ResourceNotFoundException("ProceduralMemory", procedureId));
    }

    @Transactional
    public ProceduralMemory create(String name,
                                    String description,
                                    List<Map<String, Object>> triggerConditions,
                                    List<Map<String, Object>> steps,
                                    List<String> agentScope,
                                    String createdBy,
                                    Map<String, Object> metadata) {
        ProceduralMemory procedure = ProceduralMemory.builder()
                .name(name)
                .description(description)
                .triggerConditions(triggerConditions != null ? triggerConditions : List.of())
                .steps(steps)
                .agentScope(agentScope)
                .createdBy(createdBy)
                .metadata(metadata != null ? metadata : Map.of())
                .build();
        return proceduralMemoryRepository.save(procedure);
    }

    @Transactional
    public ProceduralMemory update(UUID procedureId,
                                    String description,
                                    List<Map<String, Object>> steps,
                                    Boolean active,
                                    Map<String, Object> metadata) {
        ProceduralMemory procedure = getById(procedureId);
        if (description != null) procedure.setDescription(description);
        if (steps != null) procedure.setSteps(steps);
        if (active != null) procedure.setActive(active);
        if (metadata != null) procedure.setMetadata(metadata);
        return proceduralMemoryRepository.save(procedure);
    }
}
