package com.crm.backend.agent.model;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class A2AArtifact {
    String name;
    String mimeType;
    Object content;
}
