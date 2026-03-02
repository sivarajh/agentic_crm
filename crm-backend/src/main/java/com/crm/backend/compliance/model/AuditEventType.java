package com.crm.backend.compliance.model;

public enum AuditEventType {
    // Agent lifecycle
    AGENT_TASK_SUBMITTED,
    AGENT_TASK_COMPLETED,
    AGENT_TASK_FAILED,
    AGENT_TASK_CANCELLED,

    // Memory operations
    MEMORY_READ,
    MEMORY_WRITE,
    MEMORY_DELETE,

    // Context operations
    CONTEXT_BUILD,
    CONTEXT_UPDATE,

    // Guardrails
    GUARDRAIL_VIOLATION_INPUT,
    GUARDRAIL_VIOLATION_OUTPUT,
    GUARDRAIL_PII_DETECTED,
    GUARDRAIL_INJECTION_DETECTED,

    // Session
    SESSION_CREATED,
    SESSION_TERMINATED,
    SESSION_EXPIRED,

    // Compliance
    COMPLIANCE_REVIEW_FLAGGED,
    COMPLIANCE_REVIEW_RESOLVED
}
