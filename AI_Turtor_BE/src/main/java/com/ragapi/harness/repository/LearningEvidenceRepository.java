package com.ragapi.harness.repository;

import com.ragapi.harness.entity.LearningEvidence;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface LearningEvidenceRepository extends MongoRepository<LearningEvidence, String> {
    Optional<LearningEvidence> findByStudentIdAndCourseIdAndSourceTypeAndSourceRecordId(
            String studentId, String courseId, String sourceType, String sourceRecordId);

    List<LearningEvidence> findByStudentIdAndCourseIdOrderByEventAtDescCreatedAtDesc(
            String studentId, String courseId);
}
