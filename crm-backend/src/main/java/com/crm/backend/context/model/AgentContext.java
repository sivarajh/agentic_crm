package com.crm.backend.context.model;

import com.crm.backend.memory.model.ProceduralMemory;
import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Value
@Builder(toBuilder = true)
public class AgentContext {

    String contextId;
    UUID sessionId;
    String agentId;
    UUID userId;
    Instant timestamp;

    /** Current session state (ACTIVE, IDLE, etc.) */
    String sessionState;

    /** Snapshot of working memory for this session */
    Map<String, Object> workingMemorySnapshot;

    /** References to relevant episodic memories */
    List<MemoryRef> memoryRefs;

    /** Procedures available to this agent */
    List<ProceduralMemory> availableProcedures;

    /** Current task ID being executed */
    String currentTask;
}
