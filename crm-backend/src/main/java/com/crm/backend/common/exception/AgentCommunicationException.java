package com.crm.backend.common.exception;

public class AgentCommunicationException extends RuntimeException {
    public AgentCommunicationException(String agentName, String reason) {
        super("Failed to communicate with agent [" + agentName + "]: " + reason);
    }

    public AgentCommunicationException(String agentName, String reason, Throwable cause) {
        super("Failed to communicate with agent [" + agentName + "]: " + reason, cause);
    }
}
