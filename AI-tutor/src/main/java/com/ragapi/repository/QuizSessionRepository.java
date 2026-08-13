package com.ragapi.repository;

import com.ragapi.entity.QuizSession;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QuizSessionRepository extends MongoRepository<QuizSession, String> {
    List<QuizSession> findByStudentIdAndCourseIdOrderByCreatedAtDesc(String studentId, String courseId);
    List<QuizSession> findByStudentIdOrderByCreatedAtDesc(String studentId);
    List<QuizSession> findByTeacherIdOrderBySubmittedAtDesc(String teacherId);
}
