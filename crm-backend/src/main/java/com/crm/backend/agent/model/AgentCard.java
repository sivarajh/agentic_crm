package com.crm.backend.agent.model;

import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.Map;

@Value
@Builder
public class AgentCard {
    String schemaVersion;
    String name;
    String displayName;
    String description;
    String version;
    String url;
    Map<String, Object> capabilities;
    List<AgentSkill> skills;

    @Value
    @Builder
    public static class AgentSkill {
        String id;
        String name;
        String description;
        List<String> tags;
    }
}
