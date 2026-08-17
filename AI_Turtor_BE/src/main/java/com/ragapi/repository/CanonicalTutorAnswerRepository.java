package com.ragapi.repository;

import com.ragapi.entity.CanonicalTutorAnswer;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface CanonicalTutorAnswerRepository extends MongoRepository<CanonicalTutorAnswer, String> {

    List<CanonicalTutorAnswer> findByCourseIdAndClassIdAndModeAndExpiresAtAfterOrderByCreatedAtDesc(
            String courseId,
            String classId,
            String mode,
            LocalDateTime expiresAt
    );

    List<CanonicalTutorAnswer> findByCourseIdOrderByCreatedAtDesc(String courseId);

    List<CanonicalTutorAnswer> findByCourseIdAndModeOrderByCreatedAtDesc(String courseId, String mode);

    List<CanonicalTutorAnswer> findByCourseIdAndReviewStatusOrderByCreatedAtDesc(String courseId, String reviewStatus);

    List<CanonicalTutorAnswer> findTop2000ByModeAndExpiresAtAfterOrderByCreatedAtDesc(
            String mode,
            LocalDateTime expiresAt
    );
}
