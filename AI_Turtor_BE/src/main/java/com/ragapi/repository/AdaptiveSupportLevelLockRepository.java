package com.ragapi.repository;

import com.ragapi.entity.AdaptiveSupportLevelLock;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface AdaptiveSupportLevelLockRepository extends MongoRepository<AdaptiveSupportLevelLock, String> {
    Optional<AdaptiveSupportLevelLock> findByStudentIdAndCourseIdAndClassId(
            String studentId, String courseId, String classId);
}
