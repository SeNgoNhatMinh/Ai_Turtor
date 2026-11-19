package com.ragapi.harness.repository;

import com.ragapi.harness.entity.CourseLearningGuide;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CourseLearningGuideRepository extends MongoRepository<CourseLearningGuide, String> {

    List<CourseLearningGuide> findByCourseIdOrderByCreatedAtDesc(String courseId);

    Optional<CourseLearningGuide> findFirstByCourseIdOrderByCreatedAtDesc(String courseId);

    Optional<CourseLearningGuide> findFirstByCourseIdAndStatusOrderByCreatedAtDesc(String courseId, String status);
}
