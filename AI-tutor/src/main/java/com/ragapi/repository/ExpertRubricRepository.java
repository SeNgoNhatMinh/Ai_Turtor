package com.ragapi.repository;

import com.ragapi.entity.ExpertRubric;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface ExpertRubricRepository extends MongoRepository<ExpertRubric, String> {
    List<ExpertRubric> findByCourseIdOrderByCreatedAtDesc(String courseId);
}
