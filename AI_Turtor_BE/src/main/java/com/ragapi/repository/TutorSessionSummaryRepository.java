package com.ragapi.repository;

import com.ragapi.entity.TutorSessionSummary;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface TutorSessionSummaryRepository extends MongoRepository<TutorSessionSummary, String> {
    Optional<TutorSessionSummary> findBySessionId(String sessionId);
    List<TutorSessionSummary> findByStudentIdAndCourseIdOrderByCreatedAtDesc(String studentId, String courseId);
    List<TutorSessionSummary> findByCourseIdAndClassIdOrderByCreatedAtDesc(String courseId, String classId);
}
