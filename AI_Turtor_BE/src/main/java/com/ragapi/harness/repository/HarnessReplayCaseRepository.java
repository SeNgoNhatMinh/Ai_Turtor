package com.ragapi.harness.repository;

import com.ragapi.harness.entity.HarnessReplayCase;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface HarnessReplayCaseRepository extends MongoRepository<HarnessReplayCase, String> {
    List<HarnessReplayCase> findByCourseIdOrderByCreatedAtDesc(String courseId);

    List<HarnessReplayCase> findByCourseIdAndStatusOrderByCreatedAtAsc(String courseId, String status);

    Optional<HarnessReplayCase> findFirstByCourseIdAndQuestionKeyAndStatus(String courseId, String questionKey, String status);
}
