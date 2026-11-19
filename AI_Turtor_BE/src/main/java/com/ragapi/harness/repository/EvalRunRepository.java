package com.ragapi.harness.repository;

import com.ragapi.harness.entity.EvalRun;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface EvalRunRepository extends MongoRepository<EvalRun, String> {
    List<EvalRun> findByCourseIdOrderByCreatedAtDesc(String courseId);
    Optional<EvalRun> findFirstByCourseIdAndStatusOrderByCompletedAtDesc(String courseId, String status);
}
