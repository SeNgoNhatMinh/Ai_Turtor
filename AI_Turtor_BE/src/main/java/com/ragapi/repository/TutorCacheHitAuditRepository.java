package com.ragapi.repository;

import com.ragapi.entity.TutorCacheHitAudit;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface TutorCacheHitAuditRepository extends MongoRepository<TutorCacheHitAudit, String> {
    List<TutorCacheHitAudit> findByCourseIdOrderByCreatedAtDesc(String courseId, Pageable pageable);
    List<TutorCacheHitAudit> findByCourseIdAndCreatedAtAfterOrderByCreatedAtDesc(
            String courseId,
            LocalDateTime createdAt
    );
}
