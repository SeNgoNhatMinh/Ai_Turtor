package com.ragapi.harness.repository;

import com.ragapi.harness.entity.QuizAssignment;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QuizAssignmentRepository extends MongoRepository<QuizAssignment, String> {
    List<QuizAssignment> findByTeacherIdOrderByCreatedAtDesc(String teacherId);
    List<QuizAssignment> findByCourseIdAndClassIdAndStatusOrderByPublishedAtDesc(String courseId, String classId, String status);
    List<QuizAssignment> findByCourseIdAndStatusOrderByPublishedAtDesc(String courseId, String status);
}
