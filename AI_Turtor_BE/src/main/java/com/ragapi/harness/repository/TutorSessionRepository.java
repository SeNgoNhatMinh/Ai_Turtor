package com.ragapi.harness.repository;

import com.ragapi.harness.entity.TutorSession;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface TutorSessionRepository extends MongoRepository<TutorSession, String> {
    Optional<TutorSession> findFirstByStudentIdAndCourseIdAndStatusOrderByUpdatedAtDesc(
            String studentId, String courseId, String status);
    List<TutorSession> findByStudentIdAndCourseIdOrderByStartedAtDesc(String studentId, String courseId);
    List<TutorSession> findByCourseIdAndClassIdOrderByUpdatedAtDesc(String courseId, String classId);
}
