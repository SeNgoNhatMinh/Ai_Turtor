package com.ragapi.repository;

import com.ragapi.entity.TeachingBehaviorExecution;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface TeachingBehaviorExecutionRepository extends MongoRepository<TeachingBehaviorExecution, String> {
    long countByExecutionStatus(String executionStatus);
}
