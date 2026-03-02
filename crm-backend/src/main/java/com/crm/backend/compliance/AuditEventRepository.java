package com.crm.backend.compliance;

import com.crm.backend.compliance.model.AuditEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.UUID;

/**
 * Audit event repository — filtering is done via JPA Specifications in ComplianceService
 * to avoid JDBC null-type inference failures that occur when nullable Instant / UUID
 * parameters are bound inside a JPQL ":param IS NULL OR ..." pattern on PostgreSQL.
 */
@Repository
public interface AuditEventRepository
        extends JpaRepository<AuditEvent, UUID>,
                JpaSpecificationExecutor<AuditEvent> {
}
