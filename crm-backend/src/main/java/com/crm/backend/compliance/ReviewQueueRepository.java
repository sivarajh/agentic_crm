package com.crm.backend.compliance;

import com.crm.backend.compliance.model.ReviewQueueItem;
import com.crm.backend.compliance.model.ReviewStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ReviewQueueRepository extends JpaRepository<ReviewQueueItem, UUID> {

    Page<ReviewQueueItem> findByStatus(ReviewStatus status, Pageable pageable);

    Page<ReviewQueueItem> findByStatusAndAssignedTo(
            ReviewStatus status, String assignedTo, Pageable pageable);
}
