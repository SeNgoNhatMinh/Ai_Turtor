package com.ragapi.harness.repository;

import com.ragapi.harness.entity.AdaptiveSupportLevelLock;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface AdaptiveSupportLevelLockRepository extends MongoRepository<AdaptiveSupportLevelLock, String> {
    Optional<AdaptiveSupportLevelLock> findByStudentIdAndCourseIdAndClassId(
            String studentId, String courseId, String classId);
}
