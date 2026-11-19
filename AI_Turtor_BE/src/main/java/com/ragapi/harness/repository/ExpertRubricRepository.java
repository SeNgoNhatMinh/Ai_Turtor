package com.ragapi.harness.repository;

import com.ragapi.harness.entity.ExpertRubric;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface ExpertRubricRepository extends MongoRepository<ExpertRubric, String> {
    List<ExpertRubric> findByCourseIdOrderByCreatedAtDesc(String courseId);
    List<ExpertRubric> findBySourceTaskId(String sourceTaskId);
}
