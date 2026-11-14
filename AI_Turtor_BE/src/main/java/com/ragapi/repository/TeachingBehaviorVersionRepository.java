package com.ragapi.repository;

import com.ragapi.entity.TeachingBehaviorVersion;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface TeachingBehaviorVersionRepository extends MongoRepository<TeachingBehaviorVersion, String> {
    List<TeachingBehaviorVersion> findByBehaviorIdOrderByVersionDesc(String behaviorId);

    Optional<TeachingBehaviorVersion> findByBehaviorIdAndVersion(String behaviorId, int version);
}
