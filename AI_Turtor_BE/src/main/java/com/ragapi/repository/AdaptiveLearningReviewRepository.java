package com.ragapi.repository;

import com.ragapi.entity.AdaptiveLearningReview;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;
import java.util.Optional;

public interface AdaptiveLearningReviewRepository extends MongoRepository<AdaptiveLearningReview, String> {
    Optional<AdaptiveLearningReview> findByStudentIdAndCourseIdAndCompletedSessionCount(
            String studentId, String courseId, Integer completedSessionCount);
    Optional<AdaptiveLearningReview> findByStudentIdAndCourseIdAndQuestionCount(
            String studentId, String courseId, Integer questionCount);
    List<AdaptiveLearningReview> findByCourseIdAndClassIdOrderByCreatedAtDesc(String courseId, String classId);
    List<AdaptiveLearningReview> findByCourseIdOrderByCreatedAtDesc(String courseId);
    List<AdaptiveLearningReview> findByStudentIdOrderByCreatedAtAsc(String studentId);

    List<AdaptiveLearningReview> findByStudentIdAndCourseIdOrderByCreatedAtDesc(String studentId, String courseId);
    List<AdaptiveLearningReview> findByStudentIdAndCourseIdAndClassIdOrderByCreatedAtDesc(String studentId, String courseId, String classId);
    long countByStatus(String status);

    /** PENDING reviews whose automatic LLM assessment still needs repairing. */
    @Query("{ 'status': 'PENDING', 'evaluationError': { $type: 'string', $ne: '' } }")
    List<AdaptiveLearningReview> findPendingWithEvaluationError(Pageable pageable);
}
