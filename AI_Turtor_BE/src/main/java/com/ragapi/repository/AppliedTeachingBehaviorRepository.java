package com.ragapi.repository;

import com.ragapi.entity.AppliedTeachingBehavior;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface AppliedTeachingBehaviorRepository extends MongoRepository<AppliedTeachingBehavior, String> {
    List<AppliedTeachingBehavior> findByBehaviorId(String behaviorId);

    List<AppliedTeachingBehavior> findByCourseIdAndStatus(String courseId, String status);

    long countByStatus(String status);
}
