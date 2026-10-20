package com.ragapi.repository;

import com.ragapi.entity.CourseLearningGuide;
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
