package com.ragapi.harness.repository;

import com.ragapi.harness.entity.TeachingBehaviorExecution;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface TeachingBehaviorExecutionRepository extends MongoRepository<TeachingBehaviorExecution, String> {
    long countByExecutionStatus(String executionStatus);
}
