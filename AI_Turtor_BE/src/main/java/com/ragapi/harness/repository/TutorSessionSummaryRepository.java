package com.ragapi.harness.repository;

import com.ragapi.harness.entity.TutorSessionSummary;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface TutorSessionSummaryRepository extends MongoRepository<TutorSessionSummary, String> {
    Optional<TutorSessionSummary> findBySessionId(String sessionId);
    List<TutorSessionSummary> findByStudentIdAndCourseIdOrderByCreatedAtDesc(String studentId, String courseId);
    List<TutorSessionSummary> findByCourseIdAndClassIdOrderByCreatedAtDesc(String courseId, String classId);
}
