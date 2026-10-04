package com.ragapi.repository;

import com.ragapi.entity.CourseMaterialIndexJob;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;
import java.util.List;

public interface CourseMaterialIndexJobRepository extends MongoRepository<CourseMaterialIndexJob, String> {
    Optional<CourseMaterialIndexJob> findByIdempotencyKey(String idempotencyKey);
    Optional<CourseMaterialIndexJob> findTopByMaterialIdOrderByCreatedAtDesc(String materialId);
    List<CourseMaterialIndexJob> findByCourseIdOrderByCreatedAtDesc(String courseId);
}
