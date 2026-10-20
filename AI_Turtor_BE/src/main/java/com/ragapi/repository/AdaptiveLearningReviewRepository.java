package com.ragapi.repository;

import com.ragapi.entity.AdaptiveLearningReview;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface AdaptiveLearningReviewRepository extends MongoRepository<AdaptiveLearningReview, String> {
    Optional<AdaptiveLearningReview> findByStudentIdAndCourseIdAndCompletedSessionCount(
            String studentId, String courseId, Integer completedSessionCount);
    List<AdaptiveLearningReview> findByCourseIdAndClassIdOrderByCreatedAtDesc(String courseId, String classId);
    List<AdaptiveLearningReview> findByCourseIdOrderByCreatedAtDesc(String courseId);
    List<AdaptiveLearningReview> findByStudentIdAndCourseIdOrderByCreatedAtDesc(String studentId, String courseId);
    long countByStatus(String status);
}
