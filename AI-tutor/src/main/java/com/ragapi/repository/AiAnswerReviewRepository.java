package com.ragapi.repository;

import com.ragapi.entity.AiAnswerReview;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AiAnswerReviewRepository extends MongoRepository<AiAnswerReview, String> {

    List<AiAnswerReview> findByStatus(String status);

    List<AiAnswerReview> findByCourseId(String courseId);

    List<AiAnswerReview> findByStudentIdAndCourseId(String studentId, String courseId);

    List<AiAnswerReview> findByCourseIdAndAnswerFingerprint(String courseId, String answerFingerprint);
}
